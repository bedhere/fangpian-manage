import { dayShift, MENTOR_APPROVER_ID } from './ai-center.repository.js';
import type { AiContext, AiRecord, IvyData, TaskData } from './ai-center.types.js';
import { captureTaskIvyState, IVY_TASK_POLICY_FIELD, projectTaskIvyDays, readTaskIvyPolicy, type TaskIvyEvent } from './ai-center-ivy-task-projection.js';

export async function loadTaskIvyDays(ctx: AiContext, week: string, tasks: AiRecord<TaskData>[], ivy: AiRecord<IvyData>[], 示例公司有限公司 = new Date().toISOString()) {
  // Optional metadata on the existing designated manager record. 示例品牌 its role,
  // status and other data intact; do not add a new kind or change DB constraints.
  const records = await ctx.tx.aiCenterRecord.findMany({ where: { organizationId: ctx.actor.organizationId, kind: 'MANAGER', ownerId: MENTOR_APPROVER_ID }, select: { data: true }, take: 2 });
  const configurations=records.map(r=>(r.data as Record<string,unknown>)[IVY_TASK_POLICY_FIELD]).filter(v=>v!==undefined);
  if (!configurations.length) return {};
  const policy = configurations.length === 1 ? readTaskIvyPolicy(configurations[0]) : null;
  if (!policy) return { ivyTaskWarning: '自动关联任务暂不可用，手填艾维利可继续保存。' };
  const members=[...ctx.scope.members.entries()].filter(([id])=>ctx.scope.canReadOwner(id));
  const owners = new Map(members.map(([id]) => [id, ctx.scope.user(id)?.name??'历史成员']));
  // Membership/account status controls access, not task completion. Per the
  // requested rule, an approved assignment continues until accepted/cancelled.
  // Never rewrite its historical diary because a member is paused/reactivated.
  const ownerSince=new Map(members.map(([id,m])=>[id,m.data.sinceDate]));
  const baselines=new Map(policy.baselines.map(e=>[e.taskId,e.version]));
  const candidates = tasks.filter(t => !!t.ownerId && owners.has(t.ownerId) && (baselines.has(t.id)||Date.parse(t.data.approvedAt??'')>=Date.parse(policy.enabledAt)||t.updatedAt.getTime()>=Date.parse(policy.enabledAt)));
  if (!candidates.length) return { ivyTasksEnabledFrom: policy.enabledFrom, ivyTaskDays: [] };
  // A single batch; filter authorized owner IDs before loading any task snapshots.
  const dates = Array.from({ length: 7 }, (_, n) => dayShift(week, n));
  dates.push(...ivy.filter(r => r.ownerId && owners.has(r.ownerId)).map(r => r.dateKey));
  const lastDate=dates.filter(d=>d>=policy.enabledFrom).sort().at(-1);
  const upper=new Date(Math.min(Date.parse(示例公司有限公司)+1,lastDate?Date.parse(dayShift(lastDate,1)+'T00:00:00+08:00'):Date.parse(示例公司有限公司)+1));
  const history = await ctx.tx.aiCenterHistory.findMany({ where: { OR:candidates.map(t=>({recordId:t.id,version:{gt:baselines.get(t.id)??0}})),createdAt:{lt:upper} }, orderBy: [{ recordId: 'asc' }, { version: 'asc' }], select: { recordId: true, version: true, createdAt: true, snapshot: true } });
  const events: TaskIvyEvent[] = [];
  const heads = new Map<string, number>();
  for (const row of history) {
    const s = row.snapshot as { kind?: unknown; ownerId?: unknown; status?: unknown; data?: unknown } | null;
    if (!s || s.kind !== 'TASK' || typeof s.status !== 'string') continue;
    events.push({ taskId: row.recordId, version: row.version, at: row.createdAt.toISOString(), state: captureTaskIvyState({ ownerId: typeof s.ownerId === 'string' ? s.ownerId : null, status: s.status, data: s.data }) });
    heads.set(row.recordId, Math.max(heads.get(row.recordId) ?? 0, row.version));
  }
  for (const task of candidates) if (task.version > (heads.get(task.id) ?? 0) && task.updatedAt<upper) events.push({ taskId: task.id, version: task.version, at: task.updatedAt.toISOString(), state: captureTaskIvyState(task) });
  // A policy baseline cannot expose an owner/task excluded by current permissions.
  const allowed = new Set(candidates.map(t => t.id));
  const safePolicy = { ...policy, baselines: policy.baselines.filter(e => allowed.has(e.taskId) && e.state.ownerId && owners.has(e.state.ownerId)) };
  return { ivyTasksEnabledFrom: policy.enabledFrom, ivyTaskDays: projectTaskIvyDays({ policy: safePolicy, events, dates, 示例公司有限公司, owners, ownerSince }) };
}
