import { describe, expect, it, vi } from 'vitest';
import { loadTaskIvyDays } from './ai-center-ivy-tasks.js';
import { captureTaskIvyState } from './ai-center-ivy-task-projection.js';
import type { AiContext, AiRecord, TaskData } from './ai-center.types.js';
const task = (id: string, ownerId: string) => ({ id, ownerId, version: 2, status: 'ACTIVE', updatedAt: new Date('2026-11-04T02:00:00Z'), data: { title: ownerId + '任务', assigneeId: ownerId, approvedAt: '2026-11-03T02:00:00Z', confirmedDifficulty: 'B', progress: 20, priority: 'P1' } }) as AiRecord<TaskData>;
describe('diary projection read scope (offline)', () => {
  it('loads only currently authorized trainee task histories and excludes policy baselines of other owners', async () => {
    const a = task('a-task', 'a'), b = task('b-task', 'b');
    const policy = { schema: 1, enabledFrom: '2026-11-04', enabledAt: '2026-11-04T01:00:00Z', baselines: [a, b].map(t => ({ taskId: t.id, version: 2, at: '2026-11-04T01:00:00Z', state: captureTaskIvyState(t) })) };
    const findHistory = vi.fn().mockResolvedValue([]);
    const ctx = { actor: { organizationId: 'org' }, tx: { aiCenterRecord: { findMany: vi.fn().mockResolvedValue([{ data: {taskIvyPolicy:policy} }]) }, aiCenterHistory: { findMany: findHistory } },
      scope: { members: new Map([['a', { data: { active: true,sinceDate:'2026-11-02' } }], ['b', { data: { active: true,sinceDate:'2026-11-02' } }]]), user: (id: string) => ({ active: true, name: id }), canReadOwner: (id: string) => id === 'a' } } as unknown as AiContext;
    const result = await loadTaskIvyDays(ctx, '2026-11-02', [a, b], [], '2026-11-04T04:00:00Z');
    expect(findHistory).toHaveBeenCalledTimes(1);
    expect(findHistory.mock.calls[0][0].where.OR).toEqual([{recordId:'a-task',version:{gt:2}}]);
    expect(result.ivyTaskDays?.map(d => d.ownerId)).toEqual(['a']);
    expect(result.ivyTaskDays?.[0].entries[0].title).toBe('a任务');
  });
  it('keeps legacy workspaces unchanged when the feature has not been activated', async () => {
    const findHistory = vi.fn();
    const ctx = { actor: { organizationId: 'org' }, tx: { aiCenterRecord: { findMany: vi.fn().mockResolvedValue([]) }, aiCenterHistory: { findMany: findHistory } } } as unknown as AiContext;
    await expect(loadTaskIvyDays(ctx, '2026-11-02', [], [])).resolves.toEqual({});
    expect(findHistory).not.toHaveBeenCalled();
  });
  it('does not alter approved task histories on member pause/reactivation or later account edits', async () => {
    const a=task('a-task','a');
    const policy={schema:1,enabledFrom:'2026-11-04',enabledAt:'2026-11-04T01:00:00Z',baselines:[{taskId:a.id,version:2,at:'2026-11-04T01:00:00Z',state:captureTaskIvyState(a)}]};
    const findHistory=vi.fn().mockResolvedValue([]);
    const member={id:'member',updatedAt:new Date('2026-11-06T10:00:00Z'),data:{active:false,sinceDate:'2026-11-04'}};
    const ctx={actor:{organizationId:'org'},tx:{aiCenterRecord:{findMany:vi.fn().mockResolvedValue([{data:{taskIvyPolicy:policy}}])},aiCenterHistory:{findMany:findHistory}},scope:{members:new Map([['a',member]]),user:()=>({active:false,name:'a'}),canReadOwner:()=>true}} as unknown as AiContext;
    const result=await loadTaskIvyDays(ctx,'2026-11-02',[a],[],'2026-11-07T04:00:00Z');
    expect(result.ivyTaskDays?.map(d=>d.dateKey)).toEqual(['2026-11-04','2026-11-05','2026-11-06','2026-11-07']);
    member.data.active=true;member.updatedAt=new Date('2026-11-07T01:00:00Z');
    const restarted=await loadTaskIvyDays(ctx,'2026-11-02',[a],[],'2026-11-07T04:00:00Z');
    expect(restarted.ivyTaskDays).toEqual(result.ivyTaskDays);
  });
});
