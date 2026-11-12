-- CreateEnum
CREATE TYPE "CapacityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ProjectApplicationStatus" AS ENUM ('PENDING', 'SPECIAL_CAPABILITY_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('OWNER', 'CONTRIBUTOR', 'SUPERVISOR', 'REVIEWER');

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 1,
    "evidence" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_capacities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "available_hours" DECIMAL(8,2) NOT NULL,
    "allocated_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "status" "CapacityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_capacities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_applications" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "applicant_id" UUID NOT NULL,
    "motivation" TEXT NOT NULL,
    "estimated_hours" DECIMAL(8,2) NOT NULL,
    "relevant_experience" TEXT NOT NULL,
    "note" TEXT,
    "matching_score" DECIMAL(5,2) NOT NULL,
    "matching_breakdown" JSONB NOT NULL,
    "status" "ProjectApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "special_review_reason" TEXT,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ProjectMemberRole" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_skills_user_id_skill_id_key" ON "employee_skills"("user_id", "skill_id");

-- CreateIndex
CREATE INDEX "employee_capacities_user_id_status_idx" ON "employee_capacities"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_capacities_user_id_period_start_period_end_key" ON "employee_capacities"("user_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "project_applications_project_id_status_idx" ON "project_applications"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_applications_project_id_applicant_id_key" ON "project_applications"("project_id", "applicant_id");

-- CreateIndex
CREATE INDEX "project_members_project_id_role_idx" ON "project_members"("project_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_capacities" ADD CONSTRAINT "employee_capacities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One project may have only one active member carrying the OWNER role.
CREATE UNIQUE INDEX "project_members_one_active_owner_idx"
ON "project_members" ("project_id")
WHERE "role" = 'OWNER' AND "left_at" IS NULL;
