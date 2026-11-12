// Original business API, backed by the module's private PostgreSQL database.
import { randomUUID } from 'node:crypto'
import { database } from './database'
import { parseRecordFilter } from './boundary'

export class PlatformAuthError extends Error {}
export interface TeableTable { id: string; name: string; description?: string }
export interface TeableField { id: string; name: string; type: string; options?: Record<string, any>; notNull?: boolean }
export interface TeableRecord { id: string; fields: Record<string, any>; createdTime?: string; lastModifiedTime?: string }
export interface ListRecordsOpts { take?: number; skip?: number; filterByTql?: string; orderBy?: Array<{ fieldId: string; order: 'asc' | 'desc' }> }
function record(row: any): TeableRecord { return { id: row.id, fields: row.fields, createdTime: row.created_at.toISOString(), lastModifiedTime: row.updated_at.toISOString() } }
class DatabaseAdapter {
  async listTables(_baseId?: string): Promise<TeableTable[]> { return (await database.query('SELECT id,name FROM collab_tables ORDER BY name')).rows }
  async listFields(id: string): Promise<TeableField[]> { return (await database.query('SELECT fields FROM collab_tables WHERE id=$1', [id])).rows[0]?.fields ?? [] }
  async ensureTable(name: string) {
    const id = `tbl_${randomUUID()}`
    const result = await database.query('INSERT INTO collab_tables(id,name) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id,name', [id, name])
    return { ...result.rows[0], base_id: 'external-collab', created: result.rows[0].id === id }
  }
  async createTable(name: string) { return this.ensureTable(name) }
  async createField(tableId: string, field: Omit<TeableField, 'id'>): Promise<TeableField> {
    const created = { ...field, id: `fld_${randomUUID()}` }
    await database.query(`UPDATE collab_tables SET fields=fields || $2::jsonb WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'name'=$3)`, [tableId, JSON.stringify([created]), field.name])
    return (await this.listFields(tableId)).find(f => f.name === field.name)!
  }
  async listRecords(tableId: string, opts: ListRecordsOpts = {}): Promise<TeableRecord[]> {
    const values: any[] = [tableId]
    let filter = ''
    if (opts.filterByTql) {
      const parsed = parseRecordFilter(opts.filterByTql)
      values.push(parsed.field, JSON.stringify(parsed.value)); filter = ' AND fields->$2=$3::jsonb'
    }
    let order = 'ordinal ASC'
    if (opts.orderBy?.length) {
      const fields = await this.listFields(tableId)
      order = opts.orderBy.map(o => {
        const field = fields.find(f => f.id === o.fieldId || f.name === o.fieldId)
        if (!field || !['asc', 'desc'].includes(o.order)) throw new Error('无效的记录排序')
        values.push(field.name)
        return `(fields->>$${values.length}) ${o.order === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`
      }).join(', ') + ', ordinal ASC'
    }
    values.push(Math.max(0, Math.min(Math.trunc(opts.take ?? 100), 5000)), Math.max(0, Math.trunc(opts.skip ?? 0)))
    return (await database.query(`SELECT * FROM collab_records WHERE table_id=$1${filter} ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`, values)).rows.map(record)
  }
  async createRecord(tableId: string, fields: Record<string, any>): Promise<TeableRecord> {
    return record((await database.query('INSERT INTO collab_records(table_id,id,fields) VALUES($1,$2,$3) RETURNING *', [tableId, `rec_${randomUUID()}`, JSON.stringify(fields)])).rows[0])
  }
  async updateRecord(tableId: string, recordId: string, fields: Record<string, any>): Promise<TeableRecord> {
    const result = await database.query('UPDATE collab_records SET fields=fields || $3::jsonb,updated_at=示例公司有限公司() WHERE table_id=$1 AND id=$2 RETURNING *', [tableId, recordId, JSON.stringify(fields)])
    if (!result.rowCount) throw new Error('记录不存在')
    return record(result.rows[0])
  }
  async deleteRecord(tableId: string, recordId: string): Promise<{ ok: true }> { await database.query('DELETE FROM collab_records WHERE table_id=$1 AND id=$2', [tableId, recordId]); return { ok: true } }
}
export const teable = new DatabaseAdapter()
