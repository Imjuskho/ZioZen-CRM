ALTER TABLE "PayrollBatch" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "PayrollBatch" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "PayrollBatch" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "PayrollBatch" ADD COLUMN "exportedAt" TIMESTAMP(3);
ALTER TABLE "PayrollBatch" ADD COLUMN "exportReference" TEXT;
CREATE INDEX "PayrollBatch_status_departmentId_idx" ON "PayrollBatch"("status", "departmentId");
