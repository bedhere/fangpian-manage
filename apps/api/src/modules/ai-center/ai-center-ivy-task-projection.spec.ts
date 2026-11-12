import { describe, expect, it } from 'vitest';
import { captureTaskIvyState, projectTaskIvyDays, type TaskIvyEvent, type TaskIvyPolicy } from './ai-center-ivy-task-projection.js';
const at = (day: string, clock = '10:00') => `${day}T${clock}:00+08:00`;
const event = (version: number, stamp: string, patch: Record<string, unknown> = {}): TaskIvyEvent => ({ taskId: 'task-1', version, at: stamp,
  state: captureTaskIvyState({ ownerId: 'trainee', status: 'ACTIVE', data: { title: '制作业务工具', assigneeId: 'trainee', approvedAt: at('2026-11-04'), confirmedDifficulty: 'B', priority: 'P1', progress: 0, dueAt: at('2026-11-08'), ...patch } }) });
const policy: TaskIvyPolicy = { schema: 1, enabledAt: at('2026-11-04', '09:00'), enabledFrom: '2026-11-04', baselines: [] };
function run(events: TaskIvyEvent[], dates = ['2026-11-04', '2026-11-05'], override: TaskIvyPolicy = policy) {
  return projectTaskIvyDays({ policy: override, events, dates, 示例公司有限公司: at('2026-11-06'), owners: new Map([['trainee', '管培生']]) });
}
describe('daily task links, no writes or scoring (offline)', () => {
  it('includes approved tasks from the approval day and carries them to subsequent days', () => {
    expect(run([event(2, at('2026-11-04'))]).map(d => [d.dateKey, d.entries[0].status])).toEqual([['2026-11-04', 'DOING'], ['2026-11-05', 'DOING']]);
  });
  it('ignores applications that have not been approved', () => {
    expect(run([event(1, at('2026-11-04'), { approvedAt: null, confirmedDifficulty: null })])).toEqual([]);
  });
  it('never treats a personal progress of 100% as acceptance', () => {
    expect(run([event(2, at('2026-11-04'), { progress: 100 })])[0].entries[0].status).toBe('DOING');
  });
  it('freezes the previous day and completes only on the mentor acceptance day', () => {
    const approved = event(2, at('2026-11-04'));
    const completed = { ...event(3, at('2026-11-05'), { progress: 100, review: { grade: 'A', reviewerId: 'mentor' } }), state: { ...event(3, at('2026-11-05'), { progress: 100, review: { grade: 'A', reviewerId: 'mentor' } }).state, status: 'COMPLETED' } };
    const days = run([approved, completed], ['2026-11-04', '2026-11-05', '2026-11-06']);
    expect(days.map(d => d.entries[0].status)).toEqual(['DOING', 'DONE']);
    expect(days[0].entries[0].progress).toBe(0);
  });
  it('shows cancellation on its day and stops carrying it afterwards', () => {
    const cancelled = { ...event(3, at('2026-11-05')), state: { ...event(3, at('2026-11-05')).state, status: 'CANCELLED' } };
    const days = run([event(2, at('2026-11-04')), cancelled], ['2026-11-04', '2026-11-05', '2026-11-06']);
    expect(days.map(d => d.entries[0].status)).toEqual(['DOING', 'NOT_DONE']);
  });
  it('includes an existing unfinished baseline without backfilling older days', () => {
    const baseline = event(7, policy.enabledAt, { approvedAt: at('2026-10-28') });
    expect(run([], ['2026-11-03', '2026-11-04'], { ...policy, baselines: [baseline] }).map(d => d.dateKey)).toEqual(['2026-11-04']);
  });
  it('retains the activation snapshot when old history has the same version', () => {
    const baseline = event(7, policy.enabledAt, { progress: 40, approvedAt: at('2026-10-28') });
    expect(run([event(7, at('2026-10-28'))], ['2026-11-04'], { ...policy, baselines: [baseline] })[0].entries[0].progress).toBe(40);
  });
  it('does not leak unapproved titles into an earlier day or include other owners', () => {
    const other = { ...event(3, at('2026-11-04')), taskId: 'other', state: { ...event(3, at('2026-11-04')).state, ownerId: 'other', assigneeId: 'other' } };
    expect(run([event(2, at('2026-11-05')), other], ['2026-11-04'])).toEqual([]);
  });
  it('handles midnight in Beijing and deduplicates repeated history versions', () => {
    const approved = event(2, '2026-11-04T16:00:00Z', { approvedAt: '2026-11-04T16:00:00Z' });
    const days = run([approved, approved]);
    expect(days.map(d => d.dateKey)).toEqual(['2026-11-05']);
    expect(days[0].entries).toHaveLength(1);
  });
  it('uses the explicit acceptance timestamp when a review transaction crosses midnight', () => {
    const completed=event(3,'2026-11-04T15:59:59Z',{review:{grade:'A',reviewerId:'mentor',at:'2026-11-04T16:00:01Z'}});completed.state.status='COMPLETED';
    const days=run([event(2,at('2026-11-04')),completed]);
    expect(days.map(d=>d.entries[0].status)).toEqual(['DOING','DONE']);
  });
  it('keeps returned submissions in progress and does not fabricate future entries', () => {
    const returned = event(3, at('2026-11-04'), { progress: 100 }); returned.state.status = 'RETURNED';
    const days = run([returned], ['2026-11-04', '2026-11-07']);
    expect(days).toHaveLength(1); expect(days[0].entries[0].status).toBe('DOING');
  });
  it('does not invent diary entries before the member joined training', () => {
    const days = projectTaskIvyDays({ policy, events: [event(2, at('2026-11-04'))], dates: ['2026-11-04','2026-11-05'], 示例公司有限公司: at('2026-11-06'), owners: new Map([['trainee','管培生']]), ownerSince: new Map([['trainee','2026-11-05']]) });
    expect(days.map(d=>d.dateKey)).toEqual(['2026-11-05']);
  });
});
