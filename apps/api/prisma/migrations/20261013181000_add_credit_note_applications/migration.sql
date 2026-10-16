CREATE TABLE "CreditNoteApplication" (
  "id" TEXT NOT NULL,
  "creditNoteId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  CONSTRAINT "CreditNoteApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreditNoteApplication_creditNoteId_idx" ON "CreditNoteApplication"("creditNoteId");
CREATE INDEX "CreditNoteApplication_invoiceId_idx" ON "CreditNoteApplication"("invoiceId");
CREATE INDEX "CreditNoteApplication_appliedAt_idx" ON "CreditNoteApplication"("appliedAt");

ALTER TABLE "CreditNoteApplication" ADD CONSTRAINT "CreditNoteApplication_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditNoteApplication" ADD CONSTRAINT "CreditNoteApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditNoteApplication" ADD CONSTRAINT "CreditNoteApplication_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
