import { describe, expect, it, vi } from 'vitest';
import { TeamWorkRepository } from './team-work.repository.js';
import { emptyDb } from './domain/types.js';
import type { PrismaService } from '../../infrastructure/prisma.service.js';

function fixture() {
  const personal = { prefs: {}, memos: [], ivy: [], avatarEmoji: null, avatarColor: null };
  // PostgreSQL JSONB returns keys in a different order from the application.
  const saved = { personal: { alice: personal }, settings: emptyDb().settings, appraisals: [], tasks: [] };
  const tx = {
    $executeRaw: vi.fn(),
    teamWorkState: { findUnique: vi.fn(async () => ({ data: structuredClone(saved) })), upsert: vi.fn() },
    department: { findMany: vi.fn(async () => []) },
    user: { findMany: vi.fn(async () => [{ id: 'alice', displayName: 'Alice', email: 'alice@example.com', username: null,
      isDemoAccount: false, roles: [], status: 'ACTIVE', departmentId: null, createdAt: new Date(), mustChangePassword: false }]) },
    notification: { createMany: vi.fn() },
  };
  const prisma = { $transaction: async (fn: (tx: unknown) => unknown) => fn(tx) };
  return { repository: new TeamWorkRepository(prisma as unknown as PrismaService), tx };
}

describe('team work snapshot persistence', () => {
  it('loads and persists task progress history without adding it to task snapshots', async () => {
    const { repository, tx } = fixture();
    const entry = { id: 'log', taskId: 'task', authorId: 'alice', authorName: 'Alice', createdAt: new Date().toISOString(), progressPercent: 50, summary: '已完成一半', nextAction: '继续完成', riskLevel: 0 };
    await repository.runOrganization('org', async db => { db.taskUpdates = [entry]; });
    expect(tx.teamWorkState.upsert.mock.calls[0]?.[0]).toMatchObject({ update: { data: { taskUpdates: [entry] } } });
    tx.teamWorkState.findUnique.mockResolvedValueOnce({ data: { personal: { alice: { prefs: {}, memos: [], ivy: [], avatarEmoji: null, avatarColor: null } }, settings: emptyDb().settings, appraisals: [], tasks: [], taskUpdates: [entry] } } as any);
    await repository.runOrganization('org', async db => { expect(db.taskUpdates).toEqual([entry]); });
    expect(tx.teamWorkState.upsert).toHaveBeenCalledTimes(1);
  });
  it('does not rewrite unchanged JSONB state on read requests', async () => {
    const { repository, tx } = fixture();
    await repository.runOrganization('org', async db => db.tasks.length);
    expect(tx.teamWorkState.upsert).not.toHaveBeenCalled();
  });
  it('still persists in-place changes once under the organization lock', async () => {
    const { repository, tx } = fixture();
    await repository.runOrganization('org', async db => { db.users[0]!.memos.push({ id: 'memo', text: '示例品牌 this', done: false, createdAt: new Date().toISOString(), doneAt: null }); });
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(tx.teamWorkState.upsert).toHaveBeenCalledOnce();
    expect(tx.teamWorkState.upsert.mock.calls[0]?.[0]).toMatchObject({ update: { data: { personal: { alice: { memos: [{ text: '示例品牌 this' }] } } } } });
  });
});
