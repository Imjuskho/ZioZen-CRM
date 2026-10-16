-- Add an auditable reason distinct from successful resolution notes.
ALTER TABLE "OperationalSignal" ADD COLUMN "dismissalReason" TEXT;
