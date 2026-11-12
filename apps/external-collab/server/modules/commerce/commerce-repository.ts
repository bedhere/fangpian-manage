import { database } from '../../platform/database'
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import type { CommerceOrder, Dimension, Period } from './commerce-domain'

let ready: Promise<void> | undefined
export function ensureCommerceSchema() {
  if (!ready)
    ready = (async () => {
      const names=['commerce_batches','commerce_orders','commerce_page_sources','commerce_active_batches','commerce_catalog','commerce_target_overrides','commerce_target_audit','commerce_refresh_queue','commerce_original_totals']
      const result=await database.query('SELECT to_regclass(name) AS relation FROM unnest($1::text[]) AS name',[names])
      if(result.rows.length!==names.length||result.rows.some(row=>!row.relation))throw new ServiceUnavailableException('商务数据库迁移尚未执行，请先完成独立 external_collab 数据库的前向迁移')
    })().catch((error) => {
      ready = undefined
      throw error
    })
  return ready
}
export async function readCatalog(): Promise<{ periods: Period[]; source: any } | null> {
  await ensureCommerceSchema()
  const r = await database.query('SELECT payload,source FROM commerce_catalog WHERE singleton=true')
  return r.rows[0] ? { periods: r.rows[0].payload, source: r.rows[0].source } : null
}
export async function saveCatalog(periods: Period[], source: unknown) {
  await database.query(
    `INSERT INTO commerce_catalog(singleton,payload,source) VALUES(true,$1,$2)
    ON CONFLICT(singleton) DO UPDATE SET payload=excluded.payload,source=excluded.source,updated_at=示例公司有限公司()`,
    [JSON.stringify(periods), JSON.stringify(source)],
  )
}
export async function readActive(monthId: number, dimension: Dimension, batchId?: string) {
  await ensureCommerceSchema()
  if (batchId && !/^commerce_[0-9a-f-]{36}$/.test(batchId)) throw new BadRequestException('数据批次无效')
  const b = batchId
    ? (
        await database.query(
          "SELECT * FROM commerce_batches WHERE id=$1 AND month_id=$2 AND status='complete'",
          [batchId, monthId],
        )
      ).rows[0]
    : (
        await database.query(
          `SELECT b.* FROM commerce_active_batches a JOIN commerce_batches b ON b.id=a.batch_id WHERE a.month_id=$1`,
          [monthId],
        )
      ).rows[0]
  if (batchId && !b) throw new BadRequestException('所选完整数据批次不存在，请重新读取看板')
  const orders: CommerceOrder[] = b
    ? (
        await database.query(
          'SELECT payload FROM commerce_orders WHERE batch_id=$1 AND dimension=$2 ORDER BY order_id',
          [b.id, dimension],
        )
      ).rows.map((r) => r.payload)
    : []
  const latest =
    (
      await database.query(
        'SELECT id,status,error,started_at,finished_at,progress FROM commerce_batches WHERE month_id=$1 ORDER BY started_at DESC LIMIT 1',
        [monthId],
      )
    ).rows[0] ?? null
  const queued=(await database.query('SELECT slot,requested_at FROM commerce_refresh_queue WHERE month_id=$1',[monthId])).rows[0]??null
  return { batch: b ?? null, orders, latest,queued }
}
export async function readTargetOverrides(monthId: number, employeeId: number) {
  await ensureCommerceSchema()
  return (
    await database.query(
      'SELECT metric,cents,source,updated_at,updated_by FROM commerce_target_overrides WHERE month_id=$1 AND employee_id=$2',
      [monthId, employeeId],
    )
  ).rows
}
