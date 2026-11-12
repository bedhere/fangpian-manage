CREATE TYPE "SkillEvidenceStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "capability_level_history"
  ADD COLUMN "rule_version" TEXT,
  ADD COLUMN "evidence" JSONB;

CREATE UNIQUE INDEX "capability_level_history_user_id_project_id_key"
  ON "capability_level_history"("user_id", "project_id");

CREATE TABLE "project_skill_evidence" (
  "id" UUID NOT NULL,
  "evidence_key" TEXT NOT NULL,
  "organization_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "skill_id" UUID NOT NULL,
  "contribution_percentage" DECIMAL(5,2) NOT NULL,
  "grade" "ProjectGrade" NOT NULL,
  "status" "SkillEvidenceStatus" NOT NULL DEFAULT 'PENDING',
  "reviewer_id" UUID,
  "review_reason" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_skill_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_skill_evidence_evidence_key_key" ON "project_skill_evidence"("evidence_key");
CREATE UNIQUE INDEX "project_skill_evidence_project_id_user_id_skill_id_key" ON "project_skill_evidence"("project_id", "user_id", "skill_id");
CREATE INDEX "project_skill_evidence_organization_id_status_created_at_idx" ON "project_skill_evidence"("organization_id", "status", "created_at");
CREATE INDEX "project_skill_evidence_user_id_created_at_idx" ON "project_skill_evidence"("user_id", "created_at");

ALTER TABLE "project_skill_evidence" ADD CONSTRAINT "project_skill_evidence_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_skill_evidence" ADD CONSTRAINT "project_skill_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_skill_evidence" ADD CONSTRAINT "project_skill_evidence_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_skill_evidence" ADD CONSTRAINT "project_skill_evidence_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
