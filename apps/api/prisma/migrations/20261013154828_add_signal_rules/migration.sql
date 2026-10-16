-- CreateTable
CREATE TABLE "SignalRule" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdHours" INTEGER,
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignalRule_departmentId_idx" ON "SignalRule"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalRule_type_departmentId_key" ON "SignalRule"("type", "departmentId");

-- AddForeignKey
ALTER TABLE "SignalRule" ADD CONSTRAINT "SignalRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
