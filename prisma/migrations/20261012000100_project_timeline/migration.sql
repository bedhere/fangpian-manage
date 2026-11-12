CREATE TABLE "project_timeline_nodes" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "default_key" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "scheduled_at" TIMESTAMP(3),
  "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_timeline_nodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_timeline_nodes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "project_timeline_nodes_project_id_default_key_key" ON "project_timeline_nodes"("project_id", "default_key");
CREATE INDEX "project_timeline_nodes_project_id_scheduled_at_idx" ON "project_timeline_nodes"("project_id", "scheduled_at");
