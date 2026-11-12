CREATE UNIQUE INDEX "reputation_events_user_id_project_id_type_key"
ON "reputation_events"("user_id", "project_id", "type");
