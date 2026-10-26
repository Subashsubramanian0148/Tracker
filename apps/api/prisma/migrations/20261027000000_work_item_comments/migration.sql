ALTER TABLE "work_item" ADD COLUMN "comment_delay_hours" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "work_item_comment" (
    "work_item_id" INTEGER NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "project_id" UUID NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT NOT NULL,
    "author_unique_name" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "signals" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL,
    "modified_at" TIMESTAMP(3),
    CONSTRAINT "work_item_comment_pkey" PRIMARY KEY ("work_item_id", "comment_id")
);

CREATE INDEX "work_item_comment_project_id_idx" ON "work_item_comment"("project_id");

ALTER TABLE "work_item_comment" ADD CONSTRAINT "work_item_comment_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
