CREATE INDEX "users_organization_id_status_deleted_at_idx"
ON "users"("organization_id", "status", "deleted_at");

CREATE INDEX "audit_logs_organization_id_created_at_idx"
ON "audit_logs"("organization_id", "created_at");

CREATE INDEX "projects_organization_id_updated_at_idx"
ON "projects"("organization_id", "updated_at");
