-- CreateTable
CREATE TABLE "trainee_growth_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "trainee_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "rating" TEXT,
    "department_text" TEXT NOT NULL DEFAULT '',
    "work_results" TEXT NOT NULL DEFAULT '',
    "strengths" TEXT NOT NULL DEFAULT '',
    "shortfalls" TEXT NOT NULL DEFAULT '',
    "growth_advice" TEXT NOT NULL DEFAULT '',
    "next_assessment" TEXT NOT NULL DEFAULT '',
    "archive_comment" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "published_at" TIMESTAMP(3),
    "analysis_request_key" UUID,
    "analysis_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainee_growth_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainee_growth_revisions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "editor_id" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainee_growth_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainee_growth_sources" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "text_content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "error" TEXT,
    "result" JSONB,
    "request_key" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainee_growth_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trainee_growth_plans_organization_id_trainee_id_period_star_idx" ON "trainee_growth_plans"("organization_id", "trainee_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "trainee_growth_plans_trainee_id_period_start_key" ON "trainee_growth_plans"("trainee_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "trainee_growth_revisions_plan_id_version_key" ON "trainee_growth_revisions"("plan_id", "version");

-- CreateIndex
CREATE INDEX "trainee_growth_sources_plan_id_created_at_idx" ON "trainee_growth_sources"("plan_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "trainee_growth_sources_plan_id_request_key_content_hash_key" ON "trainee_growth_sources"("plan_id", "request_key", "content_hash");

-- AddForeignKey
ALTER TABLE "trainee_growth_plans" ADD CONSTRAINT "trainee_growth_plans_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainee_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_growth_revisions" ADD CONSTRAINT "trainee_growth_revisions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "trainee_growth_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainee_growth_sources" ADD CONSTRAINT "trainee_growth_sources_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "trainee_growth_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trainee_growth_plans"
  ADD CONSTRAINT "trainee_growth_rating_valid" CHECK (rating IS NULL OR rating IN ('S','A+','A','A-','B','C')),
  ADD CONSTRAINT "trainee_growth_status_valid" CHECK (status IN ('DRAFT','PUBLISHED')),
  ADD CONSTRAINT "trainee_growth_period_valid" CHECK (period_end >= period_start AND period_end <= period_start + 6 AND EXTRACT(ISODOW FROM period_start)=1),
  ADD CONSTRAINT "trainee_growth_version_valid" CHECK (version > 0);
ALTER TABLE "trainee_growth_sources" ADD CONSTRAINT "trainee_growth_source_status_valid" CHECK (status IN ('READY','ANALYZED','FAILED'));

