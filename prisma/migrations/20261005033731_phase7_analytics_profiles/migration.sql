-- CreateEnum
CREATE TYPE "SkillVerificationStatus" AS ENUM ('SELF_DECLARED', 'VERIFIED');

-- AlterTable
ALTER TABLE "employee_skills" ADD COLUMN     "verification_status" "SkillVerificationStatus" NOT NULL DEFAULT 'SELF_DECLARED',
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by_id" UUID,
ADD COLUMN     "verified_project_id" UUID;

-- CreateTable
CREATE TABLE "capability_level_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "old_level" "CapabilityLevel" NOT NULL,
    "new_level" "CapabilityLevel" NOT NULL,
    "project_id" UUID,
    "reason" TEXT NOT NULL,
    "approved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_level_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capability_level_history_user_id_created_at_idx" ON "capability_level_history"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_level_history" ADD CONSTRAINT "capability_level_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_level_history" ADD CONSTRAINT "capability_level_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_level_history" ADD CONSTRAINT "capability_level_history_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
