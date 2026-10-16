CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "conditions" JSONB,
  "action" JSONB NOT NULL,
  "departmentId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutomationRule_departmentId_eventType_enabled_idx" ON "AutomationRule"("departmentId", "eventType", "enabled");
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventPayload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomationRun_ruleId_eventId_key" ON "AutomationRun"("ruleId", "eventId");
CREATE INDEX "AutomationRun_createdAt_idx" ON "AutomationRun"("createdAt");
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InboxChannel" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "departmentId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxChannel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InboxChannel_channel_departmentId_key" ON "InboxChannel"("channel", "departmentId");
CREATE INDEX "InboxChannel_departmentId_active_idx" ON "InboxChannel"("departmentId", "active");
ALTER TABLE "InboxChannel" ADD CONSTRAINT "InboxChannel_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InboxThread" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "externalId" TEXT,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "externalEmail" TEXT,
  "externalPhone" TEXT,
  "departmentId" TEXT NOT NULL,
  "customerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InboxThread_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InboxThread_departmentId_status_idx" ON "InboxThread"("departmentId", "status");
CREATE INDEX "InboxThread_customerId_idx" ON "InboxThread"("customerId");
CREATE INDEX "InboxThread_channel_externalId_idx" ON "InboxThread"("channel", "externalId");
ALTER TABLE "InboxThread" ADD CONSTRAINT "InboxThread_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxThread" ADD CONSTRAINT "InboxThread_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InboxMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "externalId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InboxMessage_threadId_externalId_key" ON "InboxMessage"("threadId", "externalId");
CREATE INDEX "InboxMessage_threadId_createdAt_idx" ON "InboxMessage"("threadId", "createdAt");
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
