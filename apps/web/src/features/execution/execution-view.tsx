'use client';
import { validatedSubmit } from '../../components/feedback/validated-submit';
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';

import SlideCommit from '../../components/feedback/slide-commit';

import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@fangpian/ui';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { ProjectTimelineView } from './project-timeline-view';
import type { TimelineNode } from './timeline-types';

export type ExecutionOverview = {
  id: string; title: string; status: string; objective: string | null;
  currentUserId: string;
  timelineNodes?: TimelineNode[];
  canEditTimeline?: boolean;
  plans: Array<{ id: string; version: number; status: string; objective: string; createdAt?: string; confirmedBy: { displayName: string } | null; milestones: Array<{ id: string; title: string; description: string; dueAt: string; weight: string; expectedDeliverable: string; status: string }> }>;
  members: Array<{ id: string; role: string; user: { displayName: string; email: string } }>;
  teamInvitations: Array<{ id: string; userId: string; role: string; createdAt?: string; user: { displayName: string; email: string } }>;
  progressLogs: Array<{ id: string; progressPercent: number; summary: string; blockers: string | null; riskLevel: number; nextAction: string; createdAt: string }>;
  healthSnapshots: Array<{ id: string; status: string; score: number; timeProgress: string; workProgress: string; createdAt: string }>;
  riskActions: Array<{ id: string; reason: string; remediationPlan: string; dueAt: string; resolvedAt: string | null }>;
  availablePeople: Array<{ id: string; displayName: string; email: string }>;
};

const progressSchema = z.object({
  progressPercent: z.number().int().min(0).max(100),
  summary: z.string().min(2, '请填写进展摘要'),
  blockers: z.string().optional(), riskLevel: z.number().int().min(0).max(3),
  nextAction: z.string().min(2, '请填写下一步'),
});
type ProgressForm = z.infer<typeof progressSchema>;

export function ExecutionView({ execution, mode, onAction }: {
  execution: ExecutionOverview; mode: 'plan' | 'manage';
  onAction: (action: string, payload?: unknown) => Promise<void>;
}) {
  const current = execution.plans[0];
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProgressForm>({
    resolver: zodResolver(progressSchema), defaultValues: { progressPercent: 0, summary: '', blockers: '', riskLevel: 0, nextAction: '' },
  });
  const timeline = buildTimeline(execution);
  if (mode === 'plan') return <div className="space-y-5">
    <Header title="执行计划" subtitle="目标、里程碑和主管确认共同构成可启动的计划版本。" />
    {current ? <Card className="p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">计划 V{current.version}</h2><State value={current.status} /></div><p className="mt-4 text-lg font-bold">{current.objective}</p><div className="mt-6 space-y-3">{current.milestones.map((item) => <article key={item.id} className="grid gap-3 rounded-3xl bg-white p-5 md:grid-cols-[1fr_auto]"><div><strong>{item.title}</strong><p className="mt-1 text-sm text-black/55">{item.description} · {new Date(item.dueAt).toLocaleDateString('zh-CN')}</p><p className="mt-2 text-sm">成果：{item.expectedDeliverable}</p></div><strong className="text-2xl">{Number(item.weight)}%</strong></article>)}</div><div className="mt-6 flex flex-wrap gap-3">{current.status === 'DRAFT' ? <FeedbackButton successLabel="已提交" className="rounded-2xl bg-[#303030] px-5 py-3 font-black text-white" onClick={() => onAction('submit-plan')}>提交主管确认</FeedbackButton> : null}{current.status === 'SUBMITTED' ? <><span className="rounded-2xl bg-[#fff3b2] px-5 py-3 font-black">待主管确认</span><SlideCommit label="滑动确认计划" doneLabel="计划已确认" onConfirm={() => onAction('confirm-plan')} /></> : null}{current.status === 'CONFIRMED' ? <FeedbackButton successLabel="已提交" className="rounded-2xl bg-[#ffd85f] px-5 py-3 font-black" onClick={() => onAction('start')}>启动项目</FeedbackButton> : null}</div></Card> : null}
    {(!current || current.status === 'DRAFT' || current.status === 'CONFIRMED') ? <PlanEditor onSave={(data) => onAction('save-plan', data)} /> : null}
  </div>;

  return <div className="space-y-6"><Header title={execution.title} subtitle="项目进度看板 · 时间节点、团队、进展与风险集中呈现。" />
    <ProjectTimelineView nodes={execution.timelineNodes ?? []} progress={execution.progressLogs[0]?.progressPercent ?? 0} canEdit={execution.canEditTimeline ?? false} onAction={onAction} />
    <div className="grid gap-5 lg:grid-cols-3"><Metric label="团队成员" value={String(execution.members.length)} /><Metric label="当前健康" value={execution.healthSnapshots[0]?.status ?? '待计算'} /><Metric label="最新进度" value={`${execution.progressLogs[0]?.progressPercent ?? 0}%`} /></div>
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><Card className="p-6"><h2 className="text-xl font-black">团队</h2><div className="mt-4 space-y-3">{execution.members.map((member) => <div key={member.id} className="rounded-2xl bg-white p-4"><strong>{member.user.displayName}</strong><p className="text-sm text-black/50">{member.role} · {member.user.email}</p></div>)}{!execution.members.length ? <p className="text-sm text-black/50">暂无已接受邀请的成员</p> : null}{execution.teamInvitations.map((invitation) => <div key={invitation.id} className="rounded-2xl border border-dashed border-black/20 p-4"><strong>{invitation.user.displayName} · 邀请中</strong>{invitation.userId === execution.currentUserId ? <div className="mt-3 flex gap-2"><FeedbackButton successLabel="已处理" className="rounded-xl bg-[#ffd85f] px-3 py-2 font-black" onClick={() => onAction('respond-invitation', { invitationId: invitation.id, accept: true })}>接受邀请</FeedbackButton><FeedbackButton successLabel="已处理" className="rounded-xl border px-3 py-2 font-black" onClick={() => onAction('respond-invitation', { invitationId: invitation.id, accept: false })}>拒绝邀请</FeedbackButton></div> : null}</div>)}</div><InviteForm people={execution.availablePeople} onInvite={(data) => onAction('invite', data)} /></Card>
    <Card className="p-6"><h2 className="text-xl font-black">追加进展</h2><FeedbackForm className="mt-4 grid gap-4" onSubmit={validatedSubmit(handleSubmit, (data) => onAction('progress', data))}><label className="grid gap-1 text-sm font-bold">进度百分比<input type="number" className="rounded-2xl border border-black/10 bg-white px-4 py-3" {...register('progressPercent', { valueAsNumber: true })} /></label><label className="grid gap-1 text-sm font-bold">进展摘要<textarea className="rounded-2xl border border-black/10 bg-white px-4 py-3" {...register('summary')} /></label>{errors.summary ? <p role="alert">{errors.summary.message}</p> : null}<label className="grid gap-1 text-sm font-bold">阻塞事项<textarea className="rounded-2xl border border-black/10 bg-white px-4 py-3" {...register('blockers')} /></label><label className="grid gap-1 text-sm font-bold">风险等级<select className="rounded-2xl border border-black/10 bg-white px-4 py-3" {...register('riskLevel', { valueAsNumber: true })}><option value="0">0 · 无风险</option><option value="1">1 · 关注</option><option value="2">2 · 较高</option><option value="3">3 · 严重</option></select></label><label className="grid gap-1 text-sm font-bold">下一步<textarea className="rounded-2xl border border-black/10 bg-white px-4 py-3" {...register('nextAction')} /></label><FeedbackButton successLabel="已提交" disabled={isSubmitting} className="rounded-2xl bg-[#ffd85f] px-5 py-3 font-black">追加进展</FeedbackButton></FeedbackForm></Card></div>
    {execution.status === 'AT_RISK' ? <RiskPanel people={execution.availablePeople} hasRemediation={execution.riskActions.some((item) => !item.resolvedAt)} onAction={onAction} /> : null}
    <Card className="p-6"><h2 className="text-xl font-black">健康趋势</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{execution.healthSnapshots.slice(0, 8).map((snapshot) => <div key={snapshot.id} className={`rounded-2xl p-4 ${snapshot.status === 'RED' ? 'bg-red-100' : snapshot.status === 'YELLOW' ? 'bg-[#fff3b2]' : 'bg-green-100'}`}><strong className="text-2xl">{snapshot.status}</strong><p className="text-sm">健康分 {snapshot.score}</p><p className="text-xs text-black/50">时间 {Number(snapshot.timeProgress)}% · 工作 {Number(snapshot.workProgress)}%</p></div>)}{!execution.healthSnapshots.length ? <p className="text-sm text-black/50">提交首条进展后生成健康快照</p> : null}</div></Card>
    <Card className="p-6"><h2 className="text-xl font-black">完整时间线</h2><div className="mt-5 space-y-4">{timeline.map((event) => <article key={event.key} className="border-l-4 border-[#ffd85f] pl-4"><strong>{event.title}</strong><p className="mt-1 text-sm text-black/55">{event.detail}</p><time className="mt-1 block text-xs text-black/40">{new Date(event.at).toLocaleString('zh-CN')}</time></article>)}{!timeline.length ? <p className="text-sm text-black/50">尚无执行事件</p> : null}</div></Card>
  </div>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div><p className="text-sm font-black tracking-[.16em] text-black/45">PROJECT EXECUTION</p><h1 className="mt-1 text-4xl font-black">{title}</h1><p className="mt-2 text-black/55">{subtitle}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <Card className="p-5"><p className="text-sm font-bold text-black/45">{label}</p><strong className="mt-2 block text-3xl">{value}</strong></Card>; }
function State({ value }: { value: string }) { return <span className="rounded-full bg-[#303030] px-4 py-2 text-xs font-black text-white">{value === 'SUBMITTED' ? '待主管确认' : value === 'CONFIRMED' ? '已确认' : value === 'DRAFT' ? '草稿' : value}</span>; }

const planSchema = z.object({ objective: z.string().min(2), milestones: z.array(z.object({ title: z.string().min(2), description: z.string().min(1), dueAt: z.string().min(1), weight: z.number().positive().max(100), expectedDeliverable: z.string().min(1) })).min(1) });
type PlanForm = z.infer<typeof planSchema>;
function PlanEditor({ onSave }: { onSave: (data: PlanForm) => Promise<void> }) {
  const { register, control, handleSubmit, formState: { isSubmitting } } = useForm<PlanForm>({ resolver: zodResolver(planSchema), defaultValues: { objective: '', milestones: [{ title: '', description: '', dueAt: '', weight: 100, expectedDeliverable: '' }] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'milestones' });
  const milestones = useWatch({ control, name: 'milestones' });
  const total = milestones.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  return <Card className="p-7"><h2 className="text-2xl font-black">创建新计划版本</h2><FeedbackForm className="mt-5 space-y-5" onSubmit={validatedSubmit(handleSubmit, onSave)}><label className="grid gap-1 font-bold">项目目标<textarea className="rounded-2xl border border-black/10 bg-white p-4" {...register('objective')} /></label>{fields.map((field, index) => <fieldset key={field.id} className="grid gap-3 rounded-3xl border border-black/10 p-5 md:grid-cols-2"><legend className="px-2 font-black">里程碑 {index + 1}</legend><label>标题<input className="mt-1 w-full rounded-xl border p-3" {...register(`milestones.${index}.title`)} /></label><label>截止日期<input type="date" className="mt-1 w-full rounded-xl border p-3" {...register(`milestones.${index}.dueAt`)} /></label><label>说明<textarea className="mt-1 w-full rounded-xl border p-3" {...register(`milestones.${index}.description`)} /></label><label>预期成果<textarea className="mt-1 w-full rounded-xl border p-3" {...register(`milestones.${index}.expectedDeliverable`)} /></label><label>权重<input type="number" className="mt-1 w-full rounded-xl border p-3" {...register(`milestones.${index}.weight`, { valueAsNumber: true })} /></label>{fields.length > 1 ? <button type="button" onClick={() => remove(index)}>移除此里程碑</button> : null}</fieldset>)}<div className="flex flex-wrap items-center gap-3"><button type="button" className="rounded-2xl border px-4 py-3 font-black" onClick={() => append({ title: '', description: '', dueAt: '', weight: 0, expectedDeliverable: '' })}>添加里程碑</button><strong className={total === 100 ? 'text-green-700' : 'text-red-700'}>权重合计 {total}%</strong><FeedbackButton successLabel="已保存" disabled={isSubmitting || total !== 100} className="ml-auto rounded-2xl bg-[#303030] px-5 py-3 font-black text-white">保存计划版本</FeedbackButton></div></FeedbackForm></Card>;
}

function InviteForm({ people, onInvite }: { people: ExecutionOverview['availablePeople']; onInvite: (data: { userId: string; role: string }) => Promise<void> }) { const [userId, setUserId] = useState(''); const [role, setRole] = useState('CONTRIBUTOR'); return <div className="mt-5 border-t border-black/10 pt-5"><h3 className="font-black">邀请成员</h3><div className="mt-3 grid gap-2"><select aria-label="受邀员工" className="rounded-xl border p-3" value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">选择员工</option>{people.map((person) => <option key={person.id} value={person.id}>{person.displayName} · {person.email}</option>)}</select><select aria-label="项目角色" className="rounded-xl border p-3" value={role} onChange={(event) => setRole(event.target.value)}><option value="CONTRIBUTOR">贡献者</option><option value="SUPERVISOR">主管</option><option value="REVIEWER">审阅者</option></select><FeedbackButton successLabel="已处理" disabled={!userId} className="rounded-xl bg-[#303030] p-3 font-black text-white" onClick={() => onInvite({ userId, role })}>发送邀请</FeedbackButton></div></div>; }

function RiskPanel({ people, hasRemediation, onAction }: { people: ExecutionOverview['availablePeople']; hasRemediation: boolean; onAction: (action: string, payload?: unknown) => Promise<void> }) { const [reason, setReason] = useState(''); const [plan, setPlan] = useState(''); const [dueAt, setDueAt] = useState(''); const [newOwnerId, setNewOwnerId] = useState(''); return <Card className="p-6"><h2 className="text-xl font-black">风险处置</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><input aria-label="风险原因" placeholder="风险原因" className="rounded-xl border p-3" value={reason} onChange={(e) => setReason(e.target.value)} /><input aria-label="整改计划" placeholder="整改计划" className="rounded-xl border p-3" value={plan} onChange={(e) => setPlan(e.target.value)} /><input aria-label="整改期限" type="date" className="rounded-xl border p-3" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div><FeedbackButton successLabel="已创建" disabled={!reason || !plan || !dueAt} className="mt-3 rounded-xl bg-[#ffd85f] px-4 py-3 font-black" onClick={() => onAction('risk-action', { reason, remediationPlan: plan, dueAt })}>创建整改措施</FeedbackButton><div className="mt-5 flex flex-wrap items-center gap-3"><select aria-label="新负责人" className="min-w-0 flex-1 rounded-xl border p-3" value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)}><option value="">选择新负责人</option>{people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select><SlideCommit disabled={!hasRemediation || !newOwnerId || !reason} label="滑动更换负责人" doneLabel="负责人已更换" onConfirm={() => onAction('replace-owner', { newOwnerId, reason })} /></div></Card>; }

function buildTimeline(execution: ExecutionOverview) {
  return [
    ...execution.plans.map((item) => ({ key: `plan-${item.id}`, at: item.createdAt ?? new Date(0).toISOString(), title: `计划 V${item.version} · ${item.status}`, detail: item.objective })),
    ...execution.teamInvitations.map((item) => ({ key: `invite-${item.id}`, at: item.createdAt ?? new Date(0).toISOString(), title: `团队邀请 · ${item.user.displayName}`, detail: item.role })),
    ...execution.progressLogs.map((item) => ({ key: `progress-${item.id}`, at: item.createdAt, title: `进展 ${item.progressPercent}%`, detail: `${item.summary}；下一步：${item.nextAction}` })),
    ...execution.healthSnapshots.map((item) => ({ key: `health-${item.id}`, at: item.createdAt, title: `健康状态 ${item.status}`, detail: `健康分 ${item.score}` })),
    ...execution.riskActions.map((item) => ({ key: `risk-${item.id}`, at: item.dueAt, title: '整改措施', detail: `${item.reason}；${item.remediationPlan}` })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
}
