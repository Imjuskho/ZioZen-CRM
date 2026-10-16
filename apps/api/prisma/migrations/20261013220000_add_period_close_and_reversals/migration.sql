CREATE TABLE "AccountingPeriod" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "departmentId" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "JournalEntry" ADD COLUMN "accountingPeriodId" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "reversalOfId" TEXT;

CREATE UNIQUE INDEX "AccountingPeriod_departmentId_name_key" ON "AccountingPeriod"("departmentId", "name");
CREATE INDEX "AccountingPeriod_departmentId_startDate_endDate_idx" ON "AccountingPeriod"("departmentId", "startDate", "endDate");
CREATE INDEX "JournalEntry_accountingPeriodId_idx" ON "JournalEntry"("accountingPeriodId");
CREATE INDEX "JournalEntry_reversalOfId_idx" ON "JournalEntry"("reversalOfId");

ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
