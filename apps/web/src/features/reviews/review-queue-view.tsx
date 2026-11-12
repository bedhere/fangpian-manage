'use client';
import { FeedbackButton } from '@fangpian/ui';

import { useActionGate } from '../../components/feedback/use-action-gate';
import { SlideSubmit } from '../../components/feedback/slide-submit';
import { Card } from '@fangpian/ui';
import type { FormEvent } from 'react';

export type ReviewQueueProject = {
  id: string; title: string; version: number; status: string; businessProblem: string; expectedResult: string; acceptanceCriteria: string;
  publisher: { displayName: string }; publisherDepartment: { name: string };
  approvals: unknown[]; aiAssessments: unknown[];
};

export function ReviewQueueView({ stage, projects, onDecide }: {
  stage: 'BUSINESS' | 'TECHNICAL';
  projects: ReviewQueueProject[];
  onDecide: (id: string, input: Record<string, unknown>) => void | Promise<unknown>;
}) {
  const { pending, run } = useActionGate();
  if (!projects.length) return <Card className="p-10 text-center"><h2 className="text-xl font-black">当前没有待审核项目</h2><p className="mt-2 text-sm text-[#777166]">新的审核任务会自动进入这里。</p></Card>;
  function decide(form: HTMLFormElement, project: ReviewQueueProject, decision: 'APPROVED' | 'REVISION_REQUIRED' | 'REJECTED') {
    const values = new FormData(form);
    const input: Record<string, unknown> = { decision, expectedVersion: project.version, comment: String(values.get('comment') ?? '') };
    if (stage === 'BUSINESS') input.businessValueScore = Number(values.get('businessValueScore'));
    else {
      input.technicalComplexityScore = Number(values.get('technicalComplexityScore'));
      input.approvedHours = Number(values.get('approvedHours'));
      input.projectLevel = String(values.get('projectLevel'));
      input.requiredCapabilityLevel = Number(values.get('requiredCapabilityLevel'));
    }
    return run(() => onDecide(project.id, input));
  }
  return <div className="space-y-5">{projects.map((project) => <Card key={project.id} className="p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black text-[#8a7b50]">{project.publisherDepartment.name} · {project.publisher.displayName}</p><h2 className="mt-2 text-2xl font-black">{project.title}</h2></div><span className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs font-black">V{project.version}</span></div><div className="mt-5 grid gap-4 text-sm md:grid-cols-3"><div><strong>业务问题</strong><p className="mt-2 leading-6 text-[#777166]">{project.businessProblem}</p></div><div><strong>期望成果</strong><p className="mt-2 leading-6 text-[#777166]">{project.expectedResult}</p></div><div><strong>验收标准</strong><p className="mt-2 leading-6 text-[#777166]">{project.acceptanceCriteria}</p></div></div><form className="mt-6 grid gap-3" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); }}>{stage === 'BUSINESS' ? <label className="grid gap-2 text-sm font-bold">业务价值分<input aria-label="业务价值分" name="businessValueScore" type="number" min="0" max="100" required className="h-11 rounded-xl border border-black/10 px-3" /></label> : <div className="grid gap-3 md:grid-cols-4"><label className="grid gap-2 text-sm font-bold">技术复杂度<input aria-label="技术复杂度" name="technicalComplexityScore" type="number" min="0" max="100" required className="h-11 rounded-xl border border-black/10 px-3" /></label><label className="grid gap-2 text-sm font-bold">批准工时<input aria-label="批准工时" name="approvedHours" type="number" min="0.25" step="0.25" required className="h-11 rounded-xl border border-black/10 px-3" /></label><label className="grid gap-2 text-sm font-bold">项目等级<select name="projectLevel" required defaultValue="" className="h-11 rounded-xl border border-black/10 px-3"><option value="" disabled>请选择</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option><option>P4</option></select></label><label className="grid gap-2 text-sm font-bold">能力等级<select name="requiredCapabilityLevel" required defaultValue="" className="h-11 rounded-xl border border-black/10 px-3"><option value="" disabled>请选择</option><option value="0">L0</option><option value="1">L1</option><option value="2">L2</option><option value="3">L3</option><option value="4">L4</option></select></label></div>}<label className="grid gap-2 text-sm font-bold">审核意见<textarea name="comment" className="min-h-24 rounded-xl border border-black/10 p-3" /></label><div className="flex flex-wrap items-center gap-3"><SlideSubmit disabled={pending} label={stage === 'BUSINESS' ? '滑动通过业务审核' : '滑动通过技术审核'} doneLabel="审核已通过" onConfirm={(form) => decide(form, project, 'APPROVED')} /><FeedbackButton successLabel="已提交" type="button" disabled={pending} onClick={(event) => event.currentTarget.form && decide(event.currentTarget.form, project, 'REVISION_REQUIRED')} className="rounded-2xl bg-[#ffd85f] px-5 py-3 font-black">退回修改</FeedbackButton><FeedbackButton successLabel="已提交" type="button" disabled={pending} onClick={(event) => event.currentTarget.form && decide(event.currentTarget.form, project, 'REJECTED')} className="rounded-2xl border border-black/15 px-5 py-3 font-black">驳回</FeedbackButton></div></form></Card>)}</div>;
}
