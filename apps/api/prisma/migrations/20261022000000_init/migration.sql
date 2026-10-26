-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "revisions_continuation_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "team_id" UUID NOT NULL,
    "person_id" TEXT NOT NULL,
    "is_team_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("team_id","person_id")
);

-- CreateTable
CREATE TABLE "team_area" (
    "team_id" UUID NOT NULL,
    "area_path" TEXT NOT NULL,
    "include_children" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "team_area_pkey" PRIMARY KEY ("team_id","area_path")
);

-- CreateTable
CREATE TABLE "iteration" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "finish_date" TIMESTAMP(3),

    CONSTRAINT "iteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_iteration" (
    "team_id" UUID NOT NULL,
    "iteration_id" UUID NOT NULL,

    CONSTRAINT "team_iteration_pkey" PRIMARY KEY ("team_id","iteration_id")
);

-- CreateTable
CREATE TABLE "work_item_type_state" (
    "project_id" UUID NOT NULL,
    "work_item_type" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "work_item_type_state_pkey" PRIMARY KEY ("project_id","work_item_type","state")
);

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "unique_name" TEXT NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item" (
    "id" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "state_category" TEXT NOT NULL,
    "reason" TEXT,
    "assigned_to_id" TEXT,
    "iteration_path" TEXT,
    "area_path" TEXT,
    "parent_id" INTEGER,
    "tags" TEXT[],
    "effort" DOUBLE PRECISION,
    "original_estimate" DOUBLE PRECISION,
    "remaining_work" DOUBLE PRECISION,
    "completed_work" DOUBLE PRECISION,
    "description" TEXT,
    "acceptance_criteria" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL,
    "changed_date" TIMESTAMP(3) NOT NULL,
    "rev" INTEGER NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "activated_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "cycle_time_hours" DOUBLE PRECISION,
    "lead_time_hours" DOUBLE PRECISION,
    "blocked_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "initial_effort" DOUBLE PRECISION,
    "initial_remaining" DOUBLE PRECISION,
    "is_delayed" BOOLEAN NOT NULL DEFAULT false,
    "delay_flags" TEXT[],
    "delay_detected_at" TIMESTAMP(3),
    "metrics_computed_at" TIMESTAMP(3),

    CONSTRAINT "work_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item_revision" (
    "work_item_id" INTEGER NOT NULL,
    "rev" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "changed_date" TIMESTAMP(3) NOT NULL,
    "changed_by_id" TEXT,
    "fields" JSONB NOT NULL,

    CONSTRAINT "work_item_revision_pkey" PRIMARY KEY ("work_item_id","rev")
);

-- CreateTable
CREATE TABLE "state_segment" (
    "id" BIGSERIAL NOT NULL,
    "work_item_id" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL,
    "exited_at" TIMESTAMP(3),
    "duration_hours" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "state_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iteration_interval" (
    "id" BIGSERIAL NOT NULL,
    "work_item_id" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "iteration_path" TEXT NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL,
    "exited_at" TIMESTAMP(3),

    CONSTRAINT "iteration_interval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item_change" (
    "id" BIGSERIAL NOT NULL,
    "work_item_id" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "rev" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL,
    "changed_by_id" TEXT,
    "kind" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "after_work_started" BOOLEAN NOT NULL,

    CONSTRAINT "work_item_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delay_category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delay_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delay_reason" (
    "id" UUID NOT NULL,
    "work_item_id" INTEGER NOT NULL,
    "category_id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "impact_days" DOUBLE PRECISION,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMP(3),

    CONSTRAINT "delay_reason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "last_login_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "outcome" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "trace_id" TEXT,
    "details" JSONB,
    "prev_hash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_run" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "items_upserted" INTEGER NOT NULL DEFAULT 0,
    "revisions_upserted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_project_id_idx" ON "team"("project_id");

-- CreateIndex
CREATE INDEX "team_member_person_id_idx" ON "team_member"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "iteration_project_id_path_key" ON "iteration"("project_id", "path");

-- CreateIndex
CREATE INDEX "person_unique_name_idx" ON "person"("unique_name");

-- CreateIndex
CREATE INDEX "work_item_project_id_state_category_idx" ON "work_item"("project_id", "state_category");

-- CreateIndex
CREATE INDEX "work_item_project_id_changed_date_idx" ON "work_item"("project_id", "changed_date");

-- CreateIndex
CREATE INDEX "work_item_project_id_completed_date_idx" ON "work_item"("project_id", "completed_date");

-- CreateIndex
CREATE INDEX "work_item_project_id_iteration_path_idx" ON "work_item"("project_id", "iteration_path");

-- CreateIndex
CREATE INDEX "work_item_project_id_is_delayed_idx" ON "work_item"("project_id", "is_delayed");

-- CreateIndex
CREATE INDEX "work_item_assigned_to_id_idx" ON "work_item"("assigned_to_id");

-- CreateIndex
CREATE INDEX "work_item_parent_id_idx" ON "work_item"("parent_id");

-- CreateIndex
CREATE INDEX "work_item_revision_project_id_changed_date_idx" ON "work_item_revision"("project_id", "changed_date");

-- CreateIndex
CREATE INDEX "state_segment_work_item_id_idx" ON "state_segment"("work_item_id");

-- CreateIndex
CREATE INDEX "state_segment_project_id_entered_at_idx" ON "state_segment"("project_id", "entered_at");

-- CreateIndex
CREATE INDEX "iteration_interval_project_id_iteration_path_idx" ON "iteration_interval"("project_id", "iteration_path");

-- CreateIndex
CREATE INDEX "iteration_interval_work_item_id_idx" ON "iteration_interval"("work_item_id");

-- CreateIndex
CREATE INDEX "work_item_change_work_item_id_idx" ON "work_item_change"("work_item_id");

-- CreateIndex
CREATE INDEX "work_item_change_project_id_changed_at_idx" ON "work_item_change"("project_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "delay_category_name_key" ON "delay_category"("name");

-- CreateIndex
CREATE INDEX "delay_reason_work_item_id_created_at_idx" ON "delay_reason"("work_item_id", "created_at");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- CreateIndex
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_occurred_at_idx" ON "audit_log"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_action_occurred_at_idx" ON "audit_log"("action", "occurred_at");

-- CreateIndex
CREATE INDEX "sync_run_started_at_idx" ON "sync_run"("started_at");

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_area" ADD CONSTRAINT "team_area_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iteration" ADD CONSTRAINT "iteration_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_iteration" ADD CONSTRAINT "team_iteration_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_iteration" ADD CONSTRAINT "team_iteration_iteration_id_fkey" FOREIGN KEY ("iteration_id") REFERENCES "iteration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_type_state" ADD CONSTRAINT "work_item_type_state_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_revision" ADD CONSTRAINT "work_item_revision_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "state_segment" ADD CONSTRAINT "state_segment_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iteration_interval" ADD CONSTRAINT "iteration_interval_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_change" ADD CONSTRAINT "work_item_change_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delay_reason" ADD CONSTRAINT "delay_reason_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delay_reason" ADD CONSTRAINT "delay_reason_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "delay_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

