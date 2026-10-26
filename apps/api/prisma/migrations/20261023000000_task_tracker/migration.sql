-- Designer task tracker (Mode 1).
CREATE TABLE "task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "work_item_id" INTEGER,
    "due_date" DATE,
    "estimate_hours" DOUBLE PRECISION,
    "spent_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_status_check" CHECK ("status" IN ('queued', 'in_progress', 'blocked', 'done'))
);

CREATE INDEX "task_owner_id_status_idx" ON "task"("owner_id", "status");
CREATE INDEX "task_status_due_date_idx" ON "task"("status", "due_date");
CREATE INDEX "task_completed_at_idx" ON "task"("completed_at");
