DROP INDEX IF EXISTS "project_applications_project_id_applicant_id_key";

CREATE UNIQUE INDEX "project_applications_active_project_applicant_key"
ON "project_applications" ("project_id", "applicant_id")
WHERE "status" IN ('PENDING', 'SPECIAL_CAPABILITY_REVIEW', 'APPROVED');
