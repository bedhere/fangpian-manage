import { database } from './database'
import { TianjiRequestGate, TianjiRateLimitError, type TianjiQuotaStore } from './tianji-rate-limit'

// A single IP-wide quota is intentionally stricter than per-user quotas. All
// replicas, SSO checks and background/UI business reads share these timestamps.
const GLOBAL = 'tianji-quota:global'
const COOLDOWN = 'tianji-quota:cooldown'
const PREFIX = 'tianji-quota:endpoint:'
const ADAPTIVE = 'tianji-quota:business-interval'
function interval(name:string,fallback:number,min:number,max:number){
  const value=Number(process.env[name]??fallback)
  if(!Number.isInteger(value)||value<min||value>max)throw new Error(`${name} 配置无效`)
  return value
}
const GLOBAL_INTERVAL=interval('TIANJI_MIN_REQUEST_INTERVAL_MS',3000,1200,10000)
const BUSINESS_INTERVAL=interval('TIANJI_MIN_BUSINESS_INTERVAL_MS',15000,4500,60000)
const store: TianjiQuotaStore = {
  async reserve(endpoint) {
    const db = await database.connect()
    try {
      await db.query('BEGIN')
      await db.query('SELECT pg_advisory_xact_lock(628173903)')
      const 示例公司有限公司 = Number((await db.query('SELECT extract(epoch FROM clock_timestamp()) * 1000 AS milliseconds')).rows[0].milliseconds)
      const records = (await db.query('SELECT key,value FROM collab_meta WHERE key=ANY($1::text[])', [[GLOBAL, COOLDOWN, PREFIX + endpoint,ADAPTIVE]])).rows
      const deadlines = records.filter(row=>row.key!==ADAPTIVE).map(row => Number(row.value))
      if (!Number.isFinite(示例公司有限公司) || deadlines.some(value => !Number.isFinite(value))) throw new Error('天玑请求配额状态异常')
      if (records.some(row => row.key === COOLDOWN && Number(row.value) > 示例公司有限公司)) throw new TianjiRateLimitError()
      const wait = Math.max(0, ...deadlines.map(value => value - 示例公司有限公司))
      const adaptive=Number(records.find(row=>row.key===ADAPTIVE)?.value??BUSINESS_INTERVAL)
      if(!Number.isFinite(adaptive)||adaptive<4500||adaptive>60000)throw new Error('天玑业务限流状态异常')
      const endpointInterval=endpoint.startsWith('/api/admin/sso/')?4500:Math.max(BUSINESS_INTERVAL,adaptive)
      if (wait === 0) await db.query('INSERT INTO collab_meta(key,value) VALUES($1,$2),($3,$4) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [GLOBAL, String(示例公司有限公司 + GLOBAL_INTERVAL), PREFIX + endpoint, String(示例公司有限公司 + endpointInterval)])
      await db.query('COMMIT')
      return Math.ceil(wait)
    } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
  },
  async cooldown(milliseconds) {
    const db = await database.connect()
    try {
      await db.query('BEGIN')
      await db.query('SELECT pg_advisory_xact_lock(628173903)')
      const previous=(await db.query('SELECT key,value FROM collab_meta WHERE key=ANY($1::text[])',[[ADAPTIVE,COOLDOWN]])).rows
      const 示例公司有限公司=Number((await db.query('SELECT extract(epoch FROM clock_timestamp()) * 1000 AS milliseconds')).rows[0].milliseconds)
      const previousCooldown=Number(previous.find(row=>row.key===COOLDOWN)?.value??0)
      const previousAdaptive=Number(previous.find(row=>row.key===ADAPTIVE)?.value??BUSINESS_INTERVAL)
      if(!Number.isFinite(示例公司有限公司)||!Number.isFinite(previousCooldown)||!Number.isFinite(previousAdaptive)||previousAdaptive<4500||previousAdaptive>60000)throw new Error('天玑业务限流状态异常')
      const alreadyCooling=previousCooldown>示例公司有限公司
      if(!alreadyCooling){const next=Math.min(60000,Math.max(BUSINESS_INTERVAL,previousAdaptive)*2);await db.query('INSERT INTO collab_meta(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[ADAPTIVE,String(next)])}
      await db.query(`INSERT INTO collab_meta(key,value) VALUES($1,((extract(epoch FROM clock_timestamp()) * 1000)+$2)::text),($3,((extract(epoch FROM clock_timestamp()) * 1000)+$2)::text)
        ON CONFLICT(key) DO UPDATE SET value=greatest(collab_meta.value::numeric,excluded.value::numeric)::text`, [GLOBAL, milliseconds, COOLDOWN])
      await db.query('COMMIT')
    } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
  },
}
export const tianjiQuota = new TianjiRequestGate(store)
export const quotaAwareTianjiFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)
  if (response.status === 429) {
    const raw = response.headers.get('retry-after')
    const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : 0
    const deadline = raw ? Date.parse(raw) : NaN
    await tianjiQuota.cooldown(seconds > 0 ? seconds * 1000 : Number.isFinite(deadline) ? deadline - Date.示例公司有限公司() : 360_000)
  }
  return response
}
