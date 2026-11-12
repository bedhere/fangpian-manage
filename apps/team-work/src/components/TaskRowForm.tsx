import { useEffect, useMemo, useRef, useState } from 'react'
import { endOfDayIso, formatDay, startOfDay } from '../domain/dates'
import { DatePicker } from './DatePicker'
import { Select } from './Select'
import { TimeSelect } from './TimeSelect'
import {
  PRIORITIES,
  REPEAT_LABEL,
  WEEKDAY_LABEL,
  type AssignScope,
  type Freq,
  type Priority,
  type Recurrence,
  type Task,
  categoryGroups,
  dimNames,
  typeGroups,
} from '../domain/types'
import { canDeleteTask } from '../domain/permissions'
import { FALLBACK_TAG, detectTags } from '../domain/autotag'
import { useApp, type TaskDraft } from '../store/AppProvider'
import { IconRefresh } from './Icons'

/**
 * 就地编辑行 —— 像填表格一样新建/修改任务。
 * 三种用法 (都不用弹窗):
 *   编辑:     传 task
 *   加子任务: 传 parent   (派发对象、优先级继承父任务)
 *   下方插入: 传 after    (同层级, 属性复制当前这条, 排在它后面)
 */
export function TaskRowForm({
  task,
  parent,
  after,
  onClose,
}: {
  task?: Task | null
  parent?: Task | null
  after?: Task | null
  onClose: () => void
}) {
  const { org, user, tasks, createTask, updateTask, deleteTask, pushToast, askConfirm } = useApp()
  const editing = !!task
  /** 执行人的调整权: 新建时人人可选(你就是派发人); 改已有任务时只有负责人(管理员)能动 */
  const canPickTarget = !editing || user?.role === 'admin'
  /** 截止日期只有派发人(和负责人)能定 —— 执行人认领之后也不能改, 时间以派发人设的为准 */
  const canEditDue = !editing || user?.role === 'admin' || task?.creatorId === user?.id
  const seed = task || parent || after || null
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(task?.title || '')
  const [note, setNote] = useState(task?.note || '')
  const [category, setCategory] = useState(task?.category || after?.category || '')
  const [taskType, setTaskType] = useState(task?.type || after?.type || '')
  /** 子任务的板块 / 类型跟随主任务, 不可单独改 —— 新建子任务、编辑子任务、
   *  以及在子任务下面插一条, 三种情况都算 */
  const followsParent = !!(parent || task?.parentId || after?.parentId)
  const inherited = task || parent || after || null
  const dn = dimNames(org)
  const inheritedText = `${inherited?.category || `不分${dn.cat}`} · ${inherited?.type || `不设${dn.type}`}`
  const [priority, setPriority] = useState<Priority>(task?.priority || seed?.priority || 'normal')
  const [scope, setScope] = useState<AssignScope>(task?.scope || seed?.scope || 'user')
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || seed?.assigneeId || user?.id || '')
  const [groupId, setGroupId] = useState(
    task?.groupId || seed?.groupId || user?.groupIds?.[0] || org.groups[0]?.id || '',
  )
  const [departmentId, setDepartmentId] = useState(
    task?.departmentId || seed?.departmentId || user?.departmentId || org.departments[0]?.id || '',
  )
  // 截止/提醒都用 ISO 存, 交给 DatePicker 处理日期(截止不带时间点)
  const [dueAt, setDueAt] = useState<string | null>(task?.dueAt ?? after?.dueAt ?? null)
  const [remindAt, setRemindAt] = useState<string | null>(task?.remindAt || null)
  const [freq, setFreq] = useState<Freq>(task?.recurrence?.freq || 'none')
  const [at, setAt] = useState(task?.recurrence?.at || '09:30')
  const [weekdays, setWeekdays] = useState<number[]>(task?.recurrence?.byWeekday || [])
  const [monthDay, setMonthDay] = useState(task?.recurrence?.byMonthDay || 1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    titleRef.current?.focus()
    titleRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const eligible = useMemo(() => org.users.filter((u) => u.state === 'active'), [org.users])

  const canSave = (() => {
    if (!title.trim()) return false
    if (scope === 'user' && !assigneeId) return false
    if (scope === 'group' && !groupId) return false
    if (scope === 'dept' && !departmentId) return false
    if (freq === 'weekly' && weekdays.length === 0) return false
    return true
  })()

  // 按任务名自动识别出来的标签 (记住它, 才知道当前值是不是「自动填的」)
  const autoTag = useRef({ category: '', type: '' })
  useEffect(() => {
    // 子任务的板块/类型跟随主任务, 不参与识别
    if (followsParent) return
    const prev = autoTag.current
    const hit = detectTags(title, org)
    // 先取上一次自动填的值再更新 ref —— state 的 updater 是稍后才跑的,
    // 直接读 autoTag.current 会拿到「这次」的结果, 判断就失效了
    setCategory((cur) => (cur === '' || cur === prev.category ? hit.category : cur))
    setTaskType((cur) => (cur === '' || cur === prev.type ? hit.type : cur))
    autoTag.current = hit
  }, [title, org, followsParent])

  /** 子任务的截止不能超过任意一层主任务的截止日 (找不到就返回 null = 不限制)
   *  这样就不会出现「主任务马上到期、子任务却排到更晚」的错位 */
  const dueCap = useMemo(() => {
    const start =
      parent ||
      (task?.parentId ? tasks.find((t) => t.id === task.parentId) || null : null) ||
      (after?.parentId ? tasks.find((t) => t.id === after.parentId) || null : null)
    let cur: Task | null = start
    for (let i = 0; cur && i < 8; i++) {
      if (cur.dueAt) return cur.dueAt
      const pid: string | null = cur.parentId
      cur = pid ? tasks.find((t) => t.id === pid) || null : null
    }
    return null
  }, [parent, task, after, tasks])
  const dueMin =
    dueCap && new Date(dueCap).getTime() >= startOfDay(new Date()).getTime()
      ? startOfDay(new Date()).toISOString()
      : null
  /** 快捷按钮也会越界时直接禁用 */
  const quickBlocked = (kind: 'today' | 'tomorrow' | 'nextMon') => {
    if (!dueCap) return false
    const d = new Date()
    if (kind === 'tomorrow') d.setDate(d.getDate() + 1)
    if (kind === 'nextMon') d.setDate(d.getDate() + (7 - ((d.getDay() + 6) % 7)))
    return d.getTime() > new Date(dueCap).getTime()
  }

  const dueFrom = (kind: 'today' | 'tomorrow' | 'nextMon') => {
    if (quickBlocked(kind)) return
    const d = new Date()
    if (kind === 'tomorrow') d.setDate(d.getDate() + 1)
    if (kind === 'nextMon') {
      const w = (d.getDay() + 6) % 7
      d.setDate(d.getDate() + (7 - w))
    }
    setDueAt(endOfDayIso(d))
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const recurrence: Recurrence | null =
        freq === 'none' || parent
          ? null
          : {
              freq,
              at,
              byWeekday: freq === 'weekly' ? weekdays : undefined,
              byMonthDay: freq === 'monthly' ? monthDay : undefined,
            }
      const draft: TaskDraft & { parentId?: string | null } = {
        parentId: parent ? parent.id : task ? task.parentId : after ? after.parentId : null,
        title: title.trim(),
        note,
        // 子任务不带板块 / 类型: 服务端会照主任务的填, 带了也会被忽略
        ...(followsParent ? {} : { category, type: taskType }),
        priority,
        scope,
        // 没权限改执行人时就不带这几个字段, 免得被服务端当成"改派"拒掉
        ...(canPickTarget
          ? {
              scope,
              assigneeId: scope === 'user' ? assigneeId : null,
              groupId: scope === 'group' ? groupId : null,
              departmentId: scope === 'dept' ? departmentId : null,
            }
          : {}),
        // 保存前再夹一次, 免得旧的超期值被原样提交
        dueAt: dueAt && dueCap && new Date(dueAt).getTime() > new Date(dueCap).getTime() ? dueCap : dueAt,
        remindAt,
        recurrence,
      }
      if (editing && task) await updateTask(task.id, draft)
      else await createTask(draft)
      onClose()
    } catch (e: any) {
      pushToast({ title: '保存失败', body: e?.message || String(e), kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="trow-form">
      <div className="form-line">
        <input
          ref={titleRef}
          className="form-title"
          placeholder={
            // 主任务按「部门·工作类型-具体任务」的格式起名, 这样两个分类能自动识别出来
            parent ? '这一步要做什么?' : after ? '再加一条…' : '请按格式输入“部门·工作类型-具体任务”'
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) void save()
          }}
        />

        <label className="form-field">
          <span>优先级</span>
          <Select
            value={priority}
            className={`priority-select priority-${priority}`}
            popWidth={130}
            onChange={(v) => setPriority(v as Priority)}
            options={PRIORITIES.map((p) => ({ value: p.key, label: p.label, color: p.color }))}
          />
        </label>

        <label className="form-field">
          <span>{editing ? '执行人' : '派给'}</span>
          {!canPickTarget && (
            <p className="field-note">
              执行人已指定给 <b>{scope === 'user' ? org.users.find((u) => u.id === assigneeId)?.name || '—' : scope === 'group' ? org.groups.find((g) => g.id === groupId)?.name : org.departments.find((d) => d.id === departmentId)?.name}</b> ——
              执行人只能由负责人调整。
            </p>
          )}
          <div className="form-pair" style={canPickTarget ? undefined : { display: 'none' }}>
            <Select
              value={scope}
              popWidth={120}
              onChange={(v) => setScope(v as AssignScope)}
              options={[
                { value: 'user', label: '示例公司有限公司' },
                { value: 'group', label: '小组' },
                { value: 'dept', label: '部门' },
              ]}
            />
            {scope === 'user' && (
              <Select
                value={assigneeId}
                popWidth={160}
                onChange={setAssigneeId}
                options={eligible.map((u) => ({ value: u.id, label: `${u.name}${u.id === user?.id ? ' (我)' : ''}` }))}
              />
            )}
            {scope === 'group' && (
              <Select
                value={groupId}
                popWidth={160}
                onChange={setGroupId}
                options={org.groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            )}
            {scope === 'dept' && (
              <Select
                value={departmentId}
                popWidth={160}
                onChange={setDepartmentId}
                options={org.departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            )}
          </div>
        </label>

        <label className="form-field">
          <span>截止</span>
          {canEditDue ? (
            <div className="form-pair">
              <DatePicker variant="field" value={dueAt} min={dueMin} max={dueCap} placeholder="选一天" onChange={setDueAt} />
              <span className="form-quick">
                <button disabled={quickBlocked('today')} onClick={() => dueFrom('today')}>今天</button>
                <button disabled={quickBlocked('tomorrow')} onClick={() => dueFrom('tomorrow')}>明天</button>
                <button disabled={quickBlocked('nextMon')} onClick={() => dueFrom('nextMon')}>下周一</button>
              </span>
            </div>
          ) : (
            <>
              <div className="form-pair">
                <span className={`cell-chip${dueAt ? '' : ' is-plain'}`}>{dueAt ? formatDay(dueAt) : dueCap ? formatDay(dueCap) : '未设'}</span>
              </div>
              <span className="field-note">截止日期由派发的人定, 认领之后也不能改。</span>
            </>
          )}
        </label>

        <label className="form-field">
          <span>提醒</span>
          <div className="form-pair">
            <DatePicker variant="field" withTime value={remindAt} placeholder="设提醒时间" onChange={setRemindAt} />
            <span className="form-quick">
              <button
                disabled={!dueAt}
                title="跟截止日期一致(当天 23:59)"
                onClick={() => dueAt && setRemindAt(dueAt)}
              >
                跟截止
              </button>
              <button onClick={() => setRemindAt(null)}>清空</button>
            </span>
          </div>
        </label>

        {!parent && (
          <label className="form-field">
            <span>
              <IconRefresh size={11} /> 周期
            </span>
            <div className="form-pair">
              <Select
                value={freq}
                popWidth={140}
                onChange={(v) => setFreq(v as Freq)}
                options={(Object.keys(REPEAT_LABEL) as Freq[]).map((f) => ({ value: f, label: REPEAT_LABEL[f] }))}
              />
              {freq === 'weekly' && (
                <Select
                  multiple
                  values={weekdays.map(String)}
                  onValuesChange={(v) => setWeekdays(v.map(Number).sort())}
                  placeholder="选择星期"
                  popWidth={150}
                  options={WEEKDAY_LABEL.map((w, i) => ({ value: String(i), label: w }))}
                />
              )}
              {freq === 'monthly' && (
                <Select
                  value={String(monthDay)}
                  popWidth={110}
                  onChange={(v) => setMonthDay(Number(v))}
                  options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 号` }))}
                />
              )}
              {freq !== 'none' && <TimeSelect value={at} onChange={setAt} />}
            </div>
          </label>
        )}

        {followsParent ? (
          <label className="form-field">
            <span>
              {dn.cat} / {dn.type}
            </span>
            <span className="form-static" title={`子任务跟随主任务的${dn.cat}和${dn.type}, 不能单独改`}>
              {inheritedText}
              <em>跟随主任务</em>
            </span>
          </label>
        ) : (
          <>
            <label className="form-field">
              <span>
                {dn.cat}
                {autoTag.current.category && autoTag.current.category === category && <em className="auto-tag">自动</em>}
              </span>
              <Select
                value={category}
                popWidth={160}
                onChange={setCategory}
                options={[{ value: '', label: `不分${dn.cat}` }, { value: FALLBACK_TAG, label: FALLBACK_TAG }]}
                groups={categoryGroups(org).map((g) => ({
                  label: g.name,
                  options: g.categories.map((c) => ({ value: c, label: c })),
                }))}
              />
            </label>

            <label className="form-field">
              <span>
                {dn.type}
                {autoTag.current.type && autoTag.current.type === taskType && <em className="auto-tag">自动</em>}
              </span>
              <Select
                value={taskType}
                popWidth={160}
                onChange={setTaskType}
                options={[{ value: '', label: `不设${dn.type}` }, { value: FALLBACK_TAG, label: FALLBACK_TAG }]}
                groups={typeGroups(org).map((g) => ({
                  label: g.name,
                  options: g.types.map((c) => ({ value: c, label: c })),
                }))}
              />
            </label>
          </>
        )}

      </div>

      {freq === 'monthly' && !parent && monthDay > 28 && (
        <div className="form-line">
          <span className="form-hint">当月没有 {monthDay} 号时, 落在最后一天</span>
        </div>
      )}

      <div className="form-line">
        <input
          className="form-note"
          placeholder="备注 (可选)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <span className="spacer" />
        {editing && task && canDeleteTask(task, user) && (
          <button
            className="btn danger ghost sm"
            onClick={() => {
              // 不弹确认: 进回收站, 可以恢复
              void (async () => {
                try {
                  await deleteTask(task.id)
                  pushToast({ title: '已移到回收站', body: '可在「回收站」恢复', kind: 'info' })
                  onClose()
                } catch (e: any) {
                  pushToast({ title: '删除失败', body: e?.message || String(e), kind: 'error' })
                }
              })()
            }}
          >
            删除
          </button>
        )}
        <button className="btn ghost sm" onClick={onClose}>
          取消
        </button>
        <button className="btn primary sm" onClick={save} disabled={!canSave || saving}>
          {saving ? '保存中…' : editing ? '保存' : parent ? '添加子任务' : '添加'}
        </button>
      </div>
    </div>
  )
}

