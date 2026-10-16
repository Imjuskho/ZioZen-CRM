CREATE TABLE "ReconciliationSession" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "statementStart" TIMESTAMP(3) NOT NULL,
  "statementEnd" TIMESTAMP(3) NOT NULL,
  "openingBalance" DECIMAL(15,2) NOT NULL,
  "closingBalance" DECIMAL(15,2),
  "status" TEXT NOT NULL DEFAULT 'open',
  "departmentId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "ReconciliationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTransaction" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'unmatched',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationMatch" (
  "id" TEXT NOT NULL,
  "bankTransactionId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "matchedById" TEXT NOT NULL,
  "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceException" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "departmentId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReconciliationSession_departmentId_status_idx" ON "ReconciliationSession"("departmentId", "status");
CREATE INDEX "ReconciliationSession_accountId_statementEnd_idx" ON "ReconciliationSession"("accountId", "statementEnd");
CREATE UNIQUE INDEX "BankTransaction_sessionId_externalId_key" ON "BankTransaction"("sessionId", "externalId");
CREATE INDEX "BankTransaction_sessionId_status_idx" ON "BankTransaction"("sessionId", "status");
CREATE UNIQUE INDEX "ReconciliationMatch_bankTransactionId_key" ON "ReconciliationMatch"("bankTransactionId");
CREATE UNIQUE INDEX "ReconciliationMatch_journalEntryId_key" ON "ReconciliationMatch"("journalEntryId");
CREATE INDEX "FinanceException_departmentId_status_severity_idx" ON "FinanceException"("departmentId", "status", "severity");
CREATE INDEX "FinanceException_entityType_entityId_idx" ON "FinanceException"("entityType", "entityId");

ALTER TABLE "ReconciliationSession" ADD CONSTRAINT "ReconciliationSession_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationSession" ADD CONSTRAINT "ReconciliationSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationSession" ADD CONSTRAINT "ReconciliationSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReconciliationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_matchedById_fkey" FOREIGN KEY ("matchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceException" ADD CONSTRAINT "FinanceException_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceException" ADD CONSTRAINT "FinanceException_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceException" ADD CONSTRAINT "FinanceException_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
