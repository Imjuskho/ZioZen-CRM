CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Department" ADD COLUMN "organizationId" TEXT;

CREATE TABLE "AccessGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "departmentId" TEXT,
  "organizationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessGrant_userId_permission_idx" ON "AccessGrant"("userId", "permission");
CREATE INDEX "AccessGrant_organizationId_permission_idx" ON "AccessGrant"("organizationId", "permission");
CREATE INDEX "AccessGrant_departmentId_permission_idx" ON "AccessGrant"("departmentId", "permission");

INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
VALUES ('org_legacy_default', 'Legacy workspace', 'legacy-workspace', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Department" SET "organizationId" = 'org_legacy_default' WHERE "organizationId" IS NULL;
UPDATE "User" SET "organizationId" = 'org_legacy_default' WHERE "organizationId" IS NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");
