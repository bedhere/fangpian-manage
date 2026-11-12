-- CreateEnum
CREATE TYPE "BusinessRequestStatus" AS ENUM ('DRAFT', 'DIAGNOSING', 'AI_WORKSPACE', 'HUMAN_PROJECT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIWorkspaceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "KnowledgeAssetStatus" AS ENUM ('DRAFT', 'BUSINESS_REVIEW', 'TECHNICAL_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "business_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "linked_project_id" UUID,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "business_context" TEXT NOT NULL,
    "expected_outcome" TEXT NOT NULL,
    "constraints" TEXT,
    "status" "BusinessRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "diagnosis" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workspace_sessions" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "status" "AIWorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT,
    "model" TEXT,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ai_workspace_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workspace_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_workspace_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_assets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "request_id" UUID,
    "session_id" UUID,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" "KnowledgeAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_asset_reviews" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "stage" "ApprovalStage" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_asset_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_requests_linked_project_id_key" ON "business_requests"("linked_project_id");

-- CreateIndex
CREATE INDEX "business_requests_organization_id_requester_id_status_idx" ON "business_requests"("organization_id", "requester_id", "status");

-- CreateIndex
CREATE INDEX "ai_workspace_sessions_request_id_created_at_idx" ON "ai_workspace_sessions"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_workspace_messages_session_id_created_at_idx" ON "ai_workspace_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_assets_organization_id_status_created_at_idx" ON "knowledge_assets"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_asset_reviews_reviewer_id_created_at_idx" ON "knowledge_asset_reviews"("reviewer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_asset_reviews_asset_id_stage_key" ON "knowledge_asset_reviews"("asset_id", "stage");

-- AddForeignKey
ALTER TABLE "business_requests" ADD CONSTRAINT "business_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_requests" ADD CONSTRAINT "business_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_requests" ADD CONSTRAINT "business_requests_linked_project_id_fkey" FOREIGN KEY ("linked_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workspace_sessions" ADD CONSTRAINT "ai_workspace_sessions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "business_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workspace_sessions" ADD CONSTRAINT "ai_workspace_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workspace_messages" ADD CONSTRAINT "ai_workspace_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_workspace_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_assets" ADD CONSTRAINT "knowledge_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_assets" ADD CONSTRAINT "knowledge_assets_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_assets" ADD CONSTRAINT "knowledge_assets_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "business_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_assets" ADD CONSTRAINT "knowledge_assets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_workspace_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_asset_reviews" ADD CONSTRAINT "knowledge_asset_reviews_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "knowledge_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_asset_reviews" ADD CONSTRAINT "knowledge_asset_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
