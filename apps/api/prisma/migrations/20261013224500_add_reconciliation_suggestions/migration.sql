ALTER TABLE "BankTransaction" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "BankTransaction" ADD COLUMN "rawData" JSONB;

CREATE TABLE "ReconciliationSuggestion" (
  "id" TEXT NOT NULL,
  "bankTransactionId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconciliationSuggestion_bankTransactionId_journalEntryId_key" ON "ReconciliationSuggestion"("bankTransactionId", "journalEntryId");
CREATE INDEX "ReconciliationSuggestion_bankTransactionId_status_idx" ON "ReconciliationSuggestion"("bankTransactionId", "status");

ALTER TABLE "ReconciliationSuggestion" ADD CONSTRAINT "ReconciliationSuggestion_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationSuggestion" ADD CONSTRAINT "ReconciliationSuggestion_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationSuggestion" ADD CONSTRAINT "ReconciliationSuggestion_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
