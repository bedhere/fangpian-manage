import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { database } from '../../platform/database'
import { tianji } from '../../platform/tianji'
import type { DashboardLoginIdentity } from '../../platform/dashboard-auth'
import * as reference from './commerce-reference.json'
import {
  aggregate,
  amountCents,
  CALENDAR_ENDPOINT,
  classify,
  COMMERCE_RULE_VERSION,
  eligible,
  METRICS,
  moneyToCents,
  normalizeOrder,
  ORDER_ENDPOINT,
  orderReadWindows,
  parsePeriods,
  sha256,
  TIME_FIELDS,
  tianjiOrderRange,
  type CommercePerson,
  type Dimension,
  type MetricKey,
  type Period,
} from './commerce-domain'
import {
  ensureCommerceSchema,
  readActive,
  readCatalog,
  readTargetOverrides,
  saveCatalog,
} from './commerce-repository'

export const COMMERCE_PEOPLE = reference.people as CommercePerson[]
export function isCommerceManager(identity: DashboardLoginIdentity) {
  return (
    (identity.employeeName === '示例开发01' && identity.employeeId === 275) ||
    (identity.employeeName === '示例开发09' && identity.employeeId === 149)
  )
}
export function allowedCommercePeople(identity: DashboardLoginIdentity) {
  if (!COMMERCE_PEOPLE.some((p) => p.id === identity.employeeId && p.name === identity.employeeName))
    return []
  return COMMERCE_PEOPLE.filter((p) => identity.allowedEmployeeNames.includes(p.name))
}
const DIMENSIONS: Dimension[] = ['publish', 'deal', 'payment']
const TOTAL_ENDPOINT = '/api/admin/statOrderRevenue/getEmployeeRevenue'
const REVENUE_TYPES: Record<Dimension,string> = {publish:'publish',deal:'order',payment:'settlement'}
const FIELDS = [
  'id',
  'order_code',
  'order_type',
  'order_status',
  'platform_id',
  'platform_name',
  'payment_business_employee_id',
  'customer_facing_employee_id',
  'customer_name',
  'brand_name',
  'creator_nickname',
  'creator',
  'department_name',
  'order_money',
  'income_money',
  'market_flag',
  'publish_time',
  'order_date',
  'payment_time',
]

@Injectable()
export class CommerceService {
  private syncing = new Map<number, Promise<unknown>>()

  private person(identity: DashboardLoginIdentity, id: number) {
    const person = allowedCommercePeople(identity).find((p) => p.id === id)
    if (!person) throw new ForbiddenException('无权查看该人员商务数据')
    return person
  }
  async catalog(identity: DashboardLoginIdentity) {
    const catalog = await readCatalog()
    return {
      people: allowedCommercePeople(identity),
      periods: catalog?.periods ?? [],
      calendarSource: catalog?.source ?? null,
      canManage: isCommerceManager(identity),
      metrics: METRICS,
      referenceSource: reference.source,
      unresolved: reference.unresolved,
      ruleVersion: COMMERCE_RULE_VERSION,
    }
  }
  async status(identity: DashboardLoginIdentity, personId: number, periodId: number) {
    this.person(identity, personId)
    const { period } = await this.period(periodId),
      monthId = period.kind === 'month' ? period.id : period.parentId
    const active = (
      await database.query('SELECT batch_id FROM commerce_active_batches WHERE month_id=$1', [monthId])
    ).rows[0]
    const latest =
      (
        await database.query(
          'SELECT id,status,error,started_at,finished_at FROM commerce_batches WHERE month_id=$1 ORDER BY started_at DESC LIMIT 1',
          [monthId],
        )
      ).rows[0] ?? null
    const queued=(await database.query('SELECT slot,requested_at FROM commerce_refresh_queue WHERE month_id=$1',[monthId])).rows[0]??null
    return { batchId: active?.batch_id ?? null, latest,queued }
  }
  private async period(id: number) {
    const catalog = await readCatalog(),
      period = catalog?.periods.find((p) => p.id === id)
    if (!period) throw new BadRequestException('所选方片周期尚未同步，请由管理员刷新日历及数据')
    return { period, periods: catalog.periods }
  }
  async report(identity: DashboardLoginIdentity, personId: number, periodId: number, dimension: Dimension) {
    const person = this.person(identity, personId),
      { period, periods } = await this.period(periodId)
    const monthId = period.kind === 'month' ? period.id : period.parentId
    const current = await readActive(monthId, dimension)
    const previousPeriod = periods
      .filter((p) => p.kind === period.kind && p.end <= period.start)
      .sort((a, b) => b.end - a.end)[0]
    const previous = previousPeriod
      ? await readActive(
          previousPeriod.kind === 'month' ? previousPeriod.id : previousPeriod.parentId,
          dimension,
        )
      : null
    const monthPeriod = periods.find((p) => p.id === monthId && p.kind === 'month')!
    const currentValues = current.batch ? aggregate(current.orders, person, dimension, period) : null
    const previousValues =
      previous?.batch && previousPeriod ? aggregate(previous.orders, person, dimension, previousPeriod) : null
    const monthlyValues = current.batch
      ? aggregate(current.orders, person, dimension, {
          ...monthPeriod,
          end: Math.min(monthPeriod.end, period.end),
        })
      : null
    const originalTotal = async (batch:any, selectedPeriod:Period|undefined) => {
      if(!batch || !selectedPeriod)return null
      // The existing project deliberately computes Zhou Li's total from her
      // customer-order rows instead of the wider employee-revenue API.
      if(personId===668){
        const orders=batch.id===current.batch?.id?current.orders:previous?.orders??[]
        const values=aggregate(orders,person,dimension,selectedPeriod)
        return {cents:values.totalCents,count:values.orderCount,source:{endpoint:ORDER_ENDPOINT,batchId:batch.id,personId,periodId:selectedPeriod.id,timeField:TIME_FIELDS[dimension],convention:'existing-zhou-li-customer-order-total',ruleVersion:COMMERCE_RULE_VERSION}}
      }
      const row=(await database.query('SELECT cents,order_count,source FROM commerce_original_totals WHERE batch_id=$1 AND period_id=$2 AND dimension=$3 AND employee_id=$4',[batch.id,selectedPeriod.id,dimension,personId])).rows[0]
      return row ? {cents:Number(row.cents),count:row.order_count,source:row.source} : null
    }
    const original = {current:await originalTotal(current.batch,period),previous:await originalTotal(previous?.batch,previousPeriod)}
    const targets =
      period.kind === 'month' && dimension === 'publish' ? await this.targets(personId, monthId) : []
    const sourceAllocations = monthId === reference.source.monthId && period.kind === 'month' && dimension === 'publish'
      ? reference.allocations.filter(a => person.role === 'developer' ? a.developerId === personId : a.employeeId === personId)
      : []
    const allocation = sourceAllocations.length ? {
      entries: sourceAllocations.map(a => ({
        employeeId: a.employeeId, employeeName: COMMERCE_PEOPLE.find(p => p.id === a.employeeId)?.name,
        developerId: a.developerId, developerName: COMMERCE_PEOPLE.find(p => p.id === a.developerId)?.name,
        cents: a.targets.reduce((sum, t) => sum + t.cents, 0), targets: a.targets,
      })),
      allocatedCents: sourceAllocations.reduce((sum, a) => sum + a.targets.reduce((n, t) => n + t.cents, 0), 0),
    } : null
    return {
      person,
      period,
      previousPeriod: previousPeriod ?? null,
      current: currentValues,
      previous: previousValues,
      monthToDate: monthlyValues,
      original,
      targets,
      allocation,
      updatedAt: current.batch?.finished_at ?? null,
      batchId: current.batch?.id ?? null,
      synchronization: current.latest ? {
        id:current.latest.id,status:current.latest.status,error:current.latest.error,
        started_at:current.latest.started_at,finished_at:current.latest.finished_at,
      } : null,
      queued:current.queued,
      source: {
        endpoint: ORDER_ENDPOINT,
        ruleVersion: COMMERCE_RULE_VERSION,
        timeField: TIME_FIELDS[dimension],
        employeeField:
          person.role === 'developer' ? 'payment_business_employee_id' : 'customer_facing_employee_id',
        amountFields: { self: 'order_money', signing: 'income_money', outsourcing: 'income_money' },
        selfVpFields: ['creator.employee_name', 'department_name'],
        periodConvention: '[start,end)',
        providerConvention: 'inclusive start,end-1 seconds',
        statusCodes: dimension === 'payment' ? [300] : [100, 200, 300],
      },
      canManage: isCommerceManager(identity),
    }
  }
  private async targets(personId: number, monthId: number) {
    const baseline = reference.targets.filter((t) => t.employeeId === personId && t.monthId === monthId)
    const overrides = await readTargetOverrides(monthId, personId)
    return METRICS.map(([metric]) => {
      const manual = overrides.find((r) => r.metric === metric),
        original = baseline.find((t) => t.metric === metric)
      return {
        metric,
        cents: manual ? Number(manual.cents) : (original?.cents ?? null),
        source: manual ? manual.source : (original?.source ?? null),
        updatedBy: manual?.updated_by ?? null,
        updatedAt: manual?.updated_at ?? null,
      }
    })
  }
  async orders(
    identity: DashboardLoginIdentity,
    personId: number,
    periodId: number,
    dimension: Dimension,
    filters: {
      metric?: string
      company?: string
      brand?: string
      search?: string
      page?: number
      pageSize?: number
      group?: string
      batchId?: string
    },
  ) {
    const person = this.person(identity, personId),
      { period } = await this.period(periodId)
    const data = await readActive(
      period.kind === 'month' ? period.id : period.parentId,
      dimension,
      filters.batchId,
    )
    if (!data.batch) throw new ServiceUnavailableException('该周期尚无完整成功批次，不能将缺失数据视为零')
    const metrics = new Set<string>(METRICS.map(([key]) => key))
    if (filters.metric && !metrics.has(filters.metric) && filters.metric !== 'unclassified')
      throw new BadRequestException('业绩分类无效')
    let rows = data.orders.filter((o) => eligible(o, person, dimension, period))
    if (filters.metric)
      rows = rows.filter((o) =>
        filters.metric === 'unclassified' ? !classify(o) : classify(o) === filters.metric,
      )
    if (filters.company) rows = rows.filter((o) => o.company === filters.company)
    if (filters.brand) rows = rows.filter((o) => o.brand === filters.brand)
    if (filters.search) {
      const q = filters.search.trim().toLocaleLowerCase()
      rows = rows.filter((o) =>
        [o.code, o.company, o.brand, o.creator].some((v) => v.toLocaleLowerCase().includes(q)),
      )
    }
    const grouped = new Map<string, { name: string; cents: number; count: number }>()
    for (const o of rows) {
      const name = filters.group === 'brand' ? o.brand : o.company
      const v = grouped.get(name) || { name, cents: 0, count: 0 }
      v.cents += amountCents(o)
      v.count++
      grouped.set(name, v)
    }
    const page = filters.page ?? 1,
      pageSize = filters.pageSize ?? 50
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw new BadRequestException('分页参数无效')
    const selected = rows
      .sort((a, b) => b.times[dimension] - a.times[dimension] || b.id - a.id)
      .slice((page - 1) * pageSize, page * pageSize)
    const pages = [...new Set(selected.map((o) => o.id))]
    const evidence = pages.length
      ? (
          await database.query(
            `SELECT o.order_id,s.evidence FROM commerce_orders o JOIN commerce_page_sources s
      ON s.batch_id=o.batch_id AND s.dimension=o.dimension AND s.page_number=o.page_number
      WHERE o.batch_id=$1 AND o.dimension=$2 AND o.order_id=ANY($3::bigint[])`,
            [data.batch.id, dimension, pages],
          )
        ).rows
      : []
    return {
      batchId: data.batch.id,
      updatedAt: data.batch.finished_at,
      total: rows.length,
      page,
      pageSize,
      cents: rows.reduce((sum, o) => sum + amountCents(o), 0),
      groups: [...grouped.values()].sort((a, b) => b.cents - a.cents),
      rows: selected.map((o) => ({
        ...o,
        metric: classify(o),
        cents: amountCents(o),
        performanceAt: o.times[dimension],
        source: {
          endpoint: ORDER_ENDPOINT,
          batchId: data.batch.id,
          query: evidence.find((p) => Number(p.order_id) === o.id)?.evidence.query,
          hash: o.sourceHash,
        },
      })),
    }
  }
  async evidence(
    identity: DashboardLoginIdentity,
    personId: number,
    periodId: number,
    dimension: Dimension,
    orderId: number,
    batchId?: string,
  ) {
    const person = this.person(identity, personId),
      { period } = await this.period(periodId),
      data = await readActive(period.kind === 'month' ? period.id : period.parentId, dimension, batchId)
    const order = data.orders.find((o) => o.id === orderId && eligible(o, person, dimension, period))
    if (!order || !data.batch) throw new ForbiddenException('该订单不在当前授权范围')
    const source = (
      await database.query(
        `SELECT s.evidence FROM commerce_orders o JOIN commerce_page_sources s
      ON s.batch_id=o.batch_id AND s.dimension=o.dimension AND s.page_number=o.page_number
      WHERE o.batch_id=$1 AND o.dimension=$2 AND o.order_id=$3`,
        [data.batch.id, dimension, orderId],
      )
    ).rows[0]?.evidence
    return { order, source, ruleVersion: COMMERCE_RULE_VERSION }
  }
  async saveTargets(identity: DashboardLoginIdentity, personId: number, monthId: number, input: unknown) {
    if (!isCommerceManager(identity)) throw new ForbiddenException('仅示例开发01、示例开发09可编辑发布目标')
    this.person(identity, personId)
    const { period } = await this.period(monthId)
    if (period.kind !== 'month' || !Array.isArray(input) || input.length !== METRICS.length)
      throw new BadRequestException('仅支持完整的月度发布目标')
    const keys = new Set<string>(),
      values: Array<{ metric: MetricKey; cents: number }> = []
    for (const v of input) {
      if (
        !v ||
        !METRICS.some(([k]) => k === v.metric) ||
        keys.has(v.metric) ||
        !Number.isSafeInteger(v.cents) ||
        v.cents < 0
      )
        throw new BadRequestException('目标必须为非负整数分，且每个指标仅出现一次')
      keys.add(v.metric)
      values.push(v)
    }
    const db = await database.connect()
    try {
      await db.query('BEGIN')
      await db.query('SELECT pg_advisory_xact_lock($1,$2)', [monthId, personId])
      const before = await this.targets(personId, monthId)
      for (const value of values)
        await db.query(
          `INSERT INTO commerce_target_overrides(month_id,employee_id,metric,cents,source,updated_by)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(month_id,employee_id,metric) DO UPDATE
        SET cents=excluded.cents,source=excluded.source,updated_by=excluded.updated_by,updated_at=示例公司有限公司()`,
          [
            monthId,
            personId,
            value.metric,
            value.cents,
            JSON.stringify({
              kind: 'manual',
              actor: identity.employeeName,
              at: new Date().toISOString(),
              original:
                reference.targets.find(
                  (t) => t.employeeId === personId && t.monthId === monthId && t.metric === value.metric,
                )?.source ?? null,
            }),
            identity.employeeName,
          ],
        )
      await db.query(
        'INSERT INTO commerce_target_audit(month_id,employee_id,actor,changes) VALUES($1,$2,$3,$4)',
        [monthId, personId, identity.employeeName, JSON.stringify({ before, after: values })],
      )
      await db.query('COMMIT')
    } catch (e) {
      await db.query('ROLLBACK')
      throw e
    } finally {
      db.release()
    }
    return this.targets(personId, monthId)
  }

  async refreshCatalog() {
    await ensureCommerceSchema()
    const response = await tianji.call<any>(CALENDAR_ENDPOINT, { page: 1, pageSize: 1000 })
    const rows = response.data?.list
    if (!Array.isArray(rows) || rows.length !== Number(response.data.count ?? response.data.total))
      throw new Error('方片日历响应不完整，未覆盖已保存日历')
    const periods = parsePeriods(rows),
      source = {
        endpoint: CALENDAR_ENDPOINT,
        query: { page: 1, pageSize: 1000 },
        observedAt: new Date().toISOString(),
        sha256: sha256(rows),
        count: rows.length,
      }
    await saveCatalog(periods, source)
    return periods
  }
  async refresh(monthId: number, slot: string, onProgress: (message: string) => void = () => {}) {
    const existing = this.syncing.get(monthId)
    if (existing) return existing
    if(!(await readCatalog()))await this.refreshCatalog()
    const {period}=await this.period(monthId)
    if(period.kind!=='month')throw new BadRequestException('同步必须选择方片月')
    const completed=(await database.query("SELECT id FROM commerce_batches WHERE month_id=$1 AND rule_version=$2 AND progress->>'slot'=$3 AND status='complete' ORDER BY started_at DESC LIMIT 1",[monthId,COMMERCE_RULE_VERSION,slot])).rows[0]
    if(completed)return {status:'complete',batchId:completed.id}
    const requested=(await database.query('INSERT INTO commerce_refresh_queue(month_id,slot) VALUES($1,$2) ON CONFLICT(month_id) DO UPDATE SET slot=commerce_refresh_queue.slot RETURNING slot',[monthId,slot])).rows[0].slot
    const raced=this.syncing.get(monthId)
    if(raced)return raced
    const work = this.runRefresh(monthId, requested, onProgress).then(async(result)=>{
      if(result.status==='complete')await database.query('DELETE FROM commerce_refresh_queue WHERE month_id=$1 AND slot=$2',[monthId,requested])
      return result
    }).finally(() => this.syncing.delete(monthId))
    this.syncing.set(monthId, work)
    return work
  }
  async drainQueued(log:(message:string)=>void){
    const pending=(await database.query('SELECT month_id,slot FROM commerce_refresh_queue ORDER BY requested_at LIMIT 1')).rows[0]
    if(pending)await this.refresh(pending.month_id,pending.slot,log)
  }
  private async captureOriginalTotals(batchId:string,period:Period,dimension:Dimension){
    const present=(await database.query('SELECT employee_id FROM commerce_original_totals WHERE batch_id=$1 AND period_id=$2 AND dimension=$3',[batchId,period.id,dimension])).rows
    const missing=COMMERCE_PEOPLE.filter(p=>p.id!==668&&!present.some(r=>r.employee_id===p.id))
    if(!missing.length)return
    const base={year_id:period.year,month_id:period.kind==='month'?period.id:period.parentId,...(period.kind==='week'?{week_id:period.id}:{}),time_range:period.kind,revenue_type:REVENUE_TYPES[dimension],is_foreign_broker:0,platform_id:0}
    const save=async(query:Record<string,unknown>,people:CommercePerson[],single=false)=>{
      const response=await tianji.call<any>(TOTAL_ENDPOINT,query)
      const data=response.data,range=data?.date_range
      if(!Array.isArray(data?.employee_revenue)||Number(range?.start_time)!==period.start||Number(range?.end_time)!==period.end)throw new Error('原总业绩周期或响应无效，未发布该批数据')
      const seen=new Set<number>()
      for(const record of data.employee_revenue){const id=Number(record.employee_id);if(seen.has(id))throw new Error('原总业绩人员重复');seen.add(id)}
      for(const person of people){
        const record=data.employee_revenue.find((r:any)=>Number(r.employee_id)===person.id)
        if(!record&&!single)continue
        const cents=moneyToCents(record?record.revenue:data.total_revenue),count=Number(record?record.ordernum:data.total_ordernum)
        if(!Number.isSafeInteger(count)||count<0)throw new Error('原总业绩订单数无效')
        if(!record&&(data.employee_revenue.length||cents!==0||count!==0))throw new Error('原总业绩缺少对应人员，不能推测归属')
        const source={endpoint:TOTAL_ENDPOINT,query,observedAt:new Date().toISOString(),sha256:sha256(data),record:record??{employee_id:person.id,total_revenue:data.total_revenue,total_ordernum:data.total_ordernum},convention:'original-independent-total'}
        await database.query('INSERT INTO commerce_original_totals(batch_id,period_id,dimension,employee_id,cents,order_count,source) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',[batchId,period.id,dimension,person.id,cents,count,JSON.stringify(source)])
      }
    }
    for(const role of ['developer','customer'] as const){
      const people=missing.filter(p=>p.role===role&&p.id!==668)
      if(people.length)await save({...base,department_id:9,performance_type:role==='developer'?'develop':'customer'},people)
    }
    const saved=(await database.query('SELECT employee_id FROM commerce_original_totals WHERE batch_id=$1 AND period_id=$2 AND dimension=$3',[batchId,period.id,dimension])).rows
    for(const person of missing.filter(p=>!saved.some(r=>r.employee_id===p.id)))await save({...base,employee_id:person.id,performance_type:person.role==='developer'?'develop':'customer'},[person],true)
  }
  private async discardInterval(
    batchId: string,
    dimension: Dimension,
    progress: any,
    index?: number,
    replacement?: any,
  ) {
    if (index === undefined) delete progress.dimensions[dimension]
    else if (replacement) progress.dimensions[dimension].segments[index] = replacement
    else delete progress.dimensions[dimension].segments[index]
    const db = await database.connect()
    try {
      await db.query('BEGIN')
      for (const table of ['commerce_orders', 'commerce_page_sources']) {
        if (index === undefined)
          await db.query(`DELETE FROM ${table} WHERE batch_id=$1 AND dimension=$2`, [batchId, dimension])
        else
          await db.query(
            `DELETE FROM ${table} WHERE batch_id=$1 AND dimension=$2 AND page_number>=$3 AND page_number<$4`,
            [batchId, dimension, index * 10000, (index + 1) * 10000],
          )
      }
      await db.query('UPDATE commerce_batches SET progress=$2 WHERE id=$1', [
        batchId,
        JSON.stringify(progress),
      ])
      await db.query('COMMIT')
    } catch (e) {
      await db.query('ROLLBACK')
      throw e
    } finally {
      db.release()
    }
  }
  private async runRefresh(monthId: number, slot: string, log: (message: string) => void) {
    await ensureCommerceSchema()
    const lock = await database.connect()
    let batchId: string | undefined,
      activeDimension: Dimension | undefined,
      activeWindowIndex: number | undefined,
      ownsLock = false
    try {
      // Session advisory lock covers workers, UI refresh and multiple replicas.
      const acquired = (await lock.query('SELECT pg_try_advisory_lock(628173912) AS acquired')).rows[0]
        .acquired
      if (!acquired) return { status: 'queued', message: '已有商务数据同步任务正在执行' }
      ownsLock = true
      const previous = (
        await database.query(
          `SELECT * FROM commerce_batches WHERE month_id=$1 AND rule_version=$2
        AND progress->>'slot'=$3 ORDER BY started_at DESC LIMIT 1`,
          [monthId, COMMERCE_RULE_VERSION, slot],
        )
      ).rows[0]
      if (previous?.status === 'complete') return { status: 'complete', batchId: previous.id }
      batchId = previous?.id ?? `commerce_${randomUUID()}`
      const progress = previous?.progress ?? { slot, dimensions: {} }
      if (!previous)
        await database.query(
          'INSERT INTO commerce_batches(id,month_id,rule_version,status,progress) VALUES($1,$2,$3,$4,$5)',
          [batchId, monthId, COMMERCE_RULE_VERSION, 'running', JSON.stringify(progress)],
        )
      else
        await database.query("UPDATE commerce_batches SET status='running',error=NULL WHERE id=$1", [batchId])
      const periods = await this.refreshCatalog(),
        month = periods.find((p) => p.id === monthId && p.kind === 'month')
      if (!month) throw new BadRequestException('方片月份无效')
      if (progress.period && (progress.period.start !== month.start || progress.period.end !== month.end)) {
        await database.query('DELETE FROM commerce_orders WHERE batch_id=$1', [batchId])
        await database.query('DELETE FROM commerce_page_sources WHERE batch_id=$1', [batchId])
        await database.query('DELETE FROM commerce_original_totals WHERE batch_id=$1', [batchId])
        progress.dimensions = {}
        delete progress.readWindows
        progress.restartReason = '天玑周期配置发生变化'
      }
      progress.period = month
      for (const dimension of DIMENSIONS) {
        if (progress.dimensions[dimension]?.complete) continue
        activeDimension = dimension
        const state = progress.dimensions[dimension] ?? { segments: {}, total: 0 }
        progress.dimensions[dimension] = state
        const windows = progress.readWindows ?? (progress.readWindows = orderReadWindows(month))
        for (const window of windows) {
          activeWindowIndex = window.index
          let segment = state.segments[window.index] ?? {
            page: 1,
            pageSize: 50,
            received: 0,
            total: null,
            start: window.start,
            end: window.end,
          }
          state.segments[window.index] = segment
          if (segment.complete) continue
          while (!segment.fetched) {
            const query = {
              page: segment.page,
              pageSize: segment.pageSize ?? 50,
              [TIME_FIELDS[dimension]]: tianjiOrderRange(window),
              is_permission: 0,
            }
            const pageKey = window.index * 10000 + segment.page
            log(`商务同步 ${month.title} · ${dimension} · 日期段${window.index} · 第${segment.page}页`)
            let response: any
            try {
              response = await tianji.call<any>(ORDER_ENDPOINT, query, FIELDS)
            } catch (error) {
              if (
                error instanceof Error &&
                /响应无效或超过大小限制/.test(error.message) &&
                query.pageSize > 1
              ) {
                const replacement = {
                  page: 1,
                  pageSize: Math.max(1, Math.floor(query.pageSize / 2)),
                  received: 0,
                  total: null,
                  start: window.start,
                  end: window.end,
                  adaptedBecause: '上游响应超限，缩小分页并重新校验该日期',
                }
                await this.discardInterval(batchId, dimension, progress, window.index, replacement)
                segment = replacement
                log(`响应超限，日期段${window.index}调整为每页${segment.pageSize}条`)
                continue
              }
              throw error
            }
            const list = response.data?.list,
              total = Number(response.data?.count ?? response.data?.total)
            if (!Array.isArray(list) || !Number.isSafeInteger(total) || total < 0)
              throw new Error('订单分页响应缺少有效列表或总数')
            if (segment.total !== null && segment.total !== total)
              throw new Error('同步期间订单总数发生变化，当前阶段须重新读取')
            segment.total = total
            if (list.length === 0 && segment.received < total) throw new Error('订单分页提前返回空列表')
            if (segment.received + list.length > total) throw new Error('分页条数超过上游总数')
            const normalized = list.map(normalizeOrder)
            if (normalized.some((o) => o.times[dimension] < window.start || o.times[dimension] >= window.end))
              throw new Error('天玑返回订单超出查询周期，已停止发布本批数据')
            const db = await database.connect()
            try {
              await db.query('BEGIN')
              for (const order of normalized)
                await db.query(
                  'INSERT INTO commerce_orders(batch_id,dimension,order_id,payload,page_number) VALUES($1,$2,$3,$4,$5)',
                  [batchId, dimension, order.id, JSON.stringify(order), pageKey],
                )
              const source = {
                endpoint: ORDER_ENDPOINT,
                query,
                fields: FIELDS,
                total,
                received: list.length,
                observedAt: new Date().toISOString(),
                sha256: sha256(list),
                ruleVersion: COMMERCE_RULE_VERSION,
              }
              await db.query(
                'INSERT INTO commerce_page_sources(batch_id,dimension,page_number,evidence) VALUES($1,$2,$3,$4)',
                [batchId, dimension, pageKey, JSON.stringify(source)],
              )
              segment.received += list.length
              segment.page++
              segment.fetched = segment.received === total
              if (!segment.fetched && list.length < query.pageSize)
                throw new Error('订单分页不完整，未发布本批数据')
              await db.query('UPDATE commerce_batches SET progress=$2 WHERE id=$1', [
                batchId,
                JSON.stringify(progress),
              ])
              await db.query('COMMIT')
            } catch (e) {
              await db.query('ROLLBACK')
              throw e
            } finally {
              db.release()
            }
            if (segment.page > 9999) throw new Error('订单分页超出安全上限')
          }
          // A single page already includes the complete count and record set.
          // Multiple pages must recheck the count before accepting the interval.
          if (segment.page > 2) {
            const check = await tianji.call<any>(
              ORDER_ENDPOINT,
              {
                page: 1,
                pageSize: 1,
                [TIME_FIELDS[dimension]]: tianjiOrderRange(window),
                is_permission: 0,
              },
              ['id'],
            )
            if (Number(check.data?.count ?? check.data?.total) !== segment.total)
              throw new Error('完成校验时订单数量变化，当前阶段须重新读取')
          }
          segment.complete = true
          await database.query('UPDATE commerce_batches SET progress=$2 WHERE id=$1', [
            batchId,
            JSON.stringify(progress),
          ])
        }
        state.total = Object.values(state.segments).reduce((sum: number, v: any) => sum + v.total, 0)
        const check = await tianji.call<any>(
          ORDER_ENDPOINT,
          { page: 1, pageSize: 1, [TIME_FIELDS[dimension]]: tianjiOrderRange(month), is_permission: 0 },
          ['id'],
        )
        if (Number(check.data?.count ?? check.data?.total) !== state.total) {
          // Locate and invalidate only changed intervals. Preserve every other
          // successful page, including after a process restart or rate limit.
          for (const window of windows) {
            const probe = await tianji.call<any>(
              ORDER_ENDPOINT,
              {
                page: 1,
                pageSize: 1,
                [TIME_FIELDS[dimension]]: tianjiOrderRange(window),
                is_permission: 0,
              },
              ['id'],
            )
            if (Number(probe.data?.count ?? probe.data?.total) !== state.segments[window.index].total) {
              await this.discardInterval(batchId, dimension, progress, window.index)
            }
          }
          await database.query('UPDATE commerce_batches SET progress=$2 WHERE id=$1', [
            batchId,
            JSON.stringify(progress),
          ])
          throw new Error('方片月条数校验发生变化，将仅重读有变动的日期')
        }
        state.complete = true
        await database.query('UPDATE commerce_batches SET progress=$2 WHERE id=$1', [
          batchId,
          JSON.stringify(progress),
        ])
      }
      for(const period of periods.filter(p=>(p.id===monthId||p.kind==='week'&&p.parentId===monthId)&&p.start<=Date.示例公司有限公司()/1000)){
        for(const dimension of DIMENSIONS){
          log(`核对原总业绩 ${period.title} · ${dimension}`)
          await this.captureOriginalTotals(batchId,period,dimension)
        }
      }
      const stored = (
        await database.query(
          'SELECT dimension,count(*)::integer AS count FROM commerce_orders WHERE batch_id=$1 GROUP BY dimension',
          [batchId],
        )
      ).rows
      if (
        DIMENSIONS.some(
          (d) =>
            !progress.dimensions[d]?.complete ||
            (stored.find((r) => r.dimension === d)?.count ?? 0) !== progress.dimensions[d].total,
        )
      )
        throw new Error('入库条数与已校验源数据不一致')
      const db = await database.connect()
      try {
        await db.query('BEGIN')
        await db.query(
          "UPDATE commerce_batches SET status='complete',finished_at=示例公司有限公司(),error=NULL WHERE id=$1",
          [batchId],
        )
        await db.query(
          'INSERT INTO commerce_active_batches(month_id,batch_id) VALUES($1,$2) ON CONFLICT(month_id) DO UPDATE SET batch_id=excluded.batch_id',
          [monthId, batchId],
        )
        await db.query('COMMIT')
      } catch (e) {
        await db.query('ROLLBACK')
        throw e
      } finally {
        db.release()
      }
      return { status: 'complete', batchId }
    } catch (error) {
      if (batchId) {
        const message = error instanceof Error ? error.message : '同步失败'
        await database.query("UPDATE commerce_batches SET status='delayed',error=$2 WHERE id=$1", [
          batchId,
          message.slice(0, 500),
        ])
        // Changed totals/duplicate IDs require restarting only the affected
        // dimension on retry. Other completed dimensions remain reusable.
        if (/数量变化|总数发生变化|duplicate key|分页不完整|提前返回/.test(message)) {
          const b = (await database.query('SELECT progress FROM commerce_batches WHERE id=$1', [batchId]))
            .rows[0]
          if (activeDimension)
            await this.discardInterval(
              batchId,
              activeDimension,
              b.progress,
              /duplicate key/.test(message) ? undefined : activeWindowIndex,
            )
        }
      }
      throw error
    } finally {
      if (ownsLock) await lock.query('SELECT pg_advisory_unlock(628173912)').catch(() => {})
      lock.release()
    }
  }
}
