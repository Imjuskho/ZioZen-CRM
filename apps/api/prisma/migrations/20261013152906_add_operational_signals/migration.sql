-- CreateTable
CREATE TABLE "OperationalSignal" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "customerId" TEXT,
    "departmentId" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalEvidence" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "observedValue" TEXT NOT NULL,
    "expectedValue" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalAction" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actorId" TEXT,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalSignal_departmentId_status_idx" ON "OperationalSignal"("departmentId", "status");

-- CreateIndex
CREATE INDEX "OperationalSignal_entityType_entityId_idx" ON "OperationalSignal"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "OperationalSignal_customerId_idx" ON "OperationalSignal"("customerId");

-- CreateIndex
CREATE INDEX "OperationalSignal_ownerId_idx" ON "OperationalSignal"("ownerId");

-- CreateIndex
CREATE INDEX "SignalEvidence_signalId_idx" ON "SignalEvidence"("signalId");

-- CreateIndex
CREATE INDEX "SignalAction_signalId_idx" ON "SignalAction"("signalId");

-- AddForeignKey
ALTER TABLE "OperationalSignal" ADD CONSTRAINT "OperationalSignal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalSignal" ADD CONSTRAINT "OperationalSignal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalSignal" ADD CONSTRAINT "OperationalSignal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalEvidence" ADD CONSTRAINT "SignalEvidence_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "OperationalSignal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalAction" ADD CONSTRAINT "SignalAction_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "OperationalSignal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
