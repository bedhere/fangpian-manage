-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ProjectHealthStatus" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "objective" TEXT;

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "expected_deliverable" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_progress_logs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "progress_percent" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "blockers" TEXT,
    "risk_level" INTEGER NOT NULL,
    "next_action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_health_snapshots" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "time_progress" DECIMAL(5,2) NOT NULL,
    "work_progress" DECIMAL(5,2) NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "ProjectHealthStatus" NOT NULL,
    "reason" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_risk_actions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "supervisor_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "remediation_plan" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_risk_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_milestones_project_id_due_at_idx" ON "project_milestones"("project_id", "due_at");

-- CreateIndex
CREATE INDEX "project_progress_logs_project_id_created_at_idx" ON "project_progress_logs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "project_health_snapshots_project_id_created_at_idx" ON "project_health_snapshots"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "project_risk_actions_project_id_resolved_at_idx" ON "project_risk_actions"("project_id", "resolved_at");

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_progress_logs" ADD CONSTRAINT "project_progress_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_health_snapshots" ADD CONSTRAINT "project_health_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_risk_actions" ADD CONSTRAINT "project_risk_actions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
