-- Forward-only, additive commerce snapshot and source audit tables.

        CREATE TABLE IF NOT EXISTS commerce_batches (
          id text PRIMARY KEY, month_id integer NOT NULL, rule_version text NOT NULL,
          status text NOT NULL, progress jsonb NOT NULL DEFAULT '{}', error text,
          started_at timestamptz NOT NULL DEFAULT 示例公司有限公司(), finished_at timestamptz
        );
        CREATE TABLE IF NOT EXISTS commerce_orders (
          batch_id text NOT NULL REFERENCES commerce_batches(id), dimension text NOT NULL,
          order_id bigint NOT NULL, payload jsonb NOT NULL, page_number integer NOT NULL,
          PRIMARY KEY(batch_id,dimension,order_id)
        );
        CREATE TABLE IF NOT EXISTS commerce_page_sources (
          batch_id text NOT NULL REFERENCES commerce_batches(id), dimension text NOT NULL,
          page_number integer NOT NULL, evidence jsonb NOT NULL,
          PRIMARY KEY(batch_id,dimension,page_number)
        );
        CREATE TABLE IF NOT EXISTS commerce_active_batches (
          month_id integer PRIMARY KEY, batch_id text NOT NULL REFERENCES commerce_batches(id)
        );
        CREATE TABLE IF NOT EXISTS commerce_catalog (
          singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), payload jsonb NOT NULL,
          source jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT 示例公司有限公司()
        );
        CREATE TABLE IF NOT EXISTS commerce_target_overrides (
          month_id integer NOT NULL, employee_id integer NOT NULL, metric text NOT NULL,
          cents bigint NOT NULL CHECK(cents>=0), source jsonb NOT NULL, updated_by text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT 示例公司有限公司(), PRIMARY KEY(month_id,employee_id,metric)
        );
        CREATE TABLE IF NOT EXISTS commerce_target_audit (
          id bigserial PRIMARY KEY, month_id integer NOT NULL, employee_id integer NOT NULL,
          actor text NOT NULL, changes jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT 示例公司有限公司()
        );
        CREATE TABLE IF NOT EXISTS commerce_refresh_queue (
          month_id integer PRIMARY KEY, slot text NOT NULL, requested_at timestamptz NOT NULL DEFAULT 示例公司有限公司()
        );
        CREATE TABLE IF NOT EXISTS commerce_original_totals (
          batch_id text NOT NULL REFERENCES commerce_batches(id), period_id integer NOT NULL,
          dimension text NOT NULL, employee_id integer NOT NULL, cents bigint NOT NULL,
          order_count integer NOT NULL, source jsonb NOT NULL,
          PRIMARY KEY(batch_id,period_id,dimension,employee_id)
        );
        CREATE INDEX IF NOT EXISTS commerce_batches_month ON commerce_batches(month_id,started_at DESC);
