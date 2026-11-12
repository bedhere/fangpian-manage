-- CreateEnum
CREATE TYPE "TraineeSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TraineeReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "trainee_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "mentor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainee_submissions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "trainee_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "expected_value" TEXT,
    "status" "TraineeSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainee_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainee_reviews" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" "TraineeReviewDecision" NOT NULL,
    "comment" TEXT,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainee_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainee_profiles_user_id_key" ON "trainee_profiles"("user_id");

-- CreateIndex
CREATE INDEX "trainee_profiles_organization_id_mentor_id_idx" ON "trainee_profiles"("organization_id", "mentor_id");

-- CreateIndex
CREATE INDEX "trainee_submissions_organization_id_work_date_status_idx" ON "trainee_submissions"("organization_id", "work_date", "status");

-- CreateIndex
CREATE INDEX "trainee_submissions_trainee_id_work_date_idx" ON "trainee_submissions"("trainee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "trainee_reviews_submission_id_version_key" ON "trainee_reviews"("submission_id", "version");

-- AddForeignKey
ALTER TABLE "trainee_profiles" ADD CONSTRAINT "trainee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_profiles" ADD CONSTRAINT "trainee_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_profiles" ADD CONSTRAINT "trainee_profiles_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_submissions" ADD CONSTRAINT "trainee_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_submissions" ADD CONSTRAINT "trainee_submissions_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainee_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_submissions" ADD CONSTRAINT "trainee_submissions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_reviews" ADD CONSTRAINT "trainee_reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "trainee_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_reviews" ADD CONSTRAINT "trainee_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
