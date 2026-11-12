DROP INDEX IF EXISTS "delivery_acceptances_delivery_id_idx";
DROP INDEX IF EXISTS "project_milestones_plan_id_idx";

ALTER TABLE "project_approvals"
ALTER COLUMN "project_version" DROP DEFAULT;

CREATE INDEX IF NOT EXISTS "project_applications_project_id_applicant_id_idx"
ON "project_applications"("project_id", "applicant_id");

ALTER INDEX IF EXISTS "project_contributions_project_id_proposal_version_superseded_at"
RENAME TO "project_contributions_project_id_proposal_version_supersede_idx";
