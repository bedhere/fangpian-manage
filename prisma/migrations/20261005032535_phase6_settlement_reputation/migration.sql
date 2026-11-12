-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED', 'ARBITRATED');

-- CreateEnum
CREATE TYPE "ContributionDisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "BonusLedgerStatus" AS ENUM ('PENDING', 'LOCKED', 'PAID');

-- CreateEnum
CREATE TYPE "SettlementBatchStatus" AS ENUM ('LOCKED', 'PAID');

-- CreateEnum
CREATE TYPE "ReputationEventType" AS ENUM ('GRADE_S', 'GRADE_A', 'ON_TIME', 'OWNER_REPLACED', 'PROJECT_FAILED', 'MALICIOUS_ABANDON');

-- CreateEnum
CREATE TYPE "UserRestrictionType" AS ENUM ('MAX_PROJECT_LEVEL', 'HIGH_LEVEL_PROJECT_BLOCK', 'PROJECT_APPLICATION_BLOCK');

-- CreateTable
CREATE TABLE "bonus_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_level" "ProjectLevel" NOT NULL,
    "hourly_rate" DECIMAL(12,2) NOT NULL,
    "min_hours" DECIMAL(8,2) NOT NULL,
    "max_hours" DECIMAL(8,2) NOT NULL,
    "s_multiplier" DECIMAL(5,2) NOT NULL,
    "a_multiplier" DECIMAL(5,2) NOT NULL,
    "b_multiplier" DECIMAL(5,2) NOT NULL,
    "c_multiplier" DECIMAL(5,2) NOT NULL,
    "fail_multiplier" DECIMAL(5,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_contributions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "proposed_by_id" UUID NOT NULL,
    "proposed_percentage" DECIMAL(5,2) NOT NULL,
    "final_percentage" DECIMAL(5,2),
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_disputes" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "raised_by_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "original_allocation" JSONB NOT NULL,
    "final_allocation" JSONB,
    "status" "ContributionDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "arbitrator_id" UUID,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribution_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "settlement_month" DATE NOT NULL,
    "status" "SettlementBatchStatus" NOT NULL DEFAULT 'LOCKED',
    "total_amount" DECIMAL(14,2) NOT NULL,
    "locked_by_id" UUID,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_ledgers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "settlement_batch_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "contribution_percentage" DECIMAL(5,2) NOT NULL,
    "status" "BonusLedgerStatus" NOT NULL DEFAULT 'PENDING',
    "settlement_month" DATE NOT NULL,
    "locked_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "project_id" UUID,
    "type" "ReputationEventType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "score_before" INTEGER NOT NULL,
    "score_after" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_restrictions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "UserRestrictionType" NOT NULL,
    "value" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonus_rules_organization_id_project_level_effective_from_idx" ON "bonus_rules"("organization_id", "project_level", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "bonus_rules_organization_id_project_level_effective_from_key" ON "bonus_rules"("organization_id", "project_level", "effective_from");

-- CreateIndex
CREATE INDEX "project_contributions_project_id_status_idx" ON "project_contributions"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_contributions_project_id_user_id_key" ON "project_contributions"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "contribution_disputes_project_id_status_idx" ON "contribution_disputes"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_batches_organization_id_settlement_month_key" ON "settlement_batches"("organization_id", "settlement_month");

-- CreateIndex
CREATE INDEX "bonus_ledgers_organization_id_settlement_month_status_idx" ON "bonus_ledgers"("organization_id", "settlement_month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bonus_ledgers_project_id_user_id_key" ON "bonus_ledgers"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "reputation_events_user_id_created_at_idx" ON "reputation_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_restrictions_user_id_ends_at_idx" ON "user_restrictions"("user_id", "ends_at");

-- AddForeignKey
ALTER TABLE "bonus_rules" ADD CONSTRAINT "bonus_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contributions" ADD CONSTRAINT "project_contributions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contributions" ADD CONSTRAINT "project_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_contributions" ADD CONSTRAINT "project_contributions_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_disputes" ADD CONSTRAINT "contribution_disputes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_disputes" ADD CONSTRAINT "contribution_disputes_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_disputes" ADD CONSTRAINT "contribution_disputes_arbitrator_id_fkey" FOREIGN KEY ("arbitrator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_ledgers" ADD CONSTRAINT "bonus_ledgers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_ledgers" ADD CONSTRAINT "bonus_ledgers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_ledgers" ADD CONSTRAINT "bonus_ledgers_settlement_batch_id_fkey" FOREIGN KEY ("settlement_batch_id") REFERENCES "settlement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
