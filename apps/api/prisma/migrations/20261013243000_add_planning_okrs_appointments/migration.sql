CREATE TABLE "RecurringTask" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "frequency" TEXT NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "departmentId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecurringTask_departmentId_active_nextRunAt_idx" ON "RecurringTask"("departmentId", "active", "nextRunAt");
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Goal" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "departmentId" TEXT NOT NULL,
  "ownerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Goal_departmentId_status_idx" ON "Goal"("departmentId", "status");
CREATE INDEX "Goal_ownerId_idx" ON "Goal"("ownerId");
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "KeyResult" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "target" DECIMAL(15,2) NOT NULL,
  "current" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL DEFAULT 'count',
  "status" TEXT NOT NULL DEFAULT 'on_track',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KeyResult_goalId_status_idx" ON "KeyResult"("goalId", "status");
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "location" TEXT,
  "departmentId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "customerId" TEXT,
  "attendees" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Appointment_departmentId_startsAt_idx" ON "Appointment"("departmentId", "startsAt");
CREATE INDEX "Appointment_ownerId_startsAt_idx" ON "Appointment"("ownerId", "startsAt");
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
