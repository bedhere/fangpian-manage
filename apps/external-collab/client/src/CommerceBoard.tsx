import { useEffect, useRef, useState } from 'react'
import './commerce-board.css'
interface DashboardLoginIdentity {
  employeeId: number
  employeeName: string
}

interface Person {
  id: number
  name: string
  alias?: string
  role: 'developer' | 'customer'
  relatedCustomerIds: number[]
}
interface Period {
  id: number
  title: string
  kind: 'month' | 'week'
  parentId: number
  year: number
  start: number
  end: number
}
interface Catalog {
  people: Person[]
  periods: Period[]
  canManage: boolean
  metrics: [string, string][]
  referenceSource: any
  ruleVersion: string
}
interface Totals {
  metrics: Record<string, { cents: number; count: number }>
  totalCents: number
  orderCount: number
  unclassifiedCents: number
  unclassifiedCount: number
}
interface Report {
  person: Person
  period: Period
  previousPeriod: Period | null
  current: Totals | null
  previous: Totals | null
  monthToDate: Totals | null
  original?: {current:{cents:number;count:number;source:any}|null;previous:{cents:number;count:number;source:any}|null}
  targets: { metric: string; cents: number | null; source: any }[]
  allocation?: { entries: {employeeId:number;employeeName:string;developerName:string;cents:number;targets:any[]}[]; allocatedCents:number } | null
  updatedAt: string | null
  batchId: string | null
  synchronization: any
  queued?:any
  source: any
  canManage: boolean
}
interface OrderList {
  total: number
  cents: number
  page: number
  pageSize: number
  groups: { name: string; cents: number; count: number }[]
  rows: any[]
  batchId: string
}
const fmt = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const money = (cents: number | null | undefined) => (cents == null ? '—' : `¥${fmt.format(cents / 100)}`)
const date = (epoch: number) =>
  new Date(epoch * 1000).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
const time = (value: string | number | null) =>
  value
    ? new Date(typeof value === 'number' ? value * 1000 : value).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
      })
    : '尚未同步'
async function api<T>(route: string, signal?: AbortSignal, body?: unknown, method = 'GET'): Promise<T> {
  const response = await fetch(`/api/dashboard/commerce/${route}`, {
    credentials: 'include',
    signal,
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || '读取商务数据失败')
  return data
}
async function waitJob(id: string, update: (message: string) => void) {
  for (let n = 0; n < 3600; n++) {
    const response = await fetch(`/api/jobs/${id}`, { credentials: 'include' })
    const job = await response.json()
    if (!response.ok) throw new Error(job.message || '无法读取同步任务')
    update(job.progress || job.message || '正在同步，请稍候…')
    if (job.status === 'done' || job.status === 'completed' || job.status === 'success') return job.data
    if (job.status === 'failed' || job.status === 'error')
      throw new Error(job.error || '同步暂时失败，已保留最近成功数据')
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error('后台同步仍在进行，请稍后查看更新状态')
}
export default function CommerceBoard({
  identity,
  onLegacy,
}: {
  identity: DashboardLoginIdentity
  onLegacy: () => void
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [personId, setPersonId] = useState(identity.employeeId)
  const [monthId, setMonthId] = useState<number>(0),
    [kind, setKind] = useState<'month' | 'week'>('month'),
    [weekId, setWeekId] = useState<number>(0)
  const [dimension, setDimension] = useState<'publish' | 'deal' | 'payment'>('publish'),
    [report, setReport] = useState<Report | null>(null)
  const [metric, setMetric] = useState(''),
    [company, setCompany] = useState(''),
    [brand, setBrand] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1)
  const [detail, setDetail] = useState<OrderList | null>(null),
    [detailTab, setDetailTab] = useState<'company' | 'brand' | 'orders'>('company')
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [revision, setRevision] = useState(0)
  const [source, setSource] = useState<any>(null),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Record<string, string>>({})
  const [peopleSearch, setPeopleSearch] = useState('')
  const sourceDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (source && !sourceDialog.current?.open) sourceDialog.current?.showModal()
  }, [source])
  const months = catalog?.periods.filter((p) => p.kind === 'month').sort((a, b) => b.start - a.start) ?? []
  const weeks =
    catalog?.periods
      .filter((p) => p.kind === 'week' && p.parentId === monthId)
      .sort((a, b) => a.start - b.start) ?? []
  const periodId = kind === 'month' ? monthId : weekId
  useEffect(() => {
    const controller = new AbortController()
    api<Catalog>('catalog', controller.signal)
      .then((data) => {
        setCatalog(data)
        setError('')
        if (!data.people.some((p) => p.id === personId)) setPersonId(data.people[0]?.id ?? 0)
        const 示例公司有限公司 = Date.示例公司有限公司() / 1000,
          current = data.periods.find((p) => p.kind === 'month' && p.start <= 示例公司有限公司 && 示例公司有限公司 < p.end)
        setMonthId((old) =>
          data.periods.some((p) => p.id === old && p.kind === 'month') ? old : (current?.id ?? 0),
        )
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [revision])
  useEffect(() => {
    const 示例公司有限公司 = Date.示例公司有限公司() / 1000
    setWeekId((old) =>
      weeks.some((p) => p.id === old)
        ? old
        : (weeks.find((p) => p.start <= 示例公司有限公司 && 示例公司有限公司 < p.end)?.id ?? weeks[0]?.id ?? 0),
    )
  }, [monthId, catalog])
  useEffect(() => {
    setMetric('')
    setCompany('')
    setBrand('')
    setSearch('')
    setPage(1)
    setEditing(false)
  }, [personId, periodId, dimension])
  useEffect(() => {
    if (!periodId || !personId) return
    const c = new AbortController()
    setLoading(true)
    setReport(null)
    setDetail(null)
    setError('')
    api<Report>(`report?personId=${personId}&periodId=${periodId}&dimension=${dimension}`, c.signal)
      .then(setReport)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false)
      })
    return () => c.abort()
  }, [personId, periodId, dimension, revision])
  useEffect(() => {
    if (!report?.current) return
    const c = new AbortController()
    setDetail(null)
    const q = new URLSearchParams({
      personId: String(personId),
      periodId: String(periodId),
      dimension,
      page: String(page),
      group: detailTab === 'brand' ? 'brand' : 'company',
    })
    if (report.batchId) q.set('batchId', report.batchId)
    if (metric) q.set('metric', metric)
    if (company) q.set('company', company)
    if (brand) q.set('brand', brand)
    if (search) q.set('search', search)
    api<OrderList>(`orders?${q}`, c.signal)
      .then(setDetail)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message)
      })
    return () => c.abort()
  }, [
    report?.batchId,
    report?.period.id,
    personId,
    dimension,
    metric,
    company,
    brand,
    search,
    page,
    detailTab,
  ])
  useEffect(() => {
    if (!report || !periodId || !personId) return
    const controller = new AbortController()
    const check = async () => {
      if (document.hidden) return
      try {
      const status = await api<{ batchId: string | null; latest: any;queued:any }>(
          `status?personId=${personId}&periodId=${periodId}`,
          controller.signal,
        )
        if (status.batchId !== report.batchId) setRevision((v) => v + 1)
        else
          setReport((old) =>
            old &&
            JSON.stringify([
              old.synchronization?.id,
              old.synchronization?.status,
                  old.synchronization?.error,old.queued?.slot,
                ]) !== JSON.stringify([status.latest?.id, status.latest?.status, status.latest?.error,status.queued?.slot])
                ? { ...old, synchronization: status.latest,queued:status.queued }
              : old,
          )
      } catch {
        /* 示例品牌 the visible successful batch; session failures use the existing auth event. */
      }
    }
    const timer = window.setInterval(check, 180000)
    window.addEventListener('focus', check)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [report?.batchId, periodId, personId])
  useEffect(() => {
    setPage(1)
  }, [metric, company, brand, search, detailTab])
  async function refresh(calendarOnly = false) {
    setBusy(true)
    setError('')
    setProgress(calendarOnly ? '正在读取天玑方片日历…' : '正在排队同步，原有成功数据可继续查看…')
    try {
      const job = await api<{ jobId: string }>(
        calendarOnly ? 'calendar-refresh' : 'refresh',
        undefined,
        calendarOnly ? {} : { monthId },
        'POST',
      )
      const result=await waitJob(job.jobId, setProgress)
      setRevision((v) => v + 1)
      setProgress(result?.status==='queued'?'请求已排队，后台会继续处理；当前仍显示最近成功数据。':'本轮任务已完成，请查看最新批次时间')
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败')
      setRevision((v) => v + 1)
    } finally {
      setBusy(false)
    }
  }
  async function saveTargets() {
    if (!catalog || !report) return
    try {
      const targets = catalog.metrics.map(([key]) => {
        const text = draft[key]?.trim()
        if (!text || !/^\d+(\.\d{1,2})?$/.test(text))
          throw new Error('请填写每个分项的非负金额，最多两位小数')
        const [whole, fraction = ''] = text.split('.')
        const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
        if (!Number.isSafeInteger(cents)) throw new Error('目标金额过大')
        return { metric: key, cents }
      })
      setBusy(true)
      await api('targets', undefined, { personId, monthId, targets }, 'PUT')
      setEditing(false)
      setRevision((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }
  const selectMetric = (value: string) => {
    setMetric(value)
    setCompany('')
    setBrand('')
    setPage(1)
  }
  const targetSum =
    report?.targets.length === 8 && report.targets.every((t) => t.cents !== null)
      ? report.targets.reduce((sum, t) => sum + t.cents!, 0)
      : null
  const selected = catalog?.people.find((p) => p.id === personId)
  const ratio = (actual: number | undefined, target: number | null | undefined) =>
    actual === undefined || !target ? '—' : `${((actual / target) * 100).toFixed(2)}%`
  const groupRows = detail?.groups ?? []
  return (
    <div className="commerce-shell">
      <aside className="commerce-sidebar" aria-label="商务人员">
        <div className="commerce-brand">
          <span>方片</span>
          <strong>商务</strong>
        </div>
        <label className="commerce-person-search">
          查找人员
          <input
            value={peopleSearch}
            onChange={(e) => setPeopleSearch(e.target.value)}
            placeholder="姓名或花名"
          />
        </label>
        {(['developer', 'customer'] as const).map((role) => (
          <section key={role}>
            <h2>{role === 'developer' ? '开发人员' : '对客人员'}</h2>
            {catalog?.people
              .filter((p) => p.role === role && `${p.name}${p.alias}`.includes(peopleSearch))
              .map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={p.id === personId ? 'selected' : ''}
                  onClick={() => setPersonId(p.id)}
                  aria-pressed={p.id === personId}
                >
                  <span>{p.name}</span>
                  {p.alias && <small>{p.alias.replace(/^方片/, '')}</small>}
                </button>
              ))}
          </section>
        ))}
        {catalog?.people.length === 0 && <p>当前账号尚未配置商务看板范围，请联系管理员核对本人身份。</p>}
      </aside>
      <main className="commerce-main">
        <header className="commerce-header">
          <div>
            <p className="commerce-eyebrow">商务部门 · 业务目标与业绩</p>
            <h1>商务目标看板</h1>
          </div>
          <div className="commerce-header-actions">
            {[275,472,676,906,904,411,897,677,811,813,799,668].includes(identity.employeeId) && <button onClick={onLegacy}>原目标计划</button>}
            <button
              onClick={async () => {
                try {
                  const r = await fetch('/api/tianji/login/logout', {
                    method: 'POST',
                    credentials: 'include',
                  })
                  if (!r.ok) throw new Error('退出失败')
                  window.location.reload()
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            >
              {identity.employeeName} · 退出登录
            </button>
          </div>
        </header>
        <section className="commerce-toolbar" aria-label="看板筛选">
          <div className="commerce-segment" aria-label="周期类型">
            {(['month', 'week'] as const).map((k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                className={kind === k ? 'active' : ''}
                onClick={() => setKind(k)}
              >
                {k === 'month' ? '方片月' : '方片周'}
              </button>
            ))}
          </div>
          <label>
            方片月
            <select value={monthId} onChange={(e) => setMonthId(Number(e.target.value))}>
              <option value={0}>选择月份</option>
              {months.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.year}年{p.title}
                </option>
              ))}
            </select>
          </label>
          {kind === 'week' && (
            <label>
              方片周
              <select value={weekId} onChange={(e) => setWeekId(Number(e.target.value))}>
                {weeks.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {date(p.start)}—{date(p.end - 1)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {catalog?.canManage && (
            <>
              <button disabled={busy || !monthId} className="commerce-primary" onClick={() => refresh()}>
                更新当前月业绩
              </button>
              <button disabled={busy} onClick={() => refresh(true)}>
                同步方片日历
              </button>
            </>
          )}
        </section>
        {error && (
          <div className="commerce-alert error" role="alert">
            {error}
          </div>
        )}
        {busy && (
          <div className="commerce-alert" role="status">
            {progress}
          </div>
        )}
        {!catalog?.periods.length && catalog && (
          <section className="commerce-empty">
            <h2>方片日历尚未同步</h2>
            <p>
              使用天玑真实周期配置后即可选择月份和周次。
              {catalog.canManage ? '请点击“同步方片日历”。' : '请由示例开发01别名或晓苏同步数据。'}
            </p>
          </section>
        )}
        {loading && (
          <div className="commerce-empty" role="status">
            正在读取已校验的商务数据…
          </div>
        )}
        {report && (
          <>
            <section className="commerce-board">
              <div className="commerce-board-heading">
                <div>
                  <h2>
                    {selected?.name} <span>{selected?.role === 'developer' ? '开发' : '对客'}</span>
                  </h2>
                  <p>
                    {date(report.period.start)}—{date(report.period.end - 1)} ·{' '}
                    {kind === 'week' ? report.period.title : '方片月'} · 北京时间
                  </p>
                </div>
                <div className="commerce-segment">
                  {(
                    [
                      ['publish', '发布'],
                      ['deal', '成单'],
                      ['payment', '结款'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={dimension === key}
                      className={dimension === key ? 'active' : ''}
                      onClick={() => setDimension(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="commerce-status">
                <span>
                  最近成功更新：<strong>{time(report.updatedAt)}</strong>
                </span>
                <span>目标出数：每天12:00、18:00</span>
                <button
                  onClick={() =>
                    setSource({
                      统计依据: report.source,
                      批次: report.batchId,
                      更新时间: report.updatedAt,
                      目标来源: catalog?.referenceSource,
                    })
                  }
                >
                  查看数据依据
                </button>
              </div>
              {report.synchronization?.status === 'delayed' && (
                <div className="commerce-alert error" role="status">
                  本轮更新延迟：{report.synchronization.error}。当前保留上次成功数据。
                </div>
              )}
              {report.synchronization?.status === 'running' && (
                <div className="commerce-alert" role="status">
                  后台正在更新，当前展示最近一次成功批次。
                </div>
              )}
              {report.queued&&report.synchronization?.status!=='running'&&report.synchronization?.status!=='delayed'&&<div className="commerce-alert" role="status">刷新请求已排队，完整校验成功后将自动展示新批次。</div>}
              {!report.current && (
                <div className="commerce-empty">
                  <h3>本周期尚无完整成功数据</h3>
                  <p>金额显示为“—”，同步完成后展示真实结果。</p>
                </div>
              )}
              <div className="commerce-table-wrap">
                <table className="commerce-metrics">
                  <thead>
                    <tr>
                      <th>业绩名称</th>
                      <th>{kind === 'week' ? '本周业绩' : '本月业绩'}</th>
                      <th>{kind === 'week' ? '上周业绩' : '上月业绩'}</th>
                      {kind === 'week' ? (
                        <th>本月累计</th>
                      ) : (
                        <>
                          <th>发布目标（元）</th>
                          <th>完成率</th>
                        </>
                      )}
                      <th>订单数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog?.metrics.map(([key, label]) => {
                      const current = report.current?.metrics[key],
                        previous = report.previous?.metrics[key],
                        target = report.targets.find((t) => t.metric === key)
                      return (
                        <tr key={key} className={metric === key ? 'is-filtered' : ''}>
                          <th>
                            <button onClick={() => selectMetric(key)}>{label}</button>
                          </th>
                          <td>
                            <button disabled={!current} onClick={() => selectMetric(key)}>
                              {money(current?.cents)}
                            </button>
                          </td>
                          <td>{money(previous?.cents)}</td>
                          {kind === 'week' ? (
                            <td>{money(report.monthToDate?.metrics[key].cents)}</td>
                          ) : (
                            <>
                              <td>
                                {editing ? (
                                  <input
                                    aria-label={`${label}发布目标`}
                                    inputMode="decimal"
                                    value={draft[key] ?? ''}
                                    onChange={(e) => setDraft((v) => ({ ...v, [key]: e.target.value }))}
                                  />
                                ) : (
                                  <button
                                    disabled={!target?.source}
                                    onClick={() => setSource(target?.source)}
                                  >
                                    {dimension === 'publish' ? money(target?.cents) : '不适用'}
                                  </button>
                                )}
                              </td>
                              <td>{dimension === 'publish' ? ratio(current?.cents, target?.cents) : '—'}</td>
                            </>
                          )}
                          <td>{current?.count ?? '—'}</td>
                        </tr>
                      )
                    })}
                    {!!report.current?.unclassifiedCount && (
                      <tr className="commerce-warning">
                        <th>
                          <button onClick={() => selectMetric('unclassified')}>待核对分类</button>
                        </th>
                        <td>{money(report.current.unclassifiedCents)}</td>
                        <td colSpan={kind === 'week' ? 3 : 4}>
                          {report.current.unclassifiedCount}笔，请查看订单依据核对归属
                        </td>
                      </tr>
                    )}
                    <tr className="commerce-total">
                      <th>
                        <button onClick={() => selectMetric('')}>订单分项合计</button>
                      </th>
                      <td>{money(report.current?.totalCents)}</td>
                      <td>{money(report.previous?.totalCents)}</td>
                      {kind === 'week' ? (
                        <td>{money(report.monthToDate?.totalCents)}</td>
                      ) : (
                        <>
                          <td>{dimension === 'publish' ? money(targetSum) : '不适用'}</td>
                          <td>
                            —
                          </td>
                        </>
                      )}
                      <td>{report.current?.orderCount ?? '—'}</td>
                    </tr>
                    <tr className="commerce-total">
                      <th><button disabled={!report.original?.current} onClick={()=>setSource(report.original?.current?.source)}>总业绩（原口径） ↗</button></th>
                      <td>{money(report.original?.current?.cents)}</td>
                      <td>{money(report.original?.previous?.cents)}</td>
                      {kind==='week'?<td>—</td>:<><td>{dimension==='publish'?money(targetSum):'不适用'}</td><td>{dimension==='publish'?ratio(report.original?.current?.cents,targetSum):'—'}</td></>}
                      <td>{report.original?.current?.count??'—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {report.original?.current && report.current && <p className="commerce-reconciliation">总业绩沿用原项目来源（天玑员工营收；示例对客19按本人订单），订单分项按本次确认口径计算，分别展示。当前差额（原总业绩－分项合计）：{money(report.original.current.cents-report.current.totalCents)}。点击原总业绩可查看接口、查询参数和原始人员记录。</p>}
              <footer className="commerce-board-footer">
                <span>
                  {kind === 'week' ? '周目标：未设置' : '仅发布阶段设置目标；目标比例不参与实绩计算。'} ·
                  金额单位：元
                </span>
                {report.canManage && kind === 'month' && dimension === 'publish' && (
                  <div>
                    {editing ? (
                      <>
                        <button disabled={busy} onClick={() => setEditing(false)}>
                          取消
                        </button>
                        <button disabled={busy} className="commerce-primary" onClick={saveTargets}>
                          保存目标
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setDraft(
                            Object.fromEntries(
                              report.targets.map((t) => [
                                t.metric,
                                t.cents === null ? '' : (t.cents / 100).toFixed(2),
                              ]),
                            ),
                          )
                          setEditing(true)
                        }}
                      >
                        编辑发布目标
                      </button>
                    )}
                  </div>
                )}
              </footer>
            </section>
            {report.allocation && <details className="commerce-allocation">
              <summary>目标分配与校验</summary>
              <p>{selected?.role==='developer'?'整体目标已包含本人及对客分配目标，两层不重复相加。':'对客整体目标由以下开发分配目标汇总。'} 实际业绩仍按订单归属计算。</p>
              <div className="commerce-table-wrap"><table><thead><tr><th>人员</th><th>分配开发</th><th>分配发布目标</th><th>出处</th></tr></thead><tbody>
                {report.allocation.entries.map(entry=><tr key={`${entry.developerName}:${entry.employeeId}`}><th>{entry.employeeName}</th><td>{entry.developerName}</td><td>{money(entry.cents)}</td><td><button onClick={()=>setSource(entry.targets)}>原表单元格</button></td></tr>)}
              </tbody></table></div>
              <p>明细分配合计：{money(report.allocation.allocatedCents)}；当前整体目标：{money(targetSum)}；差额：{targetSum===null?'—':money(targetSum-report.allocation.allocatedCents)}。差额保留核对，不自动修改人员目标。</p>
            </details>}
            <section className="commerce-details">
              <div className="commerce-details-heading">
                <div className="commerce-segment">
                  {(
                    [
                      ['company', '公司'],
                      ['brand', '品牌'],
                      ['orders', '订单明细'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={detailTab === key ? 'active' : ''}
                      aria-pressed={detailTab === key}
                      onClick={() => setDetailTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="搜索公司、品牌、订单或博主"
                  placeholder="搜索公司、品牌、订单或博主"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="commerce-filters">
                <span>
                  {metric ? (catalog?.metrics.find(([k]) => k === metric)?.[1] ?? '待核对分类') : '全部业绩'}
                  {company ? ` · ${company}` : ''}
                  {brand ? ` · ${brand}` : ''}
                </span>
                {(metric || company || brand || search) && (
                  <button
                    onClick={() => {
                      selectMetric('')
                      setSearch('')
                    }}
                  >
                    清除筛选
                  </button>
                )}
                <strong>{detail ? `${detail.total}笔 · ${money(detail.cents)}` : '—'}</strong>
              </div>
              {!report.current ? (
                <div className="commerce-empty">同步完成后可查看明细。</div>
              ) : !detail ? (
                <div className="commerce-empty" role="status">
                  正在读取明细…
                </div>
              ) : detailTab !== 'orders' ? (
                <div className="commerce-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{detailTab === 'company' ? '公司全称' : '品牌'}</th>
                        <th>业绩</th>
                        <th>订单数</th>
                        <th>查看</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.slice((page - 1) * 50, page * 50).map((g) => (
                        <tr key={g.name}>
                          <th>{g.name || '未填写'}</th>
                          <td>{money(g.cents)}</td>
                          <td>{g.count}</td>
                          <td>
                            <button
                              onClick={() => {
                                if (detailTab === 'company') setCompany(g.name)
                                else setBrand(g.name)
                                setDetailTab('orders')
                                setPage(1)
                              }}
                            >
                              订单明细
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!groupRows.length && (
                        <tr>
                          <td colSpan={4}>当前条件无订单。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="commerce-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>业绩日期</th>
                        <th>订单编号</th>
                        <th>公司</th>
                        <th>品牌／博主</th>
                        <th>分类／自孵VP</th>
                        <th>业绩金额</th>
                        <th>来源</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.rows.map((o) => (
                        <tr key={o.id}>
                          <td>{date(o.performanceAt)}</td>
                          <th>{o.code}</th>
                          <td>{o.company}</td>
                          <td>
                            {o.brand}
                            <small>{o.creator}</small>
                          </td>
                          <td>
                            {catalog?.metrics.find(([k]) => k === o.metric)?.[1] ?? '待核对'}
                            <small>{o.selfVp}</small>
                          </td>
                          <td>{money(o.cents)}</td>
                          <td>
                            <button
                              onClick={async () => {
                                try {
                                  setSource(
                                    await api(
                                      `evidence?personId=${personId}&periodId=${periodId}&dimension=${dimension}&orderId=${o.id}&batchId=${detail.batchId}`,
                                    ),
                                  )
                                } catch (e) {
                                  setError((e as Error).message)
                                }
                              }}
                            >
                              数据依据
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!detail.rows.length && (
                        <tr>
                          <td colSpan={7}>当前条件无订单。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {detail && (
                <footer className="commerce-pagination">
                  <button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
                    上一页
                  </button>
                  <span>
                    第{page}页 / 共
                    {Math.max(1, Math.ceil((detailTab === 'orders' ? detail.total : groupRows.length) / 50))}
                    页
                  </span>
                  <button
                    disabled={page * 50 >= (detailTab === 'orders' ? detail.total : groupRows.length)}
                    onClick={() => setPage((v) => v + 1)}
                  >
                    下一页
                  </button>
                </footer>
              )}
            </section>
          </>
        )}
        {source && (
          <dialog
            ref={sourceDialog}
            onClose={() => setSource(null)}
            className="commerce-source"
            aria-labelledby="commerce-source-title"
          >
            <header>
              <h2 id="commerce-source-title">数据出处与计算依据</h2>
              <button autoFocus onClick={() => sourceDialog.current?.close()}>
                关闭
              </button>
            </header>
            <p>订单来源、查询条件、源字段及读取记录；目标可追溯到原表单元格。</p>
            <pre>{JSON.stringify(source, null, 2)}</pre>
          </dialog>
        )}
      </main>
    </div>
  )
}
