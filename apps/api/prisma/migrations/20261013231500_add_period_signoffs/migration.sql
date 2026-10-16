CREATE TABLE "PeriodSignOff" (
  "id" TEXT NOT NULL,
  "accountingPeriodId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "note" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PeriodSignOff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PeriodSignOff_accountingPeriodId_createdAt_idx" ON "PeriodSignOff"("accountingPeriodId", "createdAt");
ALTER TABLE "PeriodSignOff" ADD CONSTRAINT "PeriodSignOff_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeriodSignOff" ADD CONSTRAINT "PeriodSignOff_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
