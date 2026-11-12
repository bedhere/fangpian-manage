CREATE TABLE "trainee_labeling_tianji_identities" (
 "trainee_id" UUID NOT NULL PRIMARY KEY,
 "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "employee_id" INTEGER NOT NULL CHECK ("employee_id" > 0),
 "employee_name" TEXT NOT NULL,
 "bound_by" UUID NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "trainee_labeling_tianji_identities_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainee_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "labeling_identity_org_employee_key" ON "trainee_labeling_tianji_identities"("organization_id","employee_id");
CREATE TABLE "trainee_labeling_tianji_days" (
 "id" UUID NOT NULL PRIMARY KEY,
 "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "trainee_id" UUID NOT NULL REFERENCES "trainee_labeling_tianji_identities"("trainee_id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "work_date" DATE NOT NULL,
 "count" INTEGER NOT NULL CHECK ("count" BETWEEN 0 AND 1000000000),
 "sync_id" UUID NOT NULL,
 "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "labeling_tianji_day_org_trainee_date_key" ON "trainee_labeling_tianji_days"("organization_id","trainee_id","work_date");
CREATE INDEX "labeling_tianji_day_org_date_idx" ON "trainee_labeling_tianji_days"("organization_id","work_date");
CREATE TABLE "trainee_labeling_syncs" (
 "id" UUID NOT NULL PRIMARY KEY,
 "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "actor_id" UUID NOT NULL,
 "from" DATE NOT NULL,
 "to" DATE NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("status" IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
 "message" TEXT NOT NULL DEFAULT '',
 "processed" INTEGER NOT NULL DEFAULT 0,
 "result" JSONB,
 "lease_until" TIMESTAMP(3),
 "worker_key" UUID,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 "finished_at" TIMESTAMP(3)
);
CREATE INDEX "labeling_sync_org_status_idx" ON "trainee_labeling_syncs"("organization_id","status");
CREATE INDEX "labeling_sync_status_lease_idx" ON "trainee_labeling_syncs"("status","lease_until");
