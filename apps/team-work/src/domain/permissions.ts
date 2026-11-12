import type { Task, User } from './types'

/**
 * 任务权限 —— 前后端同一套规则 (服务端在 server/modules/tasks/tasks.service.ts)。
 * 前端这里只负责「不给无效的按钮」, 真正的拦截在服务端。
 */

/** 能改任务内容 (标题/时间/负责人/状态…): 管理员、派发人、以及当前执行人 */
export function canEditTask(task: Task, user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return task.creatorId === user.id || task.ownerId === user.id || task.assigneeId === user.id
}

/**
 * 能删任务 —— **只有派发人(负责人)和管理员**。
 * 执行人(包括从小组/部门任务里认领的人)一律不能删: 活是别人派的, 删不删由派活的人说了算。
 */
export function canDeleteTask(task: Task, user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return task.creatorId === user.id
}
