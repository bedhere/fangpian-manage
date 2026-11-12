-- CreateEnum
CREATE TYPE "ProjectLevel" AS ENUM ('P0', 'P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'AI_TRIAGE', 'AI_EXECUTABLE', 'AI_WORKSPACE', 'AI_COMPLETED', 'HUMAN_REQUIRED', 'DEPARTMENT_REVIEW', 'TECH_REVIEW', 'APPROVED', 'PUBLISHED', 'APPLICATION_OPEN', 'OWNER_ASSIGNED', 'PLANNING', 'IN_PROGRESS', 'AT_RISK', 'DELIVERY_SUBMITTED', 'AI_DELIVERY_REVIEW', 'BUSINESS_ACCEPTANCE', 'FINAL_RATING', 'EXECUTIVE_CONFIRMATION', 'CONTRIBUTION_CONFIRMATION', 'SETTLEMENT_PENDING', 'SETTLED', 'REJECTED', 'CANCELLED', 'FAILED', 'OWNER_REPLACED');

-- CreateEnum
CREATE TYPE "ApprovalStage" AS ENUM ('BUSINESS', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "AIAssessmentType" AS ENUM ('PROJECT_TRIAGE', 'DELIVERY_REVIEW', 'RISK_ANALYSIS', 'MATCH_EXPLANATION');

-- CreateEnum
CREATE TYPE "AIAssessmentStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'FALLBACK_MANUAL');

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "publisher_id" UUID NOT NULL,
    "publisher_department_id" UUID NOT NULL,
    "owner_id" UUID,
    "supervisor_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "business_problem" TEXT NOT NULL,
    "expected_result" TEXT NOT NULL,
    "acceptance_criteria" TEXT NOT NULL,
    "project_level" "ProjectLevel",
    "required_capability_level" "CapabilityLevel",
    "business_value_score" INTEGER,
    "technical_complexity_score" INTEGER,
    "urgency_score" INTEGER,
    "estimated_hours" DECIMAL(10,2),
    "approved_hours" DECIMAL(10,2),
    "deadline" TIMESTAMP(3),
    "base_bonus" DECIMAL(12,2),
    "final_bonus" DECIMAL(12,2),
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "ai_execution_ratio" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_required_skills" (
    "project_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "project_required_skills_pkey" PRIMARY KEY ("project_id","skill_id")
);

-- CreateTable
CREATE TABLE "project_approvals" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "stage" "ApprovalStage" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_assessments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "type" "AIAssessmentType" NOT NULL,
    "status" "AIAssessmentStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "output" JSONB,
    "confidence" DECIMAL(5,4),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_organization_id_name_key" ON "skills"("organization_id", "name");

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_approvals_project_id_stage_key" ON "project_approvals"("project_id", "stage");

-- CreateIndex
CREATE INDEX "ai_assessments_project_id_type_idx" ON "ai_assessments"("project_id", "type");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_publisher_department_id_fkey" FOREIGN KEY ("publisher_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_required_skills" ADD CONSTRAINT "project_required_skills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_required_skills" ADD CONSTRAINT "project_required_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_approvals" ADD CONSTRAINT "project_approvals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_approvals" ADD CONSTRAINT "project_approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
