CREATE TYPE "AIGenerationStatus" AS ENUM ('NONE', 'PENDING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "ai_workspace_sessions"
  ADD COLUMN "original_result" JSONB,
  ADD COLUMN "confirmed_result" JSONB;

ALTER TABLE "ai_workspace_messages"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "reply_to_id" UUID,
  ADD COLUMN "generation_status" "AIGenerationStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "generation_error" TEXT,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "prompt_version" TEXT,
  ADD COLUMN "latency_ms" INTEGER;

CREATE UNIQUE INDEX "ai_workspace_messages_session_id_idempotency_key_key"
  ON "ai_workspace_messages"("session_id", "idempotency_key");
CREATE INDEX "ai_workspace_messages_reply_to_id_idx"
  ON "ai_workspace_messages"("reply_to_id");

ALTER TABLE "ai_workspace_messages"
  ADD CONSTRAINT "ai_workspace_messages_reply_to_id_fkey"
  FOREIGN KEY ("reply_to_id") REFERENCES "ai_workspace_messages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
