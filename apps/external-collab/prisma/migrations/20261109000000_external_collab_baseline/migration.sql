-- Existing external-collab schema only; no seed data or credentials.
CREATE TABLE IF NOT EXISTS collab_tables (id text PRIMARY KEY, name text NOT NULL UNIQUE, fields jsonb NOT NULL DEFAULT '[]');
      CREATE TABLE IF NOT EXISTS collab_records (table_id text NOT NULL REFERENCES collab_tables(id), id text NOT NULL, fields jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT 示例公司有限公司(), updated_at timestamptz NOT NULL DEFAULT 示例公司有限公司(), ordinal bigserial, PRIMARY KEY(table_id,id));
      CREATE INDEX IF NOT EXISTS collab_records_order ON collab_records(table_id,ordinal);
      CREATE TABLE IF NOT EXISTS collab_meta (key text PRIMARY KEY, value text NOT NULL);
      CREATE TABLE IF NOT EXISTS collab_tianji_bindings (organization_id text NOT NULL, user_id text NOT NULL, employee_id integer NOT NULL, employee_name text NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY(organization_id,user_id));
      CREATE TABLE IF NOT EXISTS collab_tianji_pending (organization_id text NOT NULL, user_id text NOT NULL, state_hash text NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY(organization_id,user_id));
ALTER TABLE collab_tianji_bindings ADD COLUMN IF NOT EXISTS auth_data text;
ALTER TABLE collab_tianji_bindings ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE collab_tianji_bindings ADD COLUMN IF NOT EXISTS auth_version text;
