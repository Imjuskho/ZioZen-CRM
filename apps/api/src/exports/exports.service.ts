import { Injectable, ForbiddenException, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Queue, Worker, Job } from 'bullmq';
import { AuditService } from '../audit/audit.service.js';
import { getUserScope } from '../common/department-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';

type ExportQueuePayload = { exportJobId: string };
type RedisConnection = { host: string; port: number; password?: string; maxRetriesPerRequest: null; enableReadyCheck: false };
type ExportJobPublic = { id: string; organizationId: string; requestedById: string; includeAudit: boolean; status: string; progress: number; recordCount: number; error: string | null; startedAt: Date | null; completedAt: Date | null; createdAt: Date; updatedAt: Date; downloadReady: boolean };

@Injectable()
export class ExportsService implements OnModuleDestroy {
  private readonly redis: RedisConnection;
  private readonly queue: Queue<ExportQueuePayload>;
  private readonly worker: Worker<ExportQueuePayload>;

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const parsedRedisUrl = new URL(redisUrl);
    this.redis = { host: parsedRedisUrl.hostname, port: Number(parsedRedisUrl.port || 6379), password: parsedRedisUrl.password || undefined, maxRetriesPerRequest: null, enableReadyCheck: false };
    this.queue = new Queue<ExportQueuePayload>('tenant-exports', { connection: this.redis });
    this.worker = new Worker<ExportQueuePayload>('tenant-exports', async (job) => this.processJob(job), { connection: this.redis, concurrency: 2 });
    this.worker.on('failed', (job, error) => { if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void this.markFailedAfterQueueRetries(job.data.exportJobId, error); });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }

  private async organizationIdFor(userId: string) {
    const scope = await getUserScope(this.prisma, userId);
    if (!scope.organizationId) throw new ForbiddenException('Tenant export requires an organization');
    return scope.organizationId;
  }

  private async setProgress(jobId: string | undefined, progress: number) {
    if (jobId) await this.prisma.exportJob.update({ where: { id: jobId }, data: { progress } });
  }

  private async buildTenantExport(organizationId: string, includeAudit: boolean, jobId?: string) {
    const departmentWhere = { department: { organizationId } };
    await this.setProgress(jobId, 10);
    const [organization, users, departments] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true, legalName: true, defaultCurrency: true, timezone: true, locale: true, dateFormat: true, fiscalYearStartMonth: true, createdAt: true, updatedAt: true } }),
      this.prisma.user.findMany({ where: { organizationId }, select: { id: true, email: true, firstName: true, lastName: true, role: true, active: true, createdAt: true, updatedAt: true } }),
      this.prisma.department.findMany({ where: { organizationId }, select: { id: true, name: true, slug: true, description: true, createdAt: true, updatedAt: true } }),
    ]);
    await this.setProgress(jobId, 30);
    const [customers, projects, tasks] = await Promise.all([
      this.prisma.customer.findMany({ where: departmentWhere, select: { id: true, name: true, email: true, phone: true, company: true, departmentId: true, createdAt: true, updatedAt: true } }),
      this.prisma.project.findMany({ where: departmentWhere, select: { id: true, name: true, description: true, status: true, departmentId: true, customerId: true, createdAt: true, updatedAt: true } }),
      this.prisma.task.findMany({ where: departmentWhere, select: { id: true, title: true, description: true, status: true, priority: true, departmentId: true, projectId: true, customerId: true, createdAt: true, updatedAt: true } }),
    ]);
    await this.setProgress(jobId, 50);
    const [invoices, tickets, employees] = await Promise.all([
      this.prisma.invoice.findMany({ where: departmentWhere, select: { id: true, number: true, amount: true, status: true, currency: true, departmentId: true, customerId: true, createdAt: true, updatedAt: true, payments: { select: { id: true, amount: true, currency: true, method: true, paymentDate: true, transactionId: true } } } }),
      this.prisma.ticket.findMany({ where: departmentWhere, select: { id: true, subject: true, message: true, status: true, priority: true, departmentId: true, customerId: true, createdAt: true, updatedAt: true } }),
      this.prisma.employeeProfile.findMany({ where: departmentWhere, select: { id: true, userId: true, jobTitle: true, employmentType: true, hourlyRate: true, salary: true, startDate: true, departmentId: true, createdAt: true, updatedAt: true } }),
    ]);
    await this.setProgress(jobId, 70);
    const [payrollBatches, auditLogs] = await Promise.all([
      this.prisma.payrollBatch.findMany({ where: departmentWhere, select: { id: true, name: true, status: true, periodStart: true, periodEnd: true, departmentId: true, approvedById: true, approvedAt: true, lockedAt: true, exportedAt: true, exportReference: true, createdAt: true, updatedAt: true, payslips: { select: { id: true, employeeId: true, periodStart: true, periodEnd: true, grossAmount: true, bonusAmount: true, deductionAmount: true, netAmount: true, status: true } } } }),
      includeAudit ? this.prisma.auditLog.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' }, take: 5000, select: { id: true, requestId: true, ipAddress: true, userAgent: true, action: true, entityType: true, entityId: true, departmentId: true, metadata: true, actorId: true, createdAt: true } }) : Promise.resolve([]),
    ]);
    await this.setProgress(jobId, 90);
    const counts = { users: users.length, departments: departments.length, customers: customers.length, projects: projects.length, tasks: tasks.length, invoices: invoices.length, tickets: tickets.length, employees: employees.length, payrollBatches: payrollBatches.length, auditLogs: auditLogs.length };
    const payload = { schemaVersion: '2026-10-14', exportedAt: new Date().toISOString(), organization, users, departments, customers, projects, tasks, invoices, tickets, employees, payrollBatches, auditLogs: includeAudit ? auditLogs : undefined, counts };
    await this.setProgress(jobId, 95);
    return { payload: JSON.parse(JSON.stringify(payload)), counts };
  }

  async tenantExport(userId: string, includeAudit = true) {
    const organizationId = await this.organizationIdFor(userId);
    const result = await this.buildTenantExport(organizationId, includeAudit);
    await this.audit.log({ action: 'TENANT_EXPORT_CREATED', entityType: 'OrganizationExport', entityId: organizationId, actorId: userId, organizationId, metadata: { includeAudit, counts: result.counts, mode: 'synchronous' } });
    return result.payload;
  }

  async createTenantExportJob(userId: string, includeAudit = true) {
    const organizationId = await this.organizationIdFor(userId);
    const job = await this.prisma.exportJob.create({ data: { organizationId, requestedById: userId, includeAudit, status: 'queued', progress: 0 } });
    await this.queue.add('tenant-export', { exportJobId: job.id }, { jobId: job.id, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 1000 } });
    return this.publicJob(job);
  }

  private publicJob(job: { id: string; organizationId: string; requestedById: string; includeAudit: boolean; status: string; progress: number; recordCount: number; error: string | null; startedAt: Date | null; completedAt: Date | null; createdAt: Date; updatedAt: Date }): ExportJobPublic {
    return { id: job.id, organizationId: job.organizationId, requestedById: job.requestedById, includeAudit: job.includeAudit, status: job.status, progress: job.progress, recordCount: job.recordCount, error: job.error, startedAt: job.startedAt, completedAt: job.completedAt, createdAt: job.createdAt, updatedAt: job.updatedAt, downloadReady: job.status === 'completed' };
  }

  private async processJob(job: Job<ExportQueuePayload>) {
    const exportJobId = job.data.exportJobId;
    const record = await this.prisma.exportJob.findUnique({ where: { id: exportJobId } });
    if (!record) return;
    try {
      await this.prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'running', progress: 5, startedAt: new Date(), error: null } });
      const result = await this.buildTenantExport(record.organizationId, record.includeAudit, exportJobId);
      const recordCount = Object.values(result.counts).reduce((sum, count) => sum + count, 0);
      await this.prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'completed', progress: 100, recordCount, payload: result.payload, completedAt: new Date() } });
      await this.audit.log({ action: 'TENANT_EXPORT_CREATED', entityType: 'ExportJob', entityId: exportJobId, actorId: record.requestedById, organizationId: record.organizationId, metadata: { includeAudit: record.includeAudit, counts: result.counts, mode: 'bullmq', attempts: job.attemptsMade + 1 } });
      await this.notifyExport(record, 'tenant_export.completed', result.counts);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export job failed';
      const finalAttempt = (job.opts.attempts ?? 1) <= job.attemptsMade + 1;
      await this.prisma.exportJob.update({ where: { id: exportJobId }, data: { status: finalAttempt ? 'failed' : 'queued', error: message, completedAt: finalAttempt ? new Date() : null } });
      if (finalAttempt) await this.notifyExport(record, 'tenant_export.failed', { error: message });
      throw error;
    }
  }

  private async markFailedAfterQueueRetries(exportJobId: string, error: Error) {
    const job = await this.prisma.exportJob.findUnique({ where: { id: exportJobId } });
    if (job && job.status !== 'failed' && job.status !== 'completed') await this.prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'failed', error: error.message, completedAt: new Date() } });
  }

  private async notifyExport(job: { id: string; organizationId: string; requestedById: string; includeAudit: boolean }, event: string, data: Record<string, unknown>) {
    const hooks = await this.prisma.webhook.findMany({ where: { active: true, events: { has: event }, owner: { organizationId: job.organizationId } }, select: { id: true, url: true, secret: true } });
    const body = JSON.stringify({ event, exportJobId: job.id, organizationId: job.organizationId, requestedById: job.requestedById, includeAudit: job.includeAudit, data, occurredAt: new Date().toISOString() });
    await Promise.allSettled(hooks.map(async (hook) => {
      const headers: Record<string, string> = { 'content-type': 'application/json', 'user-agent': 'ziozen-crm-export-worker/1.0' };
      if (hook.secret) headers['x-ziozen-signature'] = createHmac('sha256', hook.secret).update(body).digest('hex');
      try {
        const response = await fetch(hook.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
        await this.audit.log({ action: response.ok ? 'EXPORT_NOTIFICATION_DELIVERED' : 'EXPORT_NOTIFICATION_FAILED', entityType: 'ExportJob', entityId: job.id, actorId: job.requestedById, organizationId: job.organizationId, metadata: { event, webhookId: hook.id, statusCode: response.status } });
      } catch (error) {
        await this.audit.log({ action: 'EXPORT_NOTIFICATION_FAILED', entityType: 'ExportJob', entityId: job.id, actorId: job.requestedById, organizationId: job.organizationId, metadata: { event, webhookId: hook.id, error: error instanceof Error ? error.message : 'Webhook delivery failed' } });
      }
    }));
  }

  private async getJobForUser(userId: string, jobId: string) {
    const organizationId = await this.organizationIdFor(userId);
    const job = await this.prisma.exportJob.findFirst({ where: { id: jobId, organizationId } });
    if (!job) throw new NotFoundException('Export job not found');
    return job;
  }

  async listTenantExportJobs(userId: string) {
    const organizationId = await this.organizationIdFor(userId);
    const jobs = await this.prisma.exportJob.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return jobs.map((job) => this.publicJob(job));
  }

  async getTenantExportJob(userId: string, jobId: string) { return this.publicJob(await this.getJobForUser(userId, jobId)); }

  async downloadTenantExportJob(userId: string, jobId: string) {
    const job = await this.getJobForUser(userId, jobId);
    if (job.status !== 'completed' || !job.payload) throw new ForbiddenException('Export package is not ready');
    return job.payload;
  }
}
