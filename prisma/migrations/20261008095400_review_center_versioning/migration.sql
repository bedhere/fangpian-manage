ALTER TABLE "projects" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "project_approvals" ADD COLUMN "project_version" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "project_approvals_project_id_stage_key";
CREATE UNIQUE INDEX "project_approvals_project_id_stage_project_version_key"
  ON "project_approvals"("project_id", "stage", "project_version");
CREATE INDEX "project_approvals_project_id_created_at_idx"
  ON "project_approvals"("project_id", "created_at");
