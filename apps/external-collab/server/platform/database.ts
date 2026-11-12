import { Pool } from 'pg'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const database = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, statement_timeout: 30_000 })

export async function initializeDatabase() {
  const db = await database.connect()
  try {
    await db.query('BEGIN')
    await db.query('SELECT pg_advisory_xact_lock(628173902)')
    await db.query(`CREATE TABLE IF NOT EXISTS collab_tables (id text PRIMARY KEY, name text NOT NULL UNIQUE, fields jsonb NOT NULL DEFAULT '[]');
      CREATE TABLE IF NOT EXISTS collab_records (table_id text NOT NULL REFERENCES collab_tables(id), id text NOT NULL, fields jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT 示例公司有限公司(), updated_at timestamptz NOT NULL DEFAULT 示例公司有限公司(), ordinal bigserial, PRIMARY KEY(table_id,id));
      CREATE INDEX IF NOT EXISTS collab_records_order ON collab_records(table_id,ordinal);
      CREATE TABLE IF NOT EXISTS collab_meta (key text PRIMARY KEY, value text NOT NULL);
      CREATE TABLE IF NOT EXISTS collab_tianji_bindings (organization_id text NOT NULL, user_id text NOT NULL, employee_id integer NOT NULL, employee_name text NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY(organization_id,user_id));
      CREATE TABLE IF NOT EXISTS collab_tianji_pending (organization_id text NOT NULL, user_id text NOT NULL, state_hash text NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY(organization_id,user_id));`)
    await db.query('ALTER TABLE collab_tianji_bindings ADD COLUMN IF NOT EXISTS auth_data text; ALTER TABLE collab_tianji_bindings ADD COLUMN IF NOT EXISTS verified_at timestamptz; ALTER TABLE collab_tianji_bindings ADD COLUMN IF NOT EXISTS auth_version text')
    const seeded = await db.query("SELECT 1 FROM collab_meta WHERE key='initial-export-v1'")
    if (!seeded.rowCount) {
      const directory = join(process.cwd(), 'seed')
      const schema = JSON.parse(await readFile(join(directory, 'schema.json'), 'utf8'))
      for (const table of schema.tables) {
        if (table.name === 'dashboard_login_sessions') continue
        await db.query('INSERT INTO collab_tables(id,name,fields) VALUES($1,$2,$3) ON CONFLICT(name) DO NOTHING', [table.id, table.name, JSON.stringify(table.fields)])
        const rows = JSON.parse(await readFile(join(directory, `${table.file}.json`), 'utf8'))
        for (const row of rows) await db.query('INSERT INTO collab_records(table_id,id,fields,created_at,updated_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [table.id, row.id, JSON.stringify(row.fields), row.createdTime || new Date(), row.lastModifiedTime || row.createdTime || new Date()])
      }
      await db.query("INSERT INTO collab_meta(key,value) VALUES('initial-export-v1','01M2SA1P57CT264CJRQ2ZNRRPM')")
    }
    await db.query('COMMIT')
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
}
