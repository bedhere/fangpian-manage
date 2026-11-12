CREATE TYPE "KnowledgeAssetType" AS ENUM ('PLAYBOOK', 'TEMPLATE', 'CASE_STUDY', 'PROMPT', 'TOOL', 'OTHER');

ALTER TABLE "knowledge_assets"
ADD COLUMN "asset_type" "KnowledgeAssetType" NOT NULL DEFAULT 'PLAYBOOK',
ADD COLUMN "source_url" TEXT,
ADD COLUMN "usage_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "knowledge_asset_usage_events" (
  "id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "reference_type" TEXT NOT NULL,
  "reference_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_asset_usage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_asset_usage_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "knowledge_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "knowledge_asset_usage_events_asset_id_reference_type_refere_key"
ON "knowledge_asset_usage_events"("asset_id", "reference_type", "reference_id", "idempotency_key");
CREATE INDEX "knowledge_asset_usage_events_organization_id_created_at_idx"
ON "knowledge_asset_usage_events"("organization_id", "created_at");
