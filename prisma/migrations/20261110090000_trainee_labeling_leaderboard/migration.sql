CREATE TABLE "trainee_labeling_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "trainee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "count" INTEGER NOT NULL CHECK ("count" BETWEEN 0 AND 1000000000),
    "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
    "source" TEXT NOT NULL CHECK ("source" IN ('MANUAL', 'API')),
    "note" TEXT NOT NULL DEFAULT '',
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trainee_labeling_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trainee_labeling_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trainee_labeling_entries_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainee_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "labeling_entry_org_trainee_date_key" ON "trainee_labeling_entries"("organization_id", "trainee_id", "work_date");
CREATE INDEX "labeling_entry_org_date_idx" ON "trainee_labeling_entries"("organization_id", "work_date");
CREATE TABLE "trainee_labeling_imports" (
    "organization_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trainee_labeling_imports_pkey" PRIMARY KEY ("organization_id", "request_id"),
    CONSTRAINT "trainee_labeling_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
