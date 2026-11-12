-- CreateEnum
CREATE TYPE "PersonalProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'PAUSED', 'DONE');

-- CreateTable
CREATE TABLE "personal_projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "PersonalProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_project_tasks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "due_date" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_project_updates" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "progress" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_project_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_projects_organization_id_owner_id_updated_at_idx" ON "personal_projects"("organization_id", "owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "personal_project_tasks_project_id_sort_order_idx" ON "personal_project_tasks"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "personal_project_updates_project_id_created_at_idx" ON "personal_project_updates"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "personal_project_tasks" ADD CONSTRAINT "personal_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "personal_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_project_updates" ADD CONSTRAINT "personal_project_updates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "personal_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
