CREATE TABLE "CustomerPortalAccount" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerPortalAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerPortalAccount_customerId_key" ON "CustomerPortalAccount"("customerId");
CREATE UNIQUE INDEX "CustomerPortalAccount_email_key" ON "CustomerPortalAccount"("email");
CREATE INDEX "CustomerPortalAccount_active_idx" ON "CustomerPortalAccount"("active");
ALTER TABLE "CustomerPortalAccount" ADD CONSTRAINT "CustomerPortalAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
