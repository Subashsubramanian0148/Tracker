-- A person said a tagged comment isn't really a signal (e.g. "Not a blocker").
CREATE TABLE "comment_signal_override" (
    "work_item_id" INTEGER NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "ignored_by_id" TEXT NOT NULL,
    "ignored_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comment_signal_override_pkey" PRIMARY KEY ("work_item_id", "comment_id")
);
CREATE INDEX "comment_signal_override_project_id_idx" ON "comment_signal_override"("project_id");
ALTER TABLE "comment_signal_override" ADD CONSTRAINT "comment_signal_override_work_item_id_fkey"
    FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The team agreed an item wasn't really late (planned). Flags stay; it leaves the late count.
CREATE TABLE "delay_dismissal" (
    "work_item_id" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "dismissed_by_id" TEXT NOT NULL,
    "dismissed_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delay_dismissal_pkey" PRIMARY KEY ("work_item_id")
);
ALTER TABLE "delay_dismissal" ADD CONSTRAINT "delay_dismissal_work_item_id_fkey"
    FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Files attached to the item in Azure DevOps (links only; files stay in Azure DevOps).
CREATE TABLE "work_item_attachment" (
    "work_item_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size_bytes" INTEGER,
    CONSTRAINT "work_item_attachment_pkey" PRIMARY KEY ("work_item_id", "url")
);
ALTER TABLE "work_item_attachment" ADD CONSTRAINT "work_item_attachment_work_item_id_fkey"
    FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
