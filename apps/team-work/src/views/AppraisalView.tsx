import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDay } from '../domain/dates'
import { dimNames, type Appraisal, type AppraisalItem } from '../domain/types'
import { api } from '../api/client'
import { useApp } from '../store/AppProvider'
import { DatePicker } from '../components/DatePicker'
import { NumberStepper } from '../components/NumberStepper'
import { Select } from '../components/Select'
import { IconPlus, IconRefresh, IconTrash } from '../components/Icons'

/** 总表里的一行 (来自 /api/appraisals/overview) */
type OvRow = {
  userId: string
  name: string
  account?: string
  title?: string
  departmentId?: string | null
  count: number
  rated: number
  workCoef: number | null
  submittedAt?: string | null
}

/** 一行得分 = 最终系数 × 上级评价% ; 工作系数 = 各行得分的平均数 */
const scoreOf = (i: AppraisalItem): number | null =>
  i.finalCoef === null || i.leadPct === null ? null : (i.finalCoef * i.leadPct) / 100

const monthLabel = (m: string) => `${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月`
const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 月度绩效考核。
 * 员工: 填「原定系数 / 自评完成度 / 执行情况 / 月度成果」, 其余只读;
 * 负责人: 多一列「最终系数 / 上级评价」, 并且能切换看任何人。
 * 「考核指标 / 指标定义」和清单里的任务 / 子任务双向对应 (两个同步按钮)。
 */
export function AppraisalView() {
  const { user, org: fullOrg, pushToast } = useApp()
  const org = useMemo(() => {
    const visible = fullOrg.users.filter(member => member.id === user?.id || (user?.role === 'admin' && (user.managedDepartmentIds === undefined || (!!member.departmentId && user.managedDepartmentIds.includes(member.departmentId)))))
    const departments = new Set(visible.map(member => member.departmentId))
    return { ...fullOrg, users: visible, groups: user?.role === 'admin' ? fullOrg.groups.filter(group => user.managedDepartmentIds === undefined || user.managedDepartmentIds.includes(group.departmentId)) : [] }
  }, [fullOrg, user])
  const isBoss = user?.role === 'admin'
  const [month, setMonth] = useState(thisMonth)
  /** 'dept' = 部门总表 (每人一行的汇总); 'one' = 示例公司有限公司 / 小组单表 */
  const [view, setView] = useState<'dept' | 'one'>('one')
  /** 单表模式下选中的小组 (选了小组就显示小组汇总, 不选则显示 who 这示例公司有限公司的单表) */
  const [whoGroup, setWhoGroup] = useState('')
  const [who, setWho] = useState(user?.id || '')
  const [data, setData] = useState<Appraisal | null>(null)
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null)
  const [items, setItems] = useState<AppraisalItem[]>([])
  const [busy, setBusy] = useState(false)
  const [overview, setOverview] = useState<OvRow[]>([])

  const load = useCallback(
    async (m = month, userId = who) => {
      setBusy(true)
      try {
        const q = new URLSearchParams({ month: m })
        // 以前这里只有负责人会带 userId —— 现在「别人的表」对所有人开放 (只读),
        // 不带的话员工点谁看到的都是自己那张表
        if (userId) q.set('userId', userId)
        const r = await api.get<any>(`/api/appraisals?${q}`)
        setData(r.appraisal)
        setItems(r.appraisal.items || [])
        setPerson(r.user || null)
        // 总表全员可见 (只读), 所以不管是不是负责人都拉一次
        const ov = await api.get<any>(`/api/appraisals/overview?month=${m}`)
        setOverview((ov.rows || []).filter((row: OvRow) => org.users.some(member => member.id === row.userId)))
      } catch (e: any) {
        pushToast({ title: '绩效考核加载失败', body: e?.message || String(e), kind: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [month, pushToast, isBoss, who, org.users],
  )

  useEffect(() => {
    void load(month, who)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, who])

  /** 这张表是不是「别人的」(不是自己填的) —— 别人的表只能看, 不能改 */
  const othersView = view === 'one' && !!who && who !== user?.id
  const readOnly = !isBoss && (othersView || !!whoGroup)
  const isDeptView = view === 'dept'

  const patch = (id: string, p: Partial<AppraisalItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)))

  const total = useMemo(() => {
    const list = items.map(scoreOf).filter((x): x is number => x !== null)
    if (!list.length) return null
    return list.reduce((a, b) => a + b, 0) / list.length
  }, [items])

  const groupName = (uid: string) => {
    const gs = org.users.find((u) => u.id === uid)?.groupIds || []
    return gs.map((g) => org.groups.find((x) => x.id === g)?.name).filter(Boolean).join('、') || '—'
  }
  /** 总表里每行的工作系数 = overview 里的值; 小组平均 = 有值的那几行平均 */
  const avgOf = (rows: OvRow[]) => {
    const list = rows.map((r) => r.workCoef).filter((x): x is number => x !== null)
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null
  }
  const overviewRows = useMemo(() => {
    const rows = whoGroup
      ? overview.filter((r) => (org.users.find((u) => u.id === r.userId)?.groupIds || []).includes(whoGroup))
      : overview
    // 有考核内容的排前面 (工作系数高的在前), 空表沉底
    return [...rows].sort((a, b) => {
      if ((a.count > 0) !== (b.count > 0)) return a.count > 0 ? -1 : 1
      return (b.workCoef ?? -1) - (a.workCoef ?? -1)
    })
  }, [overview, whoGroup, org.users])

  const summaryTable = (rows: OvRow[], title: string, sub: string) => (
    <div className="ap-wrap">
      <table className="ap-table ap-sum-table">
        <thead>
          <tr>
            <th className="ap-th-idx">序号</th>
            <th>姓名</th>
            <th>所属小组</th>
            <th>考核项</th>
            <th>已评</th>
            <th>工作系数</th>
            <th>状态</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.userId} className={r.workCoef === null ? '' : 'is-rated'}>
              <td className="ap-th-idx">{idx + 1}</td>
              <td className="ap-ov-name">{r.name}</td>
              <td className="ap-sum-sub">{groupName(r.userId)}</td>
              <td>{r.count} 项</td>
              <td>
                {r.rated}/{r.count}
              </td>
              <td className="ap-score">{r.workCoef === null ? '—' : r.workCoef.toFixed(3)}</td>
              <td className="ap-sum-sub">{r.submittedAt ? '已提交' : r.count ? '填写中' : '未开始'}</td>
              <td>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setWhoGroup('')
                    setWho(r.userId)
                    setView('one')
                  }}
                >
                  看单表
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="ap-empty">
                这个范围里还没有成员。
              </td>
            </tr>
          )}
          {rows.length > 0 && (
            <tr className="ap-sum-avg">
              <td />
              <td colSpan={4}>{title}</td>
              <td className="ap-score">{avgOf(rows) === null ? '—' : avgOf(rows)!.toFixed(3)}</td>
              <td colSpan={2} className="ap-sum-sub">
                {sub}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  const save = async () => {
    if (!data) return
    setBusy(true)
    try {
      const body: any = { month, items }
      if (isBoss && who) body.userId = who
      const r = await api.post<any>('/api/appraisals', body)
      setData(r.appraisal)
      setItems(r.appraisal.items || [])
      pushToast({ title: '已保存', body: '', kind: 'info' })
      const ov = await api.get<any>(`/api/appraisals/overview?month=${month}`)
      setOverview((ov.rows || []).filter((row: OvRow) => org.users.some(member => member.id === row.userId)))
    } catch (e: any) {
      pushToast({ title: '保存失败', body: e?.message || String(e), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const sync = async (dir: 'from' | 'to') => {
    setBusy(true)
    try {
      const r = await api.post<any>(`/api/appraisals/${dir === 'from' ? 'from-tasks' : 'to-tasks'}`, {
        month,
        userId: isBoss ? who : undefined,
      })
      setData(r.appraisal)
      setItems(r.appraisal.items || [])
      pushToast({
        title: dir === 'from' ? `从清单补了 ${r.added} 行` : `写入清单: ${r.created} 个任务 · ${r.subs} 个子任务`,
        body: '',
        kind: 'info',
      })
    } catch (e: any) {
      pushToast({ title: '同步失败', body: e?.message || String(e), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const addRow = () =>
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.示例公司有限公司()}`,
        taskId: null,
        title: '',
        detail: '',
        category: '',
        dueAt: null,
        baseCoef: null,
        finalCoef: null,
        selfPct: null,
        leadPct: null,
        autoSelf: true,
        exec: '',
        result: '',
      },
    ])

  const numInput = (
    id: string,
    key: 'baseCoef' | 'finalCoef' | 'selfPct' | 'leadPct',
    disabled: boolean,
    placeholder = '',
    step = 0.1,
  ) => {
    const pct = key === 'selfPct' || key === 'leadPct'
    return (
      <NumberStepper
        value={(items.find((i) => i.id === id)?.[key] ?? null) as number | null}
        step={step}
        min={pct ? 0 : undefined}
        max={pct ? 100 : undefined}
        disabled={disabled || readOnly}
        placeholder={placeholder}
        onChange={(v) => patch(id, { [key]: v } as any)}
      />
    )
  }

  return (
    <section className="board ap-board">
      <header className="board-head">
        <div className="board-heading">
          <h1>绩效考核</h1>
          <p>
            {isBoss
              ? '给每示例公司有限公司评「最终系数 / 上级评价」; 工作系数 = 各项(最终系数 × 上级评价%)的平均值'
              : '填「原定系数 / 自评完成度」; 负责人会补「最终系数 / 上级评价」'}
          </p>
        </div>
      </header>

      <div className="filter-bar">
        <div className="seg sm">
          <button className="seg-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上个月">
            ‹
          </button>
          <button className="seg-btn" onClick={() => setMonth(thisMonth())}>
            本月
          </button>
          <button className="seg-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="下个月">
            ›
          </button>
        </div>
        <span className="ap-month">{monthLabel(month)}</span>
        <div className="seg sm ap-view-seg">
          <button className={`seg-btn${isDeptView ? ' is-on' : ''}`} onClick={() => setView('dept')} title="部门总表: 每人一行">
            部门
          </button>
          <button className={`seg-btn${!isDeptView ? ' is-on' : ''}`} onClick={() => setView('one')} title="示例公司有限公司 / 小组单表">
            示例公司有限公司
          </button>
        </div>
        {!isDeptView && (
          <Select
            value={whoGroup ? `g:${whoGroup}` : who}
            popWidth={200}
            onChange={(v) => {
              if (v.startsWith('g:')) {
                setWhoGroup(v.slice(2))
              } else {
                setWhoGroup('')
                setWho(v)
              }
            }}
            groups={[
              ...(org.groups.length
                ? [{ label: '小组', options: org.groups.map((g) => ({ value: `g:${g.id}`, label: `${g.name} · 小组` })) }]
                : []),
              { label: '成员', options: org.users.map((u) => ({ value: u.id, label: u.name })) },
            ]}
          />
        )}
        <span className="ap-coef">
          工作系数{' '}
          <b>
            {isDeptView || whoGroup
              ? (() => {
                  const a = avgOf(overviewRows)
                  return a === null ? '—' : a.toFixed(3)
                })()
              : total === null
                ? '—'
                : total.toFixed(3)}
          </b>
        </span>
        {readOnly && <span className="ap-readonly" title="看别人的表只能看, 不能改">只读</span>}
        <span className="spacer" style={{ flex: 1 }} />
        {/* 总表 / 小组表没有可保存的东西; 看别人的表也只读 —— 这两种情况直接不出现这三个按钮 */}
        {!isDeptView && !whoGroup && !readOnly && (
          <>
            <button className="btn ghost sm" disabled={busy} onClick={() => void sync('from')} title="把这示例公司有限公司当月的任务拉成考核行">
              <IconRefresh size={13} /> 从清单同步
            </button>
            <button className="btn ghost sm" disabled={busy} onClick={() => void sync('to')} title="把表里还没落地的行写成任务 / 子任务">
              <IconPlus size={13} /> 写入清单
            </button>
            <button className="btn primary sm" disabled={busy} onClick={() => void save()}>
              保存
            </button>
          </>
        )}
      </div>

      {(isDeptView || !!whoGroup) && (
        <>
          <div className="ap-sum-head">
            <strong>{isDeptView ? '部门总表' : `${org.groups.find((g) => g.id === whoGroup)?.name || '小组'} · 总表`}</strong>
            <span className="ap-sum-sub">
              {isDeptView
                ? `全员 ${overviewRows.length} 人 · ${monthLabel(month)}`
                : `${overviewRows.length} 人 · ${monthLabel(month)}`}
            </span>
          </div>
          {summaryTable(
            overviewRows,
            isDeptView ? '部门平均工作系数' : '小组平均工作系数',
            '点每行右边的「看单表」进到示例公司有限公司明细',
          )}
        </>
      )}

      {!isDeptView && !whoGroup && (
      <div className="ap-wrap">
        <table className="ap-table">
          <thead>
            <tr>
              <th className="ap-th-idx">序号</th>
              <th>指标类型</th>
              <th>考核指标</th>
              <th>指标定义</th>
              <th>方案时间规划</th>
              <th>原定系数</th>
              <th>最终系数</th>
              <th>执行情况</th>
              <th>月度成果</th>
              <th>自评完成度</th>
              <th>上级评价</th>
              <th>系数得分</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const sc = scoreOf(it)
              return (
                <tr key={it.id} className={sc === null ? '' : 'is-rated'}>
                  <td className="ap-th-idx">{idx + 1}</td>
                  <td>
                    <input
                      className="ap-input"
                      value={it.category}
                      placeholder={dimNames(org).cat}
                      readOnly={readOnly}
                      onChange={(e) => patch(it.id, { category: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="ap-input is-wide"
                      value={it.title}
                      placeholder="考核指标 (= 任务名)"
                      readOnly={readOnly}
                      onChange={(e) => patch(it.id, { title: e.target.value })}
                    />
                  </td>
                  <td>
                    <textarea
                      className="ap-input ap-textarea"
                      rows={2}
                      value={it.detail}
                      placeholder="指标定义 (= 子任务, 一行一条)"
                      readOnly={readOnly}
                      onChange={(e) => patch(it.id, { detail: e.target.value })}
                    />
                  </td>
                  <td className="ap-due">
                    {readOnly ? (
                      <span className="ap-ov-sub">{it.dueAt ? formatDay(it.dueAt) : '—'}</span>
                    ) : (
                      <DatePicker variant="chip" value={it.dueAt} placeholder="设日期" onChange={(iso) => patch(it.id, { dueAt: iso })} />
                    )}
                  </td>
                  <td>{numInput(it.id, 'baseCoef', false, '原定')}</td>
                  <td>{numInput(it.id, 'finalCoef', !isBoss, '待评')}</td>
                  <td>
                    <input
                      className="ap-input"
                      value={it.exec}
                      placeholder="执行情况"
                      readOnly={readOnly}
                      onChange={(e) => patch(it.id, { exec: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="ap-input"
                      value={it.result}
                      placeholder="成果 / 链接"
                      readOnly={readOnly}
                      onChange={(e) => patch(it.id, { result: e.target.value })}
                    />
                  </td>
                  <td className="ap-self">
                    {numInput(it.id, 'selfPct', false, '自评', 1)}
                    {it.autoSelf && it.taskId && <span className="ap-auto" title="跟着清单里任务的进度条自动更新">自动</span>}
                  </td>
                  <td>{numInput(it.id, 'leadPct', !isBoss, '待评', 1)}</td>
                  <td className="ap-score">{sc === null ? '—' : sc.toFixed(3)}</td>
                  <td>
                    {!readOnly && (
                      <button
                        className="icon-btn sm"
                        aria-label="删除这一行"
                        title="只从考核表里删掉 (清单里的任务不动)"
                        onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                      >
                        <IconTrash size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={13} className="ap-empty">
                  这个月还没有考核内容 —— 点「从清单同步」把当月的任务拉进来, 或点下面的「加一行」手工添加。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {!isDeptView && !whoGroup && (
      <div className="ap-foot">
        <button className="btn ghost sm" onClick={addRow} disabled={readOnly}>
          <IconPlus size={13} /> 加一行
        </button>
        <span className="ap-hint">
          {person ? `${person.name} · ${monthLabel(month)} · ` : ''}
          共 {items.length} 项
          {data?.updatedAt ? ` · 最后更新 ${formatDay(data.updatedAt)}` : ''}
        </span>
      </div>
      )}
    </section>
  )
}
