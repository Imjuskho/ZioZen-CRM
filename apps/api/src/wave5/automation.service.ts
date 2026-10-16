import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { ensureDepartmentAccess, getUserScope } from '../common/department-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AutomationEventDto, CreateAutomationRuleDto } from './wave5.dto.js';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 30_000;

@Injectable()
export class AutomationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async rules(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.automationRule.findMany({ where: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } }, select: { id: true, name: true, eventType: true, enabled: true, conditions: true, action: true, departmentId: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' } });
  }

  async createRule(userId: string, dto: CreateAutomationRuleDto) {
    const scope = await getUserScope(this.prisma, userId); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const actionType = dto.action.type;
    if (typeof actionType !== 'string' || !['CREATE_SIGNAL', 'CREATE_TASK'].includes(actionType)) throw new BadRequestException('Unsupported automation action');
    const rule = await this.prisma.automationRule.create({ data: { name: dto.name.trim(), eventType: dto.eventType, enabled: dto.enabled ?? true, conditions: dto.conditions as Prisma.InputJsonValue | undefined, action: dto.action as Prisma.InputJsonValue, departmentId: dto.departmentId, createdById: userId } });
    await this.audit.log({ action: 'AUTOMATION_RULE_CREATED', entityType: 'AutomationRule', entityId: rule.id, departmentId: dto.departmentId, actorId: userId, metadata: { eventType: rule.eventType, actionType } });
    return rule;
  }

  async runs(userId: string, departmentId?: string) {
    const scope = await getUserScope(this.prisma, userId); if (departmentId) ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, departmentId);
    return this.prisma.automationRun.findMany({ where: { rule: departmentId ? { departmentId } : scope.isAdmin ? {} : { departmentId: { in: scope.departmentIds } } }, include: { rule: { select: { id: true, name: true, eventType: true, departmentId: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async ingest(userId: string, dto: AutomationEventDto) {
    const scope = await getUserScope(this.prisma, userId); ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, dto.departmentId);
    const rules = await this.prisma.automationRule.findMany({ where: { departmentId: dto.departmentId, eventType: dto.eventType, enabled: true } });
    const matching = rules.filter((rule) => this.matches(rule.conditions, dto.payload));
    const results: Array<{ ruleId: string; status: string; result?: unknown; attempts?: number; nextRetryAt?: Date | null }> = [];
    for (const rule of matching) results.push(await this.processEvent(userId, rule, dto));
    return { eventId: dto.eventId, matchedRules: matching.length, results };
  }

  async retryRun(userId: string, runId: string) {
    const scope = await getUserScope(this.prisma, userId);
    const run = await this.prisma.automationRun.findUnique({ where: { id: runId }, include: { rule: true } });
    if (!run) throw new NotFoundException('Automation run not found');
    ensureDepartmentAccess(scope.isAdmin, scope.departmentIds, run.rule.departmentId);
    if (!['failed', 'dead_lettered'].includes(run.status)) throw new BadRequestException('Only failed or dead-lettered runs can be replayed');
    if (run.attempts >= MAX_ATTEMPTS && run.status === 'dead_lettered') {
      await this.prisma.automationRun.update({ where: { id: run.id }, data: { status: 'retrying', attempts: 0, deadLetteredAt: null, nextRetryAt: null } });
    }
    const result = await this.processEvent(userId, run.rule, { eventId: run.eventId, eventType: run.rule.eventType, departmentId: run.rule.departmentId, payload: run.eventPayload as Record<string, unknown> }, true);
    await this.audit.log({ action: 'AUTOMATION_RUN_REPLAYED', entityType: 'AutomationRun', entityId: run.id, departmentId: run.rule.departmentId, actorId: userId, metadata: { attempts: result.attempts, status: result.status } });
    return result;
  }

  private async processEvent(userId: string, rule: { id: string; eventType: string; departmentId: string; action: Prisma.JsonValue }, dto: AutomationEventDto, force = false) {
    try {
      const run = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.automationRun.findUnique({ where: { ruleId_eventId: { ruleId: rule.id, eventId: dto.eventId } } });
        if (existing?.status === 'completed') return existing;
        if (!force && existing?.status === 'failed' && existing.nextRetryAt && existing.nextRetryAt > new Date()) return existing;
        if (existing?.status === 'dead_lettered' && existing.attempts >= MAX_ATTEMPTS) return existing;
        const attempts = (existing?.attempts ?? 0) + 1;
        const result = await this.executeAction(tx, rule.action, dto);
        if (existing) return tx.automationRun.update({ where: { id: existing.id }, data: { status: 'completed', attempts, nextRetryAt: null, deadLetteredAt: null, error: null, result: result as Prisma.InputJsonValue } });
        return tx.automationRun.create({ data: { ruleId: rule.id, eventId: dto.eventId, eventPayload: dto.payload as Prisma.InputJsonValue, status: 'completed', attempts, result: result as Prisma.InputJsonValue } });
      });
      await this.audit.log({ action: 'AUTOMATION_EVENT_PROCESSED', entityType: 'AutomationRun', entityId: run.id, departmentId: dto.departmentId, actorId: userId, metadata: { ruleId: rule.id, eventId: dto.eventId, eventType: dto.eventType, attempts: run.attempts } });
      return { ruleId: rule.id, status: run.status, result: run.result, attempts: run.attempts, nextRetryAt: run.nextRetryAt };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Automation event is already being processed');
      const message = error instanceof Error ? error.message : 'Automation action failed';
      const failed = await this.prisma.automationRun.findUnique({ where: { ruleId_eventId: { ruleId: rule.id, eventId: dto.eventId } } });
      const attempts = (failed?.attempts ?? 0) + 1;
      const deadLettered = attempts >= MAX_ATTEMPTS;
      const nextRetryAt = deadLettered ? null : new Date(Date.now() + RETRY_BASE_MS * (2 ** (attempts - 1)));
      const run = failed
        ? await this.prisma.automationRun.update({ where: { id: failed.id }, data: { status: deadLettered ? 'dead_lettered' : 'failed', attempts, error: message, nextRetryAt, deadLetteredAt: deadLettered ? new Date() : null } })
        : await this.prisma.automationRun.create({ data: { ruleId: rule.id, eventId: dto.eventId, eventPayload: dto.payload as Prisma.InputJsonValue, status: deadLettered ? 'dead_lettered' : 'failed', attempts, error: message, nextRetryAt, deadLetteredAt: deadLettered ? new Date() : null } });
      await this.audit.log({ action: deadLettered ? 'AUTOMATION_RUN_DEAD_LETTERED' : 'AUTOMATION_RUN_FAILED', entityType: 'AutomationRun', entityId: run.id, departmentId: dto.departmentId, actorId: userId, metadata: { ruleId: rule.id, eventId: dto.eventId, attempts, nextRetryAt } });
      return { ruleId: rule.id, status: run.status, result: run.error, attempts: run.attempts, nextRetryAt: run.nextRetryAt };
    }
  }

  private matches(conditions: Prisma.JsonValue | null, payload: Record<string, unknown>) {
    if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return true;
    return Object.entries(conditions).every(([key, expected]) => payload[key] === expected);
  }

  private async executeAction(tx: Prisma.TransactionClient, action: Prisma.JsonValue, event: AutomationEventDto) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new BadRequestException('Automation action must be an object');
    const input = action as Record<string, unknown>; const type = input.type;
    if (type === 'CREATE_SIGNAL') {
      const signal = await tx.operationalSignal.create({ data: { type: String(input.signalType ?? event.eventType), severity: String(input.severity ?? 'medium'), title: String(input.title ?? event.payload.title ?? 'Automation signal'), explanation: String(input.explanation ?? event.payload.explanation ?? 'Created by an automation rule.'), entityType: String(input.entityType ?? event.payload.entityType ?? 'AutomationEvent'), entityId: String(input.entityId ?? event.payload.entityId ?? event.eventId), customerId: typeof event.payload.customerId === 'string' ? event.payload.customerId : undefined, departmentId: event.departmentId } });
      return { type, signalId: signal.id };
    }
    if (type === 'CREATE_TASK') {
      const task = await tx.task.create({ data: { title: String(input.title ?? event.payload.title ?? 'Automation task'), description: typeof input.description === 'string' ? input.description : undefined, departmentId: event.departmentId, customerId: typeof event.payload.customerId === 'string' ? event.payload.customerId : undefined, assigneeId: typeof input.assigneeId === 'string' ? input.assigneeId : undefined } });
      return { type, taskId: task.id };
    }
    throw new BadRequestException('Unsupported automation action');
  }
}
