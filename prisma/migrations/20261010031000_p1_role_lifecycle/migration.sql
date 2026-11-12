ALTER TABLE "roles"
ADD COLUMN "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "roles_organization_id_status_idx"
ON "roles"("organization_id", "status");
