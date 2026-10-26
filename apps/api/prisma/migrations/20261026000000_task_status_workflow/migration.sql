-- Design workflow statuses: upcoming → started → in progress → approval pending → completed, plus reopened.
ALTER TABLE "task" DROP CONSTRAINT "task_status_check";
UPDATE "task" SET "status" = CASE "status"
    WHEN 'queued' THEN 'upcoming'
    WHEN 'blocked' THEN 'in_progress'
    WHEN 'done' THEN 'completed'
    ELSE "status" END;
ALTER TABLE "task" ALTER COLUMN "status" SET DEFAULT 'upcoming';
ALTER TABLE "task" ADD CONSTRAINT "task_status_check"
    CHECK ("status" IN ('upcoming', 'started', 'in_progress', 'approval_pending', 'completed', 'reopened'));
