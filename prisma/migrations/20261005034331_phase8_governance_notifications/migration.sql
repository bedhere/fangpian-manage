-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PROJECT', 'REVIEW', 'RISK', 'SETTLEMENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "system_setting_revisions" (
    "id" UUID NOT NULL,
    "setting_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "changed_by_id" UUID,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_setting_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_setting_revisions_setting_id_version_key" ON "system_setting_revisions"("setting_id", "version");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "system_setting_revisions" ADD CONSTRAINT "system_setting_revisions_setting_id_fkey" FOREIGN KEY ("setting_id") REFERENCES "system_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
