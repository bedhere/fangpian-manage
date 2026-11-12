-- CreateTable
CREATE TABLE "ai_center_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "owner_id" UUID,
    "parent_id" UUID,
    "date_key" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_center_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_center_history" (
    "id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_name" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_center_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_center_files" (
    "id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "etag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_center_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_center_records_organization_id_kind_owner_id_date_key_idx" ON "ai_center_records"("organization_id", "kind", "owner_id", "date_key");

-- CreateIndex
CREATE INDEX "ai_center_records_organization_id_kind_status_idx" ON "ai_center_records"("organization_id", "kind", "status");

-- CreateIndex
CREATE INDEX "ai_center_records_parent_id_idx" ON "ai_center_records"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_center_history_record_id_version_key" ON "ai_center_history"("record_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ai_center_files_storage_key_key" ON "ai_center_files"("storage_key");

-- CreateIndex
CREATE INDEX "ai_center_files_record_id_status_idx" ON "ai_center_files"("record_id", "status");

-- AddForeignKey
ALTER TABLE "ai_center_history" ADD CONSTRAINT "ai_center_history_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "ai_center_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_center_files" ADD CONSTRAINT "ai_center_files_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "ai_center_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain uniqueness is deliberately partial: drafts and historical revisions remain intact.
CREATE UNIQUE INDEX "ai_center_member_owner_unique" ON "ai_center_records" ("organization_id", "owner_id") WHERE "kind" = 'MEMBER';
CREATE UNIQUE INDEX "ai_center_manager_owner_unique" ON "ai_center_records" ("organization_id", "owner_id") WHERE "kind" = 'MANAGER';
CREATE UNIQUE INDEX "ai_center_calendar_unique" ON "ai_center_records" ("organization_id") WHERE "kind" = 'CALENDAR';
CREATE UNIQUE INDEX "ai_center_ivy_day_unique" ON "ai_center_records" ("organization_id", "owner_id", "date_key") WHERE "kind" = 'IVY';
CREATE UNIQUE INDEX "ai_center_exception_week_unique" ON "ai_center_records" ("organization_id", "owner_id", "date_key") WHERE "kind" = 'EXCEPTION';
CREATE UNIQUE INDEX "ai_center_task_source_unique" ON "ai_center_records" ("organization_id", ("data"->>'sourceRecordId'), ("data"->>'sourceEntryId')) WHERE "kind" = 'TASK' AND "data"->>'sourceType' IN ('IVY','LEARNING');
CREATE UNIQUE INDEX "ai_center_link_source_unique" ON "ai_center_records" ("organization_id", ("data"->>'sourceRecordId'), ("data"->>'sourceEntryId')) WHERE "kind" = 'LINK' AND "status" <> 'REJECTED';
ALTER TABLE "ai_center_records" ADD CONSTRAINT "ai_center_kind_valid" CHECK ("kind" IN ('MANAGER','MEMBER','CALENDAR','TASK','IVY','NOTE','LINK','APPEAL','EXCEPTION'));
ALTER TABLE "ai_center_records" ADD CONSTRAINT "ai_center_version_positive" CHECK ("version" > 0);
ALTER TABLE "ai_center_files" ADD CONSTRAINT "ai_center_file_size_valid" CHECK ("size" > 0 AND "size" <= 524288000);

