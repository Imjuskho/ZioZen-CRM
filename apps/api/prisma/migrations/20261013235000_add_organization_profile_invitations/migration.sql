ALTER TABLE "Organization" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Organization" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "Organization" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE "Organization" ADD COLUMN "dateFormat" TEXT NOT NULL DEFAULT 'yyyy-MM-dd';
ALTER TABLE "Organization" ADD COLUMN "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Organization" ADD COLUMN "businessHours" JSONB;

CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "organizationId" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");
CREATE INDEX "Invitation_organizationId_email_idx" ON "Invitation"("organizationId", "email");
CREATE INDEX "Invitation_token_acceptedAt_idx" ON "Invitation"("token", "acceptedAt");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
