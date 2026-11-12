import { useEffect, useRef, useState } from 'react'
import { formatCalendarDay, formatDay, isDueOverdue } from '../domain/dates'
import { dimsOf, dimValueOf, groupDimTags, PRIORITIES, priorityMeta, type Priority, type Task } from '../domain/types'
import { UserAvatar } from './Avatar'
import { IconCheck } from './Icons'
import { Select } from './Select'
import { FALLBACK_TAG } from '../domain/autotag'
import { DatePicker } from './DatePicker'
import { useApp } from '../store/AppProvider'

/**
 * 单元格级就地编辑 —— 点哪个字段改哪个字段, 不再整行跳进编辑态。
 *
 * 每个单元格都遵守同一套约定:
 *   · 只读状态下就是普通文字/胶囊, 鼠标悬停给一点反馈
 *   · 点一下变成输入框/下拉框, Enter 或失焦保存, Esc 撤销
 *   · 没有权限的人点不动 (服务端也会拦, 这里只是不给无效交互)
 */

function useAutosave(taskId: string) {
  const { updateTask } = useApp()
  return async (patch: Partial<Task>) => {
    await updateTask(taskId, patch as any)
  }
}

// ── 任务标题 ────────────────────────────────────────────────────────────
export function TitleCell({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const { select } = useApp()
  return (
    <button className="cell-text task-detail-link" title={`${task.title}\n点击查看任务详情`} onClick={() => select(task.id)}>
      {task.title}
    </button>
  )
}

// ── 优先级 ──────────────────────────────────────────────────────────────
export function PriorityCell({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const prio = priorityMeta(task.priority)
  const save = useAutosave(task.id)
  return (
    <span className="cell-wrap" title={canEdit ? '点击切换优先级' : ''}>
      <Select
        className={`is-cell priority-select priority-${task.priority}`}
        value={task.priority}
        disabled={!canEdit}
        onChange={(v) => void save({ priority: v as Priority })}
        options={PRIORITIES.map((p) => ({ value: p.key, label: p.label, color: priorityMeta(p.key).color }))}
      />
    </span>
  )
}

// ── 执行人 (派给谁做) ────────────────────────────────────────────────────
// 权限: **只有负责人(管理员)能调整执行人**; 其他人(包括派发人本人)只读、认领除外。
export function ExecutorCell({ task, canAssign }: { task: Task; canAssign: boolean }) {
  const { org, claimTask, user: me } = useApp()
  const save = useAutosave(task.id)

  const owner = org.users.find((u) => u.id === task.ownerId)
  const assignee = org.users.find((u) => u.id === task.assigneeId)
  const person = task.scope === 'user' ? assignee : owner
  const pool = task.scope === 'group' ? org.groups.find((g) => g.id === task.groupId) : null
  if (task.importSource?.group) return <span className="chip is-plain" title="由子任务自动汇总，不需要领取">汇总</span>
  // 能「领/抢」的: 派给我示例公司有限公司的 (领) + 我所在小组/部门的 (抢)
  const myGroups = me?.groupIds || []
  const canClaim =
    !task.assignmentPending &&
    task.status !== 'done' &&
    !task.ownerId &&
    (task.scope === 'user'
      ? task.assigneeId === me?.id
      : task.scope === 'group'
        ? !!task.groupId && myGroups.includes(task.groupId)
        : !!task.departmentId && task.departmentId === me?.departmentId)

  // 只读视角: 还没人接的任务优先给「认领」按钮 (派给自己的会显示「确认认领」)
  if (!canAssign) {
    if (task.assignmentPending) return <span className="chip is-warn">待分配</span>
    if (canClaim) {
      return (
        <button
          className={`btn sm${task.scope === 'user' ? ' primary' : ''}`}
          title={
            task.scope === 'user'
              ? '这是派给你示例公司有限公司的任务, 「领」下来才进「我的待办」'
              : task.scope === 'group'
                ? '你们小组的任务, 「抢」下来就归你'
                : '你们部门的任务, 「抢」下来就归你'
          }
          onClick={() => void claimTask(task.id)}
        >
          <IconCheck size={12} /> {task.scope === 'user' ? '领' : '抢'}
        </button>
      )
    }
    if (person) {
      return (
        <span className="chip is-plain" title={person.name}>
          <UserAvatar user={person} size={14} /> {person.name}
        </span>
      )
    }
    return <span className="chip is-warn">{pool ? `${pool.name} · 待认领` : '待认领'}</span>
  }

  // 负责人: 一个下拉就能全权调整 —— 换人, 或者退回给小组/部门
  const value = task.assignmentPending ? 'pending' :
    task.scope === 'user'
      ? `user:${task.assigneeId || ''}`
      : task.scope === 'group'
        ? `group:${task.groupId || ''}`
        : `dept:${task.departmentId || ''}`

  const onChange = (raw: string) => {
    if (raw === 'pending') return
    const [kind, id] = raw.split(':')
    if (kind === 'user') void save({ scope: 'user', assigneeId: id } as any)
    else if (kind === 'group') void save({ scope: 'group', groupId: id } as any)
    else void save({ scope: 'dept', departmentId: id } as any)
  }

  return (
    <span className="cell-wrap" title={task.assignmentPending ? '待分配，点击指定执行人' : task.ownerId ? '点击调整执行人' : '等待对方确认认领'}>
      <Select
        className="is-cell"
        value={value}
        popWidth={190}
        onChange={onChange}
        options={task.assignmentPending ? [{value:'pending',label:'待分配'}] : []}
        groups={[
          {
            label: '指定给示例公司有限公司',
            options: org.users.filter((u) => u.state === 'active').map((u) => ({ value: `user:${u.id}`, label: u.name })),
          },
          {
            label: '退回小组 (谁先接谁做)',
            options: org.groups.map((g) => ({ value: `group:${g.id}`, label: g.name })),
          },
          {
            label: '退回部门 (谁先接谁做)',
            options: org.departments.map((d) => ({ value: `dept:${d.id}`, label: d.name })),
          },
        ].filter(group => !task.assignmentPending || group.label === '指定给示例公司有限公司')}
      />
    </span>
  )
}

// ── 派发人 (谁建的, 固定不可改) ────────────────────────────────────────────
export function CreatorCell({ task }: { task: Task }) {
  const { org } = useApp()
  if (task.importSource) return <span className="chip is-plain" title="从真实进度表导入，原表未记录派发人">表格导入</span>
  const creator = org.users.find((u) => u.id === task.creatorId)
  if (!creator) return <span className="trow-empty">成员信息不可用</span>
  return (
    <span className="chip is-plain" title={`${creator.name} 建立, 不可修改`}>
      <UserAvatar user={creator} size={14} /> {creator.name}
    </span>
  )
}

// ── 截止日期 (只到哪一天, 不带几点几分) ─────────────────────────────
export function DueCell({
  task,
  canEdit,
  inheritedDue = null,
  maxDue = null,
  minDue = null,
}: {
  task: Task
  canEdit: boolean
  /** 子任务自己没设日期时, 上层最近的截止日 (用来提示「跟父任务」) */
  inheritedDue?: string | null
  /** 不能晚于这一天 (上层主任务的截止日) */
  maxDue?: string | null
  /** 不能早于这一天 (子任务只能选今天以后) */
  minDue?: string | null
}) {
  const save = useAutosave(task.id)
  const late = task.status !== 'done' && isDueOverdue(task.dueAt || inheritedDue)
  const dateText = task.status === 'done' ? formatCalendarDay : formatDay

  if (!canEdit) {
    if (!task.dueAt) {
      return inheritedDue ? (
        <span className="trow-inherit" title="自己没设日期, 显示的是上层主任务的截止日">{dateText(inheritedDue)}</span>
      ) : (
        <span className="trow-empty">—</span>
      )
    }
    return <span className={`cell-chip${late ? ' is-danger' : ''}`}>{dateText(task.dueAt)}</span>
  }
  return (
    <DatePicker
      value={task.dueAt}
      danger={late}
      relative={task.status !== 'done'}
      min={minDue}
      max={maxDue}
      placeholder={inheritedDue ? formatDay(inheritedDue) : '设日期'}
      onChange={(iso) => void save({ dueAt: iso } as any)}
    />
  )
}

// ── 分类维度 (板块 / 类型 / 以及自定义的更多维度) ─────────────────────────
// 一个维度一列, 用的是同一套下拉: 选项按小组分组, 值存在 task.tags[维度 id] 里
// (前两个维度同时镜像到 task.category / task.type)。
export function DimCell({ task, dimId, canEdit }: { task: Task; dimId: string; canEdit: boolean }) {
  const { org } = useApp()
  const save = useAutosave(task.id)
  const dim = dimsOf(org).find((d) => d.id === dimId)
  const label = dim?.name || dimId
  const value = dimValueOf(task, dimId)
  const groups = org.groups
    .map((g) => ({ id: g.id, name: g.name, tags: groupDimTags(g as any, dimId) }))
    .filter((g) => g.tags.length > 0)
  const empty = `不分${label}`
  return (
    <span className="cell-wrap" title={canEdit ? `点击切换${label}` : ''}>
      <Select
        className="is-cell"
        value={value}
        disabled={!canEdit}
        placeholder={empty}
        onChange={(v) => void save({ tags: { [dimId]: v } } as any)}
        options={[
          { value: '', label: empty },
          // 兜底「其他」永远可选; 当前值不在小组标签里时也补进去, 免得显示成空
          ...(value && value !== FALLBACK_TAG && !groups.some((g) => g.tags.includes(value))
            ? [{ value, label: value }]
            : []),
          { value: FALLBACK_TAG, label: FALLBACK_TAG },
        ]}
        groups={groups.map((g) => ({ label: g.name, options: g.tags.map((c) => ({ value: c, label: c })) }))}
      />
    </span>
  )
}

