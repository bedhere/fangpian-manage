ALTER TABLE "delivery_acceptances" ADD COLUMN "delivery_id" UUID;

UPDATE "delivery_acceptances" acceptance
SET "delivery_id" = latest."id"
FROM (
  SELECT DISTINCT ON ("project_id") "id", "project_id"
  FROM "project_deliveries"
  ORDER BY "project_id", "version" DESC
) latest
WHERE latest."project_id" = acceptance."project_id";

DELETE FROM "delivery_acceptances" WHERE "delivery_id" IS NULL;
ALTER TABLE "delivery_acceptances" ALTER COLUMN "delivery_id" SET NOT NULL;
DROP INDEX "delivery_acceptances_project_id_role_key";
CREATE UNIQUE INDEX "delivery_acceptances_delivery_id_role_key" ON "delivery_acceptances"("delivery_id", "role");
CREATE INDEX "delivery_acceptances_delivery_id_idx" ON "delivery_acceptances"("delivery_id");
ALTER TABLE "delivery_acceptances" ADD CONSTRAINT "delivery_acceptances_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "project_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
