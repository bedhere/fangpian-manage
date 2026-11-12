import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LabelingService } from './labeling.service.js';

const actor = { id: 'viewer', organizationId: 'org', email: 'viewer@example.test', roles: ['EMPLOYEE'], permissions: [] };
const day = new Date('2026-11-01T00:00:00Z');
const saved = { id: 'entry', organizationId: 'org', traineeId: 'a', workDate: day, count: 10, version: 1, source: 'MANUAL', note: '', updatedAt: day };
function fixture(manager = true) {
  const db = {
    traineeLabelingTianjiDay: { findMany: vi.fn(async () => [] as { traineeId: string; workDate: Date; count: number; updatedAt: Date }[]) },
    traineeProfile: { findMany: vi.fn(async () => ['a', 'b', 'c', 'd'].map(userId => ({ userId, user: { displayName: userId, department: null } }))), findFirst: vi.fn(async () => ({ userId: 'a' })) },
    traineeLabelingEntry: { groupBy: vi.fn(async () => [] as unknown[]), findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null as typeof saved | null), findUniqueOrThrow: vi.fn(async () => ({ ...saved, version: 2 })), create: vi.fn(async () => saved), updateMany: vi.fn(async () => ({ count: 1 })) },
    traineeLabelingImport: { findUnique: vi.fn(async () => null as { payloadHash: string; result: unknown } | null), create: vi.fn(async (_input: { data: { payloadHash: string; result: unknown } }) => undefined) }, auditLog: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(async (fn: (db: unknown) => unknown) => fn(db)) };
  const repo = { loadScope: vi.fn(async () => ({ isManager: manager })) };
  return { db, prisma, repo, service: new LabelingService(prisma as never, repo as never) };
}
beforeEach(() => vi.useRealTimers());
describe('labeling leaderboard', () => {
  it('is readable by an ordinary member and ranks sums with competition ties, including recorded zero', async () => {
    const { db, service } = fixture(false);
    db.traineeLabelingEntry.groupBy.mockResolvedValue([
      { traineeId: 'a', _sum: { count: 200 }, _count: { _all: 2 }, _max: { updatedAt: day } },
      { traineeId: 'b', _sum: { count: 200 }, _count: { _all: 1 }, _max: { updatedAt: day } },
      { traineeId: 'c', _sum: { count: 0 }, _count: { _all: 1 }, _max: { updatedAt: day } },
    ]);
    const result = await service.leaderboard(actor, { from: '2026-11-01', to: '2026-11-02' });
    expect(result.rows.map(row => [row.traineeId, row.count, row.rank])).toEqual([['a', 200, 1], ['b', 200, 1], ['c', 0, 3], ['d', 0, null]]);
    expect(result.canManage).toBe(false);
    expect(result.summary).toEqual({ totalCount: 400, participants: 3, traineeCount: 4 });
    expect(db.traineeLabelingEntry.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', traineeId: { in: ['a', 'b', 'c', 'd'] }, workDate: { gte: day, lte: new Date('2026-11-02T00:00:00Z') } } }));
    expect(db.traineeProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', user: { organizationId: 'org', status: 'ACTIVE', deletedAt: null } } }));
  });
  it.each([{ from: '2026-02-30' }, { from: '2026-11-02', to: '2026-11-01' }, { from: '2025-01-01', to: '2026-11-01' }])('rejects invalid or oversized dates %j', async query => {
    const { prisma, service } = fixture(); await expect(service.leaderboard(actor, query)).rejects.toMatchObject({ status: 400 }); expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('defaults to the Shanghai day at a UTC day boundary', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T17:00:00Z'));
    const result = await fixture().service.leaderboard(actor, {}); expect(result.from).toBe('2026-11-02'); expect(result.to).toBe(result.from);
  });
  it('has an explicit empty result with no invented ranking', async () => {
    const result = await fixture().service.leaderboard(actor, { from: '2026-11-01' }); expect(result.summary.participants).toBe(0); expect(result.rows.every(row => row.rank === null)).toBe(true);
  });
  it('uses Tianji counts on uncovered days and preserves manual totals on overlapping dates', async () => {
    const { db, service } = fixture();
    db.traineeLabelingEntry.groupBy.mockResolvedValue([{ traineeId: 'a', _sum: { count: 100 }, _count: { _all: 1 }, _max: { updatedAt: day } }]);
    db.traineeLabelingEntry.findMany.mockResolvedValue([{ traineeId: 'a', workDate: day }] as never);
    db.traineeLabelingTianjiDay.findMany.mockResolvedValue([
      { traineeId: 'a', workDate: day, count: 900, updatedAt: day },
      { traineeId: 'a', workDate: new Date('2026-11-02T00:00:00Z'), count: 40, updatedAt: day },
      { traineeId: 'b', workDate: day, count: 80, updatedAt: day },
    ]);
    const result = await service.leaderboard(actor, { from: '2026-11-01', to: '2026-11-02' });
    expect(result.rows.find(row => row.traineeId === 'a')).toMatchObject({ count: 140, reportedDays: 2 });
    expect(result.rows.find(row => row.traineeId === 'b')).toMatchObject({ count: 80, reportedDays: 1 });
    expect(result.summary.totalCount).toBe(220);
  });
});
describe('labeling writes and imports', () => {
  const input = { traineeId: 'a', workDate: '2026-11-01', count: 10, version: 0 };
  it('saves a daily total and audit record', async () => {
    const { db, service } = fixture(); await service.save(actor, input);
    expect(db.traineeLabelingEntry.create).toHaveBeenCalledWith({ data: { organizationId: 'org', traineeId: 'a', workDate: day, count: 10, note: '', source: 'MANUAL', updatedBy: actor.id } });
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org', actorId: actor.id, action: 'LABELING_SAVED' }) }));
  });
  it('replaces the count, increments the version, and audits the old count', async () => {
    const { db, service } = fixture(); db.traineeLabelingEntry.findUnique.mockResolvedValue(saved);
    await service.save(actor, { ...input, count: 0, version: 1 });
    expect(db.traineeLabelingEntry.updateMany).toHaveBeenCalledWith({ where: { organizationId: 'org', traineeId: 'a', workDate: day, version: 1 }, data: { count: 0, note: '', source: 'MANUAL', updatedBy: actor.id, version: { increment: 1 } } });
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ before: expect.objectContaining({ count: 10, version: 1 }) }) }));
  });
  it('rejects stale manual writes and concurrent updates', async () => {
    const { db, service } = fixture(); db.traineeLabelingEntry.findUnique.mockResolvedValue(saved);
    await expect(service.save(actor, input)).rejects.toMatchObject({ status: 409 });
    db.traineeLabelingEntry.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.save(actor, { ...input, version: 1 })).rejects.toMatchObject({ status: 409 }); expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it('rejects cross-organization or inactive trainees', async () => {
    const { db, service } = fixture(); db.traineeProfile.findFirst.mockResolvedValue(null as never);
    await expect(service.save(actor, input)).rejects.toMatchObject({ status: 404 }); expect(db.traineeLabelingEntry.create).not.toHaveBeenCalled();
    expect(db.traineeProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', userId: 'a', user: { organizationId: 'org', status: 'ACTIVE', deletedAt: null } } }));
  });
  it('rejects future dates', async () => {
    const { db, service } = fixture(); await expect(service.save(actor, { ...input, workDate: '2099-01-01' })).rejects.toMatchObject({ status: 400 }); expect(db.traineeLabelingEntry.create).not.toHaveBeenCalled();
  });
  it('blocks ordinary employees from maintenance, daily details and imports', async () => {
    const { db, service } = fixture(false);
    await expect(service.save(actor, input)).rejects.toMatchObject({ status: 403 });
    await expect(service.daily(actor, input.workDate)).rejects.toMatchObject({ status: 403 });
    await expect(service.import(actor, { requestId: 'batch', entries: [input] })).rejects.toMatchObject({ status: 403 }); expect(db.traineeLabelingEntry.create).not.toHaveBeenCalled();
  });
  it('imports atomically in one transaction and returns a stable replay without new writes', async () => {
    const { db, prisma, service } = fixture();
    const result = await service.import(actor, { requestId: 'batch', entries: [input] });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(db.traineeLabelingEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: 'API', count: 10 }) }));
    const imported = db.traineeLabelingImport.create.mock.calls[0][0].data;
    db.traineeLabelingImport.findUnique.mockResolvedValue({ payloadHash: imported.payloadHash, result });
    expect(await service.import(actor, { requestId: 'batch', entries: [input] })).toEqual(result);
    expect(db.traineeLabelingEntry.create).toHaveBeenCalledTimes(1);
    await expect(service.import(actor, { requestId: 'batch', entries: [{ ...input, count: 20 }] })).rejects.toMatchObject({ status: 409 });
  });
  it('rejects duplicate person/day pairs before starting a batch', async () => {
    const { prisma, service } = fixture(); await expect(service.import(actor, { requestId: 'batch', entries: [input, { ...input, traineeId: 'A' }] })).rejects.toMatchObject({ status: 400 }); expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
