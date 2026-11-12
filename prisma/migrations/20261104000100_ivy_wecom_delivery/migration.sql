-- Additive delivery infrastructure only. Existing users, tasks and diaries are untouched.
CREATE TABLE "wecom_ivy_channels" (
 "id" UUID NOT NULL, "organization_id" UUID NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false, "target_name" TEXT NOT NULL,
 "target_aliases" TEXT[] NOT NULL, "chat_type" TEXT NOT NULL DEFAULT 'single',
 "test_mode" BOOLEAN NOT NULL DEFAULT true, "paused_at" TIMESTAMP(3), "pause_reason" TEXT,
 "next_call_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "wecom_ivy_channels_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "wecom_ivy_chat_type_valid" CHECK ("chat_type" IN ('single','group'))
);
CREATE UNIQUE INDEX "wecom_ivy_channels_organization_id_key" ON "wecom_ivy_channels"("organization_id");
CREATE TABLE "wecom_ivy_deliveries" (
 "id" UUID NOT NULL, "channel_id" UUID NOT NULL, "organization_id" UUID NOT NULL,
 "record_id" UUID NOT NULL, "record_version" INTEGER NOT NULL, "content_hash" TEXT NOT NULL, "routing_hash" TEXT NOT NULL,
 "payload" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "active_slot" TEXT,
 "started_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3), "error_code" TEXT, "error_message" TEXT,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "wecom_ivy_deliveries_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "wecom_ivy_delivery_status_valid" CHECK ("status" IN ('PENDING','SENDING','SENT','FAILED','UNKNOWN','SUPERSEDED')),
 CONSTRAINT "wecom_ivy_delivery_version_valid" CHECK ("record_version">0),
 CONSTRAINT "wecom_ivy_deliveries_channel_id_fkey" FOREIGN KEY("channel_id") REFERENCES "wecom_ivy_channels"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "wecom_ivy_deliveries_active_slot_key" ON "wecom_ivy_deliveries"("active_slot");
CREATE UNIQUE INDEX "wecom_ivy_deliveries_channel_id_record_id_record_version_key" ON "wecom_ivy_deliveries"("channel_id","record_id","record_version");
CREATE INDEX "wecom_ivy_deliveries_status_created_at_idx" ON "wecom_ivy_deliveries"("status","created_at");
CREATE INDEX "wecom_ivy_deliveries_organization_id_record_id_created_at_idx" ON "wecom_ivy_deliveries"("organization_id","record_id","created_at");
