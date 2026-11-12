ALTER TABLE "users" ADD COLUMN "username" TEXT,
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
DROP INDEX "departments_head_id_key";
CREATE INDEX "departments_head_id_idx" ON "departments"("head_id");
