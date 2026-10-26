-- Comments on designer tasks: anyone who can see the team board can discuss a task.
CREATE TABLE "task_comment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_comment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "task_comment_task_id_created_at_idx" ON "task_comment"("task_id", "created_at");
