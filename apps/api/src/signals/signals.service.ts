import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';

type EvidenceInput = { sourceType: string; sourceId: string; metric: string; observedValue: string; expectedValue?: string };
type Candidate = {
  type: string;
  severity: string;
  title: string;
  explanation: string;
  entityType: string;
  entityId: string;
  customerId?: string | null;
  departmentId: string;
  ownerId?: string | null;
  dueAt?: Date;
  observedHours?: number;
  evidence: EvidenceInput[];
};

const DEFAULT_THRESHOLDS: Record<string, number | undefined> = {
  ticket_past_target: 24,
  milestone_slip: 0,
  customer_inactivity_active_project: 14 * 24,
};

@Injectable()
export class SignalsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findAll(userId: string, status = 'open') {
    if (!['open', 'resolved', 'dismissed'].includes(status)) throw new BadRequestException('Unsupported signal status');
    await this.refresh(userId);
    const scope = await getUserScope(this.prisma, userId);
    const now = new Date();
    return this.prisma.operationalSignal.findMany({
      where: { ...(scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }), status, ...(status === 'open' ? { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] } : {}) },
      include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } }, customer: { select: { id: true, name: true } }, evidence: true },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async evidence(userId: string, id: string) {
    const signal = await this.getAccessible(userId, id);
    return signal.evidence;
  }

  async metrics(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const where = scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } };
    const [rows, signals, actions] = await Promise.all([
      this.prisma.operationalSignal.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.operationalSignal.findMany({ where, select: { status: true, createdAt: true, resolvedAt: true } }),
      this.prisma.signalAction.findMany({ where: { signal: where }, select: { actionType: true } }),
    ]);
    const closed = signals.filter((item) => item.resolvedAt);
    const open = signals.filter((item) => item.status === 'open');
    const hoursBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3600000;
    const now = new Date();
    const byStatus = Object.fromEntries(rows.map((row) => [row.status, row._count]));
    const actionCounts = actions.reduce<Record<string, number>>((result, action) => { result[action.actionType] = (result[action.actionType] ?? 0) + 1; return result; }, {});
    return {
      byStatus,
      actionCounts,
      totalCreated: signals.length,
      totalClosed: closed.length,
      resolvedCount: signals.filter((item) => item.status === 'resolved').length,
      dismissedCount: signals.filter((item) => item.status === 'dismissed').length,
      averageResolutionHours: closed.length ? Number((closed.reduce((sum, item) => sum + hoursBetween(item.createdAt, item.resolvedAt!), 0) / closed.length).toFixed(1)) : 0,
      averageOpenAgeHours: open.length ? Number((open.reduce((sum, item) => sum + hoursBetween(item.createdAt, now), 0) / open.length).toFixed(1)) : 0,
    };
  }

  async rules(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    return this.prisma.signalRule.findMany({ where: scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, include: { department: { select: { id: true, name: true } } }, orderBy: [{ departmentId: 'asc' }, { type: 'asc' }] });
  }

  async saveRule(userId: string, type: string, input: { departmentId: string; enabled?: boolean; thresholdHours?: number; cooldownHours?: number }) {
    const scope = await getUserScope(this.prisma, userId);
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, input.departmentId);
    if (!type.trim()) throw new BadRequestException('Rule type is required');
    if ((input.thresholdHours !== undefined && (!Number.isInteger(input.thresholdHours) || input.thresholdHours < 0)) || (input.cooldownHours !== undefined && (!Number.isInteger(input.cooldownHours) || input.cooldownHours < 1))) throw new BadRequestException('Threshold must be zero or greater and cooldown must be positive hours');
    const rule = await this.prisma.signalRule.upsert({ where: { type_departmentId: { type, departmentId: input.departmentId } }, update: { enabled: input.enabled, thresholdHours: input.thresholdHours, cooldownHours: input.cooldownHours, updatedById: userId }, create: { type, departmentId: input.departmentId, enabled: input.enabled ?? true, thresholdHours: input.thresholdHours ?? DEFAULT_THRESHOLDS[type], cooldownHours: input.cooldownHours ?? 24, updatedById: userId } });
    await this.audit.log({ action: 'SIGNAL_RULE_UPDATED', entityType: 'SignalRule', entityId: rule.id, departmentId: input.departmentId, actorId: userId, metadata: { type, enabled: rule.enabled, thresholdHours: rule.thresholdHours, cooldownHours: rule.cooldownHours } });
    return rule;
  }

  async transition(userId: string, id: string, status: 'resolved' | 'dismissed', reason?: string) {
    const signal = await this.getAccessible(userId, id);
    if (signal.status !== 'open') throw new BadRequestException('Only open signals can be transitioned');
    const cleanReason = reason?.trim();
    if (status === 'dismissed' && (!cleanReason || cleanReason.length < 3)) throw new BadRequestException('A dismissal reason is required');
    const now = new Date();
    const updated = await this.prisma.operationalSignal.update({ where: { id }, data: { status, resolvedAt: now, resolution: status === 'resolved' ? cleanReason : undefined, dismissalReason: status === 'dismissed' ? cleanReason : undefined }, include: { evidence: true, owner: { select: { id: true, firstName: true, lastName: true, email: true } }, customer: { select: { id: true, name: true } } } });
    await this.prisma.signalAction.create({ data: { signalId: id, actionType: status, actorId: userId, completedAt: now, metadata: { reason: cleanReason ?? null } } });
    await this.audit.log({ action: `SIGNAL_${status.toUpperCase()}`, entityType: 'OperationalSignal', entityId: id, departmentId: signal.departmentId, actorId: userId, metadata: { reason: cleanReason ?? null, type: signal.type } });
    return updated;
  }

  async snooze(userId: string, id: string, until?: string) {
    const signal = await this.getAccessible(userId, id);
    if (signal.status !== 'open') throw new BadRequestException('Only open signals can be snoozed');
    const snoozedUntil = until ? new Date(until) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (Number.isNaN(snoozedUntil.getTime()) || snoozedUntil <= new Date()) throw new BadRequestException('Snooze time must be in the future');
    const updated = await this.prisma.operationalSignal.update({ where: { id }, data: { snoozedUntil } });
    await this.prisma.signalAction.create({ data: { signalId: id, actionType: 'snoozed', actorId: userId, completedAt: new Date(), metadata: { until: snoozedUntil.toISOString() } } });
    await this.audit.log({ action: 'SIGNAL_SNOOZED', entityType: 'OperationalSignal', entityId: id, departmentId: signal.departmentId, actorId: userId, metadata: { until: snoozedUntil.toISOString() } });
    return updated;
  }

  async reassign(userId: string, id: string, ownerId: string) {
    const signal = await this.getAccessible(userId, id);
    if (signal.status !== 'open') throw new BadRequestException('Only open signals can be reassigned');
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, include: { memberships: true } });
    if (!owner || !owner.active || (!owner.memberships.some((membership) => membership.departmentId === signal.departmentId) && owner.role !== 'ADMIN')) throw new BadRequestException('Owner must be active in this department');
    const updated = await this.prisma.operationalSignal.update({ where: { id }, data: { ownerId }, include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } }, evidence: true, customer: { select: { id: true, name: true } } } });
    await this.prisma.signalAction.create({ data: { signalId: id, actionType: 'reassigned', actorId: userId, completedAt: new Date(), metadata: { ownerId } } });
    await this.audit.log({ action: 'SIGNAL_REASSIGNED', entityType: 'OperationalSignal', entityId: id, departmentId: signal.departmentId, actorId: userId, metadata: { ownerId } });
    return updated;
  }

  private async getAccessible(userId: string, id: string) {
    const scope = await getUserScope(this.prisma, userId);
    const signal = await this.prisma.operationalSignal.findUnique({ where: { id }, include: { evidence: true } });
    if (!signal) throw new NotFoundException('Signal not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, signal.departmentId);
    return signal;
  }

  private async refresh(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const departmentIds = scope.departmentIds;
    const rules = await this.prisma.signalRule.findMany({ where: { departmentId: { in: departmentIds } } });
    const now = new Date();
    const [invoices, tickets, milestones, completedTasks, projects] = await Promise.all([
      this.prisma.invoice.findMany({ where: { departmentId: { in: departmentIds }, status: 'overdue' }, include: { customer: { include: { projects: { where: { status: 'active' }, select: { id: true } } } } } }),
      this.prisma.ticket.findMany({ where: { departmentId: { in: departmentIds }, status: { notIn: ['closed', 'resolved'] } }, include: { customer: true } }),
      this.prisma.taskMilestone.findMany({ where: { dueDate: { lt: now }, completed: false, project: { departmentId: { in: departmentIds }, status: 'active' } }, include: { project: true } }),
      this.prisma.task.findMany({ where: { departmentId: { in: departmentIds }, status: 'completed', projectId: { not: null }, customerId: { not: null } }, include: { project: true, customer: { include: { invoices: { select: { id: true } } } } } }),
      this.prisma.project.findMany({ where: { departmentId: { in: departmentIds }, status: 'active' }, include: { customer: true } }),
    ]);
    const candidates: Candidate[] = [];
    invoices.filter((invoice) => invoice.customer?.projects.length).forEach((invoice) => candidates.push({ type: 'overdue_invoice_active_delivery', severity: 'high', title: 'Overdue invoice while delivery is active', explanation: `${invoice.number} is overdue while this customer still has active project work.`, entityType: 'Invoice', entityId: invoice.id, customerId: invoice.customerId, departmentId: invoice.departmentId, ownerId: invoice.ownerId, observedHours: (now.getTime() - invoice.updatedAt.getTime()) / 3600000, evidence: [{ sourceType: 'Invoice', sourceId: invoice.id, metric: 'invoice_status', observedValue: 'overdue', expectedValue: 'paid' }] }));
    tickets.forEach((ticket) => candidates.push({ type: 'ticket_past_target', severity: ticket.priority === 'urgent' ? 'critical' : 'high', title: 'Support ticket needs a response', explanation: `${ticket.subject} has remained open beyond its department target.`, entityType: 'Ticket', entityId: ticket.id, customerId: ticket.customerId, departmentId: ticket.departmentId, ownerId: ticket.assigneeId, observedHours: (now.getTime() - ticket.createdAt.getTime()) / 3600000, evidence: [{ sourceType: 'Ticket', sourceId: ticket.id, metric: 'hours_open', observedValue: String(Math.floor((now.getTime() - ticket.createdAt.getTime()) / 3600000)), expectedValue: '< department target' }] }));
    milestones.forEach((milestone) => candidates.push({ type: 'milestone_slip', severity: 'high', title: 'Milestone slipped', explanation: `${milestone.name} is past its committed due date.`, entityType: 'Project', entityId: milestone.projectId, customerId: milestone.project.customerId, departmentId: milestone.project.departmentId, ownerId: milestone.project.ownerId, dueAt: milestone.dueDate ?? undefined, observedHours: milestone.dueDate ? (now.getTime() - milestone.dueDate.getTime()) / 3600000 : 0, evidence: [{ sourceType: 'TaskMilestone', sourceId: milestone.id, metric: 'due_date', observedValue: milestone.dueDate?.toISOString() ?? '', expectedValue: 'completed' }] }));
    completedTasks.filter((task) => task.customer && task.customer.invoices.length === 0).forEach((task) => candidates.push({ type: 'completed_work_billing_blocker', severity: 'medium', title: 'Completed work has no billing record', explanation: `${task.title} is complete for a customer project with no invoice recorded.`, entityType: 'Task', entityId: task.id, customerId: task.customerId, departmentId: task.departmentId, ownerId: task.assigneeId, evidence: [{ sourceType: 'Task', sourceId: task.id, metric: 'task_status', observedValue: 'completed', expectedValue: 'invoice_linked' }] }));
    projects.filter((project) => (now.getTime() - project.updatedAt.getTime()) / 3600000 >= 14 * 24).forEach((project) => candidates.push({ type: 'customer_inactivity_active_project', severity: 'medium', title: 'Active project has gone quiet', explanation: `${project.name} has had no recorded activity beyond the department target.`, entityType: 'Project', entityId: project.id, customerId: project.customerId, departmentId: project.departmentId, ownerId: project.ownerId, observedHours: (now.getTime() - project.updatedAt.getTime()) / 3600000, evidence: [{ sourceType: 'Project', sourceId: project.id, metric: 'hours_since_activity', observedValue: String(Math.floor((now.getTime() - project.updatedAt.getTime()) / 3600000)), expectedValue: '< department target' }] }));
    for (const candidate of candidates) {
      const rule = rules.find((item) => item.type === candidate.type && item.departmentId === candidate.departmentId);
      if (rule && !rule.enabled) continue;
      const threshold = rule?.thresholdHours ?? DEFAULT_THRESHOLDS[candidate.type];
      if (threshold !== undefined && candidate.observedHours !== undefined && candidate.observedHours < threshold) continue;
      await this.upsertCandidate(candidate, rule?.cooldownHours ?? 24);
    }
  }

  private async upsertCandidate(candidate: Candidate, cooldownHours: number) {
    const existing = await this.prisma.operationalSignal.findFirst({ where: { type: candidate.type, entityId: candidate.entityId, status: 'open', departmentId: candidate.departmentId } });
    if (existing) return;
    const recentlyClosed = await this.prisma.operationalSignal.findFirst({ where: { type: candidate.type, entityId: candidate.entityId, departmentId: candidate.departmentId, status: { in: ['resolved', 'dismissed'] }, resolvedAt: { gte: new Date(Date.now() - cooldownHours * 3600000) } } });
    if (recentlyClosed) return;
    await this.prisma.operationalSignal.create({ data: { type: candidate.type, severity: candidate.severity, title: candidate.title, explanation: candidate.explanation, entityType: candidate.entityType, entityId: candidate.entityId, customerId: candidate.customerId ?? undefined, departmentId: candidate.departmentId, ownerId: candidate.ownerId ?? undefined, dueAt: candidate.dueAt, evidence: { create: candidate.evidence } } });
  }
}
