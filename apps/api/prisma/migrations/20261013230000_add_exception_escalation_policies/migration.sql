ALTER TABLE "FinanceException" ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FinanceException" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "FinanceException" ADD COLUMN "escalatedToId" TEXT;

CREATE TABLE "FinanceExceptionPolicy" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "type" TEXT,
  "severity" TEXT,
  "thresholdHours" INTEGER NOT NULL,
  "assigneeId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceExceptionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceExceptionPolicy_departmentId_active_idx" ON "FinanceExceptionPolicy"("departmentId", "active");
ALTER TABLE "FinanceException" ADD CONSTRAINT "FinanceException_escalatedToId_fkey" FOREIGN KEY ("escalatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceExceptionPolicy" ADD CONSTRAINT "FinanceExceptionPolicy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceExceptionPolicy" ADD CONSTRAINT "FinanceExceptionPolicy_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
