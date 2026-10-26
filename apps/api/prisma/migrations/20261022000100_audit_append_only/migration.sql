-- Audit log is append-only. Rows can only be removed by the retention job, which opts in with
--   SET LOCAL app.allow_audit_purge = 'on';
-- inside its own transaction. Updates are never allowed.
CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.allow_audit_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only (% blocked)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_guard();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_guard();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_guard();

-- Default delay categories (admins can rename/deactivate them in the app).
INSERT INTO "delay_category" ("id", "name", "description", "active", "updated_at") VALUES
  (gen_random_uuid(), 'Dependency on another team', 'Waiting for another team, service or deliverable', true, now()),
  (gen_random_uuid(), 'Requirement change', 'Scope or acceptance criteria changed after work started', true, now()),
  (gen_random_uuid(), 'Unclear requirements', 'Story was not ready; clarification needed during the sprint', true, now()),
  (gen_random_uuid(), 'Underestimated complexity', 'Technical work was larger than estimated', true, now()),
  (gen_random_uuid(), 'Environment / infrastructure issue', 'Build, test environment or infrastructure blocked progress', true, now()),
  (gen_random_uuid(), 'Resource unavailable', 'Leave, sickness or reallocation to other work', true, now()),
  (gen_random_uuid(), 'Defects / rework', 'Bugs found in testing or review required rework', true, now()),
  (gen_random_uuid(), 'Waiting for review or approval', 'Code review, sign-off or approval took longer than expected', true, now()),
  (gen_random_uuid(), 'External vendor', 'Waiting on a third-party vendor or customer', true, now()),
  (gen_random_uuid(), 'Other', 'Anything not covered above (explain in the comment)', true, now())
ON CONFLICT ("name") DO NOTHING;
