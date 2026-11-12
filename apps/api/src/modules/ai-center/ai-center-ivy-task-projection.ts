import type { Priority } from './ai-center.types.js';

export const IVY_TASK_POLICY_FIELD = 'taskIvyPolicy';
export type TaskIvyState = {
  ownerId: string | null; assigneeId: string | null; title: string; status: string;
  approvedAt: string | null; confirmedDifficulty: string | null;
  priority: Priority; progress: number; dueAt: string | null; accepted: boolean; acceptedAt:string|null;
};
export type TaskIvyEvent = { taskId: string; version: number; at: string; state: TaskIvyState };
export type TaskIvyPolicy = { schema: 1; enabledAt: string; enabledFrom: string; baselines: TaskIvyEvent[] };
export type IvyTaskEntry = { taskId: string; title: string; status: 'DONE' | 'DOING' | 'NOT_DONE'; taskStatus: string; priority: Priority; progress: number; dueAt: string | null };
export type IvyTaskDay = { ownerId: string; ownerName: string; dateKey: string; entries: IvyTaskEntry[] };
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown) => typeof v === 'string' && v.length ? v : null;
const grades = ['S', 'A', 'B', 'C'];
const stamp = (s: string | null) => s ? Date.parse(s) : NaN;
const day = (n: number) => new Date(n + 8 * 3600000).toISOString().slice(0, 10);
export const validIvyDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

/** Only the fields needed by the diary are projected; no task evidence or files. */
export function captureTaskIvyState(row: { ownerId: string | null; status: string; data: unknown }): TaskIvyState {
  const d = object(row.data), review = object(d.review);
  return { ownerId: row.ownerId, assigneeId: str(d.assigneeId), title: typeof d.title === 'string' ? d.title : '', status: row.status,
    approvedAt: str(d.approvedAt), confirmedDifficulty: str(d.confirmedDifficulty), priority: ['P0', 'P1', 'P2', 'P3'].includes(String(d.priority)) ? d.priority as Priority : 'P2',
    progress: typeof d.progress === 'number' && Number.isFinite(d.progress) ? Math.min(100, Math.max(0, d.progress)) : 0,
    dueAt: str(d.dueAt), accepted: grades.includes(String(review.grade)) && !!str(review.reviewerId), acceptedAt:str(review.at) };
}
export function readTaskIvyPolicy(value: unknown): TaskIvyPolicy | null {
  const v = object(value);
  if (v.schema !== 1 || typeof v.enabledFrom !== 'string' || !validIvyDay(v.enabledFrom) || typeof v.enabledAt !== 'string' || !Number.isFinite(stamp(v.enabledAt)) || day(stamp(v.enabledAt)) !== v.enabledFrom || !Array.isArray(v.baselines)) return null;
  const baselines: TaskIvyEvent[] = [];
  const ids = new Set<string>();
  for (const raw of v.baselines) {
    const e = object(raw), s = object(e.state);
    if (!str(e.taskId) || typeof e.version !== 'number' || !Number.isInteger(e.version) || e.version < 1 || !str(s.ownerId) || s.assigneeId !== s.ownerId || !str(s.title) || !str(s.status) || !str(s.approvedAt) || !Number.isFinite(stamp(str(s.approvedAt))) || !grades.includes(String(s.confirmedDifficulty)) || typeof s.accepted !== 'boolean' || ids.has(String(e.taskId))) return null;
    ids.add(String(e.taskId));
    const state = captureTaskIvyState({ ownerId: String(s.ownerId), status: String(s.status), data: s });
    state.accepted = s.accepted;
    state.acceptedAt = str(s.acceptedAt);
    baselines.push({ taskId: String(e.taskId), version: e.version, at: v.enabledAt, state });
  }
  return { schema: 1, enabledAt: v.enabledAt, enabledFrom: v.enabledFrom, baselines };
}
const approved = (s: TaskIvyState, time: number) => !!s.ownerId && s.assigneeId === s.ownerId && !!s.title && grades.includes(s.confirmedDifficulty ?? '') && Number.isFinite(stamp(s.approvedAt)) && stamp(s.approvedAt) <= time;
const cancelled = (s: TaskIvyState) => ['CANCELLED', 'CANCELED'].includes(s.status);
export const taskIvyIsOpen = (s: TaskIvyState, time: number) => approved(s, time) && ['ACTIVE', 'SUBMITTED', 'RETURNED', 'COMPLETED'].includes(s.status) && !(s.status === 'COMPLETED' && s.accepted);

/** Read-only daily projection. Historical cutoffs never use a later task state. */
export function projectTaskIvyDays(input: { policy: TaskIvyPolicy; events: TaskIvyEvent[]; dates: string[]; 示例公司有限公司: string; owners: Map<string, string>; ownerSince?: Map<string,string> }): IvyTaskDay[] {
  const { policy, owners } = input;
  const enabled = stamp(policy.enabledAt), 示例公司有限公司 = stamp(input.示例公司有限公司);
  if (!Number.isFinite(enabled) || !Number.isFinite(示例公司有限公司) || 示例公司有限公司 < enabled) return [];
  const timelines = new Map<string, Map<number, TaskIvyEvent>>();
  const baselineVersions = new Map(policy.baselines.map(e => [e.taskId, e.version]));
  for (const e of policy.baselines) timelines.set(e.taskId, new Map([[e.version, { ...e, at: policy.enabledAt }]]));
  for (const e of input.events) {
    if (!Number.isFinite(stamp(e.at)) || !Number.isInteger(e.version) || e.version <= (baselineVersions.get(e.taskId) ?? 0)) continue;
    const acceptedAt=e.state.status==='COMPLETED'&&e.state.accepted?stamp(e.state.acceptedAt):NaN;
    const at = Math.max(stamp(e.at), Number.isFinite(stamp(e.state.approvedAt)) ? stamp(e.state.approvedAt) : -Infinity,Number.isFinite(acceptedAt)?acceptedAt:-Infinity);
    if (at < enabled) continue;
    const versions = timelines.get(e.taskId) ?? new Map<number, TaskIvyEvent>();
    if (!versions.has(e.version)) versions.set(e.version, { ...e, at: new Date(at).toISOString() });
    timelines.set(e.taskId, versions);
  }
  const histories = [...timelines].map(([taskId, versions]) => {
    let previous = enabled;
    const events = [...versions.values()].sort((a, b) => a.version - b.version).map(e => {
      previous = Math.max(previous, stamp(e.at));
      return { ...e, time: previous };
    });
    return { taskId, events };
  });
  const result = new Map<string, IvyTaskDay>();
  for (const dateKey of [...new Set(input.dates)].sort()) {
    if (!validIvyDay(dateKey) || dateKey < policy.enabledFrom || dateKey > day(示例公司有限公司)) continue;
    const start = Date.parse(dateKey + 'T00:00:00+08:00');
    for (const { taskId, events } of histories) {
      const since = input.ownerSince?.get(events.at(-1)?.state.ownerId ?? '');
      if (since && dateKey < since) continue;
      const end = Math.min(start + 86400000, 示例公司有限公司 + 1);
      let state: TaskIvyState | undefined;
      let active = false;
      for (const e of events) {
        if (e.time >= end) break;
        if (e.time < start) state = e.state;
        else {
          if (state && taskIvyIsOpen(state, Math.max(start, enabled))) active = true;
          state = e.state;
          if (taskIvyIsOpen(state, e.time)) active = true;
        }
      }
      if (state && taskIvyIsOpen(state, end - 1)) active = true;
      if (!active || !state?.ownerId || !owners.has(state.ownerId) || !approved(state, end - 1)) continue;
      const entry: IvyTaskEntry = { taskId, title: state.title, status: cancelled(state) ? 'NOT_DONE' : state.status === 'COMPLETED' && state.accepted ? 'DONE' : 'DOING',
        taskStatus: state.status, priority: state.priority, progress: state.progress, dueAt: state.dueAt };
      const key = `${state.ownerId}:${dateKey}`;
      const record = result.get(key) ?? { ownerId: state.ownerId, ownerName: owners.get(state.ownerId)!, dateKey, entries: [] };
      record.entries.push(entry); result.set(key, record);
    }
  }
  return [...result.values()].map(r => ({ ...r, entries: r.entries.sort((a, b) => a.priority.localeCompare(b.priority) || a.title.localeCompare(b.title, 'zh-CN') || a.taskId.localeCompare(b.taskId)) }));
}
