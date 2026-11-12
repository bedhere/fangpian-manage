import { describe, expect, it } from 'vitest';
import type { Prisma } from '@value-flow/db';
import { emptyDb, type Task } from './domain/types.js';
import { deliverTeamReminders, deliverAssignments } from './team-work.notifications.js';

describe('team notifications', () => {
  it('deduplicates reminders in the existing notification centre and skips templates/deleted tasks', async () => {
    const db = emptyDb();
    db.users = [{ id: 'member', state: 'active' }] as typeof db.users;
    const task = { id: 'task', assigneeId: 'member', ownerId: null, status: 'open', deletedAt: null,
      remindAt: '2026-10-21T01:00:00Z', title: '到点', note: '', recurrence: null } as Task;
    db.tasks = [task, { ...task, id: 'deleted', deletedAt: '2026-10-20' }, { ...task, id: 'rule', recurrence: { freq: 'daily', at: '09:00' } }];
    const keys = new Set<string>();
    const tx = { notification: { createMany: async (input: { skipDuplicates: boolean; data: Array<{ dedupeKey: string }> }) => {
      expect(input.skipDuplicates).toBe(true); input.data.forEach(n => keys.add(n.dedupeKey));
    } } } as unknown as Prisma.TransactionClient;
    await deliverTeamReminders(db, tx, new Date('2026-10-21T02:00:00Z'));
    await deliverTeamReminders(db, tx, new Date('2026-10-21T02:00:00Z'));
    expect([...keys]).toEqual(['team-task:task:member:2026-10-21T01:00:00Z']);
  });
  it('notifies newly assigned users without alerting the creator about self assignment', async () => {
    const db = emptyDb();
    db.users = [{ id: 'alice', state: 'active' }, { id: 'bob', state: 'active' }] as typeof db.users;
    db.tasks = [{ id: 'task', assigneeId: 'bob', creatorId: 'alice', ownerId: null, status: 'open',
      scope: 'user', deletedAt: null, recurrence: null, title: '交接', updatedAt: '示例公司有限公司' } as Task];
    const notifications: Array<{ userId: string }> = [];
    const tx = { notification: { createMany: async (input: { data: Array<{ userId: string }> }) => { notifications.push(...input.data); } } } as unknown as Prisma.TransactionClient;
    await deliverAssignments([], db, tx);
    await deliverAssignments(db.tasks, db, tx);
    expect(notifications.map(n => n.userId)).toEqual(['bob']);
  });
});
