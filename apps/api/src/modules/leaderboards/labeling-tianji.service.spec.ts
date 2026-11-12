import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canCollectLabeling, labelingMemberIds, LabelingTianjiService } from './labeling-tianji.service.js';
const actor = { id: 'current-member', organizationId: 'org', email: 'current@example.test', roles: ['TRAINEE'], permissions: [] };
function fixture(allowed = true) {
  const scope = { self: { name: '本人' }, isManager: false, isTrainee: allowed, isAiStaff: false,
    members: new Map([['person', { data: { active: true } }], ['inactive', { data: { active: false } }]]),
    users: new Map([['person', { name: '本人', active: true }], ['inactive', { name: '已退出成员', active: true }], ['outside', { name: '其他部门', active: true }]]) };
  const db = {
    user: { findFirst: vi.fn(async () => ({ id: actor.id, email: actor.email, roles: [] })) },
    traineeProfile: { findMany: vi.fn(async () => [{ userId: 'person', user: { displayName: '本人' } }]) },
    traineeLabelingTianjiIdentity: { findMany: vi.fn(async () => []), create: vi.fn() },
    traineeLabelingTianjiDay: { upsert: vi.fn() },
    traineeLabelingSync: { findFirst: vi.fn(async () => null), updateMany: vi.fn(async () => ({ count: 1 })), create: vi.fn(async (input: { data: unknown }) => ({ id: 'job', ...input.data as object, status: 'QUEUED', processed: 0, result: null, createdAt: new Date(), updatedAt: new Date(), finishedAt: null })) },
  };
  const prisma = { ...db, $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ ...db, $executeRaw: vi.fn() })) };
  const repo = { loadScope: vi.fn(async () => scope) };
  const service = new LabelingTianjiService(prisma as never, repo as never);
  vi.spyOn(service as unknown as { drain: () => Promise<void> }, 'drain').mockResolvedValue();
  return { service, prisma, repo, scope };
}
beforeEach(() => { vi.stubEnv('EXTERNAL_COLLAB_URL', 'http://external-collab:3003'); vi.stubEnv('EXTERNAL_COLLAB_PROXY_SECRET', 'test-only-signature'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('personal Tianji labeling authorization', () => {
  it('enables managers, AI staff and trainees, without relying on a person name', () => {
    for (const role of ['isManager', 'isAiStaff', 'isTrainee']) expect(canCollectLabeling({ isManager: false, isAiStaff: false, isTrainee: false, [role]: true })).toBe(true);
    expect(canCollectLabeling({ isManager: false, isAiStaff: false, isTrainee: false })).toBe(false);
  });
  it('limits collection targets to current active AI-center members', () => {
    const { scope } = fixture();
    expect(labelingMemberIds(scope as never)).toEqual(['person']);
    scope.users.get('person')!.active = false;
    expect(labelingMemberIds(scope as never)).toEqual([]);
  });
  it('filters historical unrelated names from both status and job responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ authenticated: true })));
    const { service, prisma } = fixture();
    prisma.traineeLabelingSync.findFirst.mockResolvedValue({ id: 'old-job', from: new Date('2026-11-09'), to: new Date('2026-11-10'), status: 'SUCCEEDED', message: '抓取完成', processed: 10,
      result: { matchedPeople: 1, skippedNames: ['其他部门', '本人'] }, createdAt: new Date(), updatedAt: new Date(), finishedAt: new Date() } as never);
    const status = await service.status(actor), job = await service.job(actor, 'old-job');
    expect(status.latestJob?.result?.skippedNames).toEqual(['本人']);
    expect(job.result?.skippedNames).toEqual(['本人']);
    expect(JSON.stringify([status, job])).not.toContain('其他部门');
  });
  it('applies the AI-member roster before loading profiles and verified source identities', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 200, data: { list: [], count: 0 } })));
    const { service, prisma } = fixture();
    await expect((service as unknown as { execute: (job: unknown) => Promise<void> }).execute({ id: 'job', organizationId: 'org', actorId: actor.id, from: new Date('2026-11-09'), to: new Date('2026-11-10'), workerKey: 'worker' })).rejects.toThrow('尚未与本组织');
    expect(prisma.traineeProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: { in: ['person'] } }) }));
    expect(prisma.traineeLabelingTianjiIdentity.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org', traineeId: { in: ['person'] } } });
  });
  it('signs every upstream request as the current member and never borrows the service account', async () => {
    const fetch = vi.fn(async () => Response.json({ authenticated: true, configured: true, identity: { employeeId: 2019, employeeName: '本人' } })); vi.stubGlobal('fetch', fetch);
    const result = await fixture().service.status(actor);
    expect(result).toMatchObject({ authenticated: true, name: '本人', employeeId: 2019 });
    const call = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = call[1].headers as Record<string, string>;
    const claim = JSON.parse(Buffer.from(headers['x-fangpian-claim'], 'base64url').toString());
    expect(claim.actor).toEqual({ userId: actor.id, organizationId: 'org', displayName: '本人' });
    expect(call[0]).toBe('http://external-collab:3003/api/tianji/login/session');
  });
  it('rejects ordinary employees before crossing the private service boundary', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(fixture(false).service.status(actor)).rejects.toMatchObject({ status: 403 }); expect(fetch).not.toHaveBeenCalled();
  });
  it('refuses an unauthenticated member without starting a job or falling back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ authenticated: false, configured: true })));
    const { service, prisma } = fixture(); await expect(service.start(actor, { from: '2026-11-01', to: '2026-11-01' })).rejects.toMatchObject({ status: 403 }); expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('isolates job reads by actor and organization', async () => {
    const { service, prisma } = fixture(); await expect(service.job(actor, 'foreign-job')).rejects.toMatchObject({ status: 404 });
    expect(prisma.traineeLabelingSync.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-job', actorId: actor.id, organizationId: 'org' } });
  });
  it('surfaces safe permission errors without returning upstream credentials or diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'private-upstream-secret' }, { status: 403 })));
    await expect(fixture().service.status(actor)).rejects.toThrow('无权读取');
    try { await fixture().service.status(actor); } catch (error) { expect(String(error)).not.toContain('private-upstream-secret'); }
  });
  it('keeps source errors outside the publishing transaction and leaves existing data untouched', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => Response.json(String(url).includes('/completion?')
      ? { code: 200, data: { list: [{ employee_id: 10, tagger: '本人', batch_date: '2026-11-01', submitted: 1 }], count: 1 } }
      : { code: 200, data: { list: [{ employee_id: 10, assign_id: 1, submitted: 1, submit_time: '' }], count: 1 } })));
    const { service, prisma } = fixture();
    await expect((service as unknown as { execute: (job: unknown) => Promise<void> }).execute({ id: 'job', organizationId: 'org', actorId: actor.id, from: new Date('2026-11-01'), to: new Date('2026-11-02'), workerKey: 'current-worker' })).rejects.toThrow('提交时间');
    expect(prisma.$transaction).not.toHaveBeenCalled(); expect(prisma.traineeLabelingTianjiDay.upsert).not.toHaveBeenCalled();
  });
  it('does not publish results when a newer worker owns the job lease', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => Response.json(String(url).includes('/completion?')
      ? { code: 200, data: { list: [{ employee_id: 10, tagger: '本人', batch_date: '2026-11-01', submitted: 0 }], count: 1 } }
      : { code: 200, data: { list: [{ employee_id: 10, assign_id: 1, submitted: 0, submit_time: '' }], count: 1 } })));
    const { service, prisma } = fixture();
    await expect((service as unknown as { execute: (job: unknown) => Promise<void> }).execute({ id: 'job', organizationId: 'org', actorId: actor.id, from: new Date('2026-11-01'), to: new Date('2026-11-02'), workerKey: 'expired-worker' })).rejects.toMatchObject({ status: 409 });
    expect(prisma.traineeLabelingTianjiDay.upsert).not.toHaveBeenCalled(); expect(prisma.traineeLabelingTianjiIdentity.create).not.toHaveBeenCalled();
  });
});
