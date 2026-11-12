'use client';
import { FeedbackButton } from '@fangpian/ui';

import { useActionGate } from '../../components/feedback/use-action-gate';
import SlideCommit from '../../components/feedback/slide-commit';
import { SlideSubmit } from '../../components/feedback/slide-submit';
import { Card } from '@fangpian/ui';
import type { FormEvent } from 'react';

export type AcceptanceRole = 'PUBLISHER_BUSINESS' | 'DEPARTMENT_HEAD_BUSINESS' | 'OWNER_MANAGER_TECHNICAL';
export type DeliveryWorkspace = {
  project: { id: string; title: string; status: string };
  deliveries: Array<{ id: string; version: number; title: string; type: string; changeSummary: string; createdAt: string; url?: string | null; content?: string | null }>;
  aiAssessments: Array<{ id: string; status: string; output?: { technicalQuality: number; businessFit: number; completeness: number; risk: number; suggestedGrade: string; reasoningSummary: string; issues: string[]; recommendations: string[] } }>;
  acceptances: Array<{ id: string; deliveryId: string; role: AcceptanceRole; decision: string; score: number; comment: string; reviewer?: { displayName: string } }>;
  rating: null | { finalScore: number; grade: string; breakdown: { scores: Record<string, number>; weights: Record<string, number>; thresholds: Record<string, number> }; requiresExecutiveConfirmation: boolean; confirmedAt?: string | null };
  assignedRoles: AcceptanceRole[];
  allowedActions: string[];
  scoring: { weights: Record<string, number>; thresholds: Record<string, number> };
};

const roleLabels: Record<AcceptanceRole, string> = {
  PUBLISHER_BUSINESS: '项目发布人业务验收',
  DEPARTMENT_HEAD_BUSINESS: '发布部门负责人业务验收',
  OWNER_MANAGER_TECHNICAL: '项目负责人直属主管技术验收',
};

export function DeliveryWorkspaceView({ workspace, onAction: dispatch }: { workspace: DeliveryWorkspace; onAction: (action: string, input?: Record<string, unknown>) => void | Promise<unknown> }) {
  const { pending, run } = useActionGate();
  const onAction = (name: string, input?: Record<string, unknown>) => run(() => dispatch(name, input));
  const latest = workspace.deliveries[0];
  const latestAi = workspace.aiAssessments[0];
  const completed = new Set(workspace.acceptances.filter((item) => item.deliveryId === latest?.id).map((item) => item.role));
  const pendingRoles = workspace.assignedRoles.filter((role) => !completed.has(role));
  function accept(event: FormEvent<HTMLFormElement>, role: AcceptanceRole, decision: 'APPROVED' | 'REVISION_REQUIRED') {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    return onAction('accept', { role, decision, score: Number(form.get('score')), comment: String(form.get('comment') ?? '') });
  }
  return <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
    <section className="space-y-5">
      <Card className="p-7"><p className="text-xs font-black tracking-[.2em] text-[#8a7b50]">DELIVERY CONTROL</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h1 className="text-4xl font-black">{workspace.project.title}</h1><span className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs font-black">{workspace.project.status}</span></div></Card>
      <Card className="p-7"><h2 className="text-2xl font-black">不可覆盖的交付版本</h2>{workspace.deliveries.length ? <div className="mt-5 space-y-3">{workspace.deliveries.map((delivery) => <article key={delivery.id} className="rounded-2xl bg-white p-4"><div className="flex justify-between gap-3"><strong>V{delivery.version} · {delivery.title}</strong><span className="text-xs font-black">{delivery.type}</span></div><p className="mt-2 text-sm text-[#777166]">{delivery.changeSummary}</p></article>)}</div> : <p className="mt-4 text-sm text-[#777166]">尚未提交交付版本。</p>}</Card>
      <Card className="p-7"><h2 className="text-2xl font-black">AI 评审说明</h2>{latestAi?.output ? <div className="mt-5"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="技术质量" value={latestAi.output.technicalQuality} /><Metric label="业务匹配" value={latestAi.output.businessFit} /><Metric label="完整度" value={latestAi.output.completeness} /><Metric label="风险" value={latestAi.output.risk} /></div><p className="mt-4 font-bold">{latestAi.output.reasoningSummary}</p>{latestAi.output.recommendations.length ? <ul className="mt-3 list-disc pl-5 text-sm text-[#777166]">{latestAi.output.recommendations.map((item) => <li key={item}>{item}</li>)}</ul> : null}</div> : <p className="mt-4 text-sm text-[#777166]">{latestAi?.status === 'FAILED' ? '自动评审失败，可重试或使用人工兜底。' : '等待 AI 评审。'}</p>}{workspace.allowedActions.includes('RUN_AI_REVIEW') ? <FeedbackButton successLabel="已提交评审" disabled={pending} onClick={() => onAction('ai-review')} className="mt-5 rounded-2xl bg-[#303030] px-5 py-3 font-black text-white">运行 AI 评审</FeedbackButton> : null}</Card>
    </section>
    <aside className="space-y-5">
      {pendingRoles.map((role) => <Card key={role} className="p-6"><h2 className="text-xl font-black">{roleLabels[role]}</h2><p className="mt-2 text-sm text-[#777166]">评分 0–100；退回将生成新的返修版本，当前记录永久保留。</p><form className="mt-5 grid gap-3" onSubmit={(event) => event.preventDefault()}><label className="grid gap-2 text-sm font-bold">验收评分<input aria-label="验收评分" name="score" type="number" min="0" max="100" required className="h-11 rounded-xl border border-black/10 px-3" /></label><label className="grid gap-2 text-sm font-bold">验收意见<textarea aria-label="验收意见" name="comment" required minLength={2} className="min-h-24 rounded-xl border border-black/10 p-3" /></label><div className="flex flex-wrap items-center gap-3"><SlideSubmit disabled={pending} label="滑动通过验收" doneLabel="验收已通过" onConfirm={(form) => accept({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, role, 'APPROVED')} /><FeedbackButton successLabel="已提交" type="button" disabled={pending} onClick={(event) => event.currentTarget.form && accept({ preventDefault() {}, currentTarget: event.currentTarget.form } as FormEvent<HTMLFormElement>, role, 'REVISION_REQUIRED')} className="rounded-2xl bg-[#ffd85f] px-4 py-3 font-black">退回返修</FeedbackButton></div></form></Card>)}
      <Card className="p-6"><h2 className="text-xl font-black">最终评分规则</h2><div className="mt-4 space-y-2 text-sm">{Object.entries(workspace.scoring.weights).map(([key, value]) => <div key={key} className="flex justify-between"><span>{key}</span><strong>{value}%</strong></div>)}</div>{workspace.rating ? <div className="mt-6 rounded-2xl bg-[#ffd85f] p-5"><p className="text-sm font-black">最终等级</p><p className="mt-1 text-4xl font-black">{workspace.rating.grade} · {workspace.rating.finalScore}</p></div> : <p className="mt-5 text-sm text-[#777166]">三方验收完成后，系统按以上配置自动计算。</p>}{workspace.allowedActions.includes('CONFIRM_RATING') ? <SlideCommit disabled={pending} className="mt-5" label="滑动确认高价值评级" doneLabel="评级已确认" onConfirm={() => onAction('confirm-rating', { note: '已核验最终评分与交付事实' })} /> : null}</Card>
    </aside>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-[#fff8df] p-3"><p className="text-xs text-[#777166]">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></div>; }
