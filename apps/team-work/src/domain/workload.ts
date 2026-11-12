import { isDueOverdue } from './dates'
import type { Org, Task } from './types'

/** A confirmed owner takes precedence over an assignment awaiting acceptance. */
export const executorId = (task: Task) => task.assignmentPending ? null : task.ownerId || task.assigneeId || null
export function executorName(task: Task, org: Org) {
  if (task.importSource?.group) return '项目汇总'
  const id = executorId(task)
  return id ? org.users.find(user => user.id === id)?.name || '账号不可见' : '待分配'
}
export const needsProgressReview = (task: Task) => !!task.progressConflict || task.status === 'done' && task.progress < 100 || task.sourceStatus === '待核对'

/** Summaries supply context, never a second unit of work or a fabricated 0%. */
export function workloadStats(tasks: Task[]) {
  const actual = tasks.filter(task => !task.importSource?.group)
  const specified = actual.filter(task => !task.progressUnspecified)
  return {
    total: actual.length,
    open: actual.filter(task => task.status !== 'done').length,
    done: actual.filter(task => task.status === 'done').length,
    overdue: actual.filter(task => task.status !== 'done' && isDueOverdue(task.dueAt)).length,
    averageProgress: specified.length ? Math.round(specified.reduce((sum, task) => sum + task.progress, 0) / specified.length) : null,
    unspecified: actual.length - specified.length,
    conflicts: actual.filter(needsProgressReview).length,
  }
}

/** Flatten real tasks into their own executor's lane; hierarchy is shown as context. */
export function groupWorkByPerson(tasks: Task[], org: Org) {
  const groups = new Map<string, { key: string; label: string; tasks: Task[] }>()
  for (const task of tasks) {
    if (task.importSource?.group) continue
    const key = executorId(task) || '__unassigned__'
    if (!groups.has(key)) groups.set(key, { key, label: executorName(task, org), tasks: [] })
    groups.get(key)!.tasks.push(task)
  }
  return [...groups.values()]
}
