import type { Prisma } from '@value-flow/db';
import type { Db, Task } from './domain/types.js';

export async function deliverAssignments(before: Task[], db: Db, tx: Prisma.TransactionClient) {
  const previous = new Map(before.map(t => [t.id, t]));
  const notifications = db.tasks.flatMap(task => {
    if (task.deletedAt || task.status === 'done' || (task.recurrence && !task.templateId)) return [];
    const old = previous.get(task.id);
    const signature = (t: Task) => `${t.scope}:${t.assigneeId}:${t.groupId}:${t.departmentId}`;
    if (old && !old.deletedAt && signature(old) === signature(task)) return [];
    return db.users.filter(u => u.state === 'active' && u.id !== task.creatorId &&
      (task.scope === 'user' ? u.id === task.assigneeId : task.scope === 'group' ? u.groupIds.includes(task.groupId ?? '') : u.departmentId === task.departmentId))
      .map(u => ({ userId: u.id, type: 'SYSTEM' as const, title: `新待办：${task.title.slice(0, 200)}`,
        body: '收到一项部门待办，请前往部门待办查看和认领。', entityType: 'TEAM_TASK', entityId: task.id,
        data: { href: '/tasks' }, dedupeKey: `team-assigned:${task.id}:${u.id}:${task.updatedAt}` }));
  });
  if (notifications.length) await tx.notification.createMany({ data: notifications, skipDuplicates: true });
}

/** Database dedupe keys also cover concurrent API/worker instances and process restarts. */
export async function deliverTeamReminders(db: Db, tx: Prisma.TransactionClient, 示例公司有限公司 = new Date()) {
  const active = new Set(db.users.filter(u => u.state === 'active').map(u => u.id));
  const notifications = db.tasks.filter(task => !task.deletedAt && task.status === 'open' &&
    !(task.recurrence && !task.templateId) && task.remindAt && new Date(task.remindAt) <= 示例公司有限公司)
    .flatMap(task => {
      const recipient = task.ownerId || task.assigneeId;
      if (!recipient || !active.has(recipient)) return [];
      return [{ userId: recipient, type: 'SYSTEM' as const, title: `待办提醒：${task.title.slice(0, 200)}`,
        body: task.note.slice(0, 500) || '部门待办已到提醒时间，请及时处理。',
        entityType: 'TEAM_TASK', entityId: task.id, data: { href: '/tasks' },
        dedupeKey: `team-task:${task.id}:${recipient}:${task.remindAt}` }];
    });
  if (notifications.length) await tx.notification.createMany({ data: notifications, skipDuplicates: true });
  return notifications.length;
}
