ALTER TABLE "users" ADD COLUMN "is_demo_account" BOOLEAN NOT NULL DEFAULT false;

-- Match the original seed identities, not arbitrary account names or email domains.
UPDATE "users" AS u SET "is_demo_account" = true
FROM "organizations" AS o
WHERE u."organization_id" = o."id" AND o."slug" = 'valueflow-demo'
  AND u."username" IS NULL
  AND (
    (u."email", u."display_name") IN (
      ('admin@example.com', '平台管理员'),
      ('owner@example.com', '公司负责人'),
      ('techhead@example.com', '技术部负责人'),
      ('saleshead@example.com', '销售部负责人'),
      ('marketinghead@example.com', '市场部负责人'),
      ('operationshead@example.com', '运营部负责人'),
      ('adminhead@example.com', '行政部负责人'),
      ('employee1@example.com', '示例员工')
    ) OR (
      u."email" ~ '^employee([1-9]|1[0-9]|20)@example[.]com$'
      AND u."display_name" = '员工' || substring(u."email" from '^employee([0-9]+)@')
    )
  );
