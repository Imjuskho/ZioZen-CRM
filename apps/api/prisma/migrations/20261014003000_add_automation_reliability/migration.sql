ALTER TABLE "AutomationRun" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AutomationRun" ADD COLUMN "nextRetryAt" TIMESTAMP(3);
ALTER TABLE "AutomationRun" ADD COLUMN "deadLetteredAt" TIMESTAMP(3);
CREATE INDEX "AutomationRun_status_nextRetryAt_idx" ON "AutomationRun"("status", "nextRetryAt");
