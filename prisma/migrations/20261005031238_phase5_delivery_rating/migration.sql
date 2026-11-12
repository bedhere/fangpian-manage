-- CreateEnum
CREATE TYPE "DeliverableType" AS ENUM ('FILE', 'LINK', 'TEXT', 'REPOSITORY', 'OTHER');

-- CreateEnum
CREATE TYPE "AcceptanceRole" AS ENUM ('PUBLISHER_BUSINESS', 'DEPARTMENT_HEAD_BUSINESS', 'OWNER_MANAGER_TECHNICAL');

-- CreateEnum
CREATE TYPE "AcceptanceDecision" AS ENUM ('APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "ProjectGrade" AS ENUM ('S', 'A', 'B', 'C', 'FAIL');

-- CreateTable
CREATE TABLE "project_deliveries" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "DeliverableType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "url" TEXT,
    "storage_key" TEXT,
    "change_summary" TEXT NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_acceptances" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "role" "AcceptanceRole" NOT NULL,
    "decision" "AcceptanceDecision" NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_ratings" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "publisher_business_score" INTEGER NOT NULL,
    "department_head_business_score" INTEGER NOT NULL,
    "ai_technical_score" INTEGER NOT NULL,
    "owner_manager_technical_score" INTEGER NOT NULL,
    "project_management_score" INTEGER NOT NULL,
    "final_score" INTEGER NOT NULL,
    "grade" "ProjectGrade" NOT NULL,
    "breakdown" JSONB NOT NULL,
    "requires_executive_confirmation" BOOLEAN NOT NULL,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMP(3),
    "confirmation_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_deliveries_project_id_created_at_idx" ON "project_deliveries"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_deliveries_project_id_version_key" ON "project_deliveries"("project_id", "version");

-- CreateIndex
CREATE INDEX "delivery_acceptances_project_id_decision_idx" ON "delivery_acceptances"("project_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_acceptances_project_id_role_key" ON "delivery_acceptances"("project_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "project_ratings_project_id_key" ON "project_ratings"("project_id");

-- CreateIndex
CREATE INDEX "project_ratings_grade_confirmed_at_idx" ON "project_ratings"("grade", "confirmed_at");

-- AddForeignKey
ALTER TABLE "project_deliveries" ADD CONSTRAINT "project_deliveries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliveries" ADD CONSTRAINT "project_deliveries_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_acceptances" ADD CONSTRAINT "delivery_acceptances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_acceptances" ADD CONSTRAINT "delivery_acceptances_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_ratings" ADD CONSTRAINT "project_ratings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_ratings" ADD CONSTRAINT "project_ratings_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
