CREATE TYPE "ProjectPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'SUPERSEDED');
CREATE TYPE "TeamInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

CREATE TABLE "project_plans" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "objective" TEXT NOT NULL,
  "status" "ProjectPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "submitted_at" TIMESTAMP(3),
  "confirmed_at" TIMESTAMP(3),
  "confirmed_by_id" UUID,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_plans_project_id_version_key" ON "project_plans"("project_id", "version");
CREATE INDEX "project_plans_project_id_status_idx" ON "project_plans"("project_id", "status");
ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_team_invitations" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "ProjectMemberRole" NOT NULL,
  "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invited_by_id" UUID NOT NULL,
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_team_invitations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_team_invitations_project_id_status_idx" ON "project_team_invitations"("project_id", "status");
CREATE INDEX "project_team_invitations_user_id_status_idx" ON "project_team_invitations"("user_id", "status");
CREATE UNIQUE INDEX "project_team_invitations_active_unique" ON "project_team_invitations"("project_id", "user_id") WHERE "status" = 'PENDING';
ALTER TABLE "project_team_invitations" ADD CONSTRAINT "project_team_invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_team_invitations" ADD CONSTRAINT "project_team_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_team_invitations" ADD CONSTRAINT "project_team_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_milestones" ADD COLUMN "plan_id" UUID;
CREATE INDEX "project_milestones_plan_id_idx" ON "project_milestones"("plan_id");
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "project_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
