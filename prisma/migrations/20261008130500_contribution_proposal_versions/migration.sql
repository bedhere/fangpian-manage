ALTER TABLE "project_contributions"
  ADD COLUMN "proposal_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "superseded_at" TIMESTAMP(3);

DROP INDEX "project_contributions_project_id_user_id_key";

CREATE UNIQUE INDEX "project_contributions_project_id_user_id_proposal_version_key"
  ON "project_contributions"("project_id", "user_id", "proposal_version");

CREATE INDEX "project_contributions_project_id_proposal_version_superseded_at_idx"
  ON "project_contributions"("project_id", "proposal_version", "superseded_at");
