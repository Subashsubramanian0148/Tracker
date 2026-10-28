-- A child story with no sprint of its own takes its parent's sprint.
ALTER TABLE "work_item" ADD COLUMN "parent_iteration_path" TEXT;
