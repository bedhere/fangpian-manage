'use client';
import { SlideCommit, FeedbackButton, useActionGate } from '@fangpian/ui';


import { Card } from '@fangpian/ui';
import { useState } from 'react';

export type SkillEvidenceItem = { id: string; contributionPercentage: string; grade: string; user: { displayName: string }; project: { title: string }; skill: { name: string } };

export function SkillEvidenceReview({ evidence, onReview: dispatchReview }: { evidence: SkillEvidenceItem[]; onReview: (id: string, status: 'VERIFIED' | 'REJECTED', reason: string) => unknown | Promise<unknown> }) {
  const { pending, run } = useActionGate();
  const onReview = (id: string, status: 'VERIFIED' | 'REJECTED', reason: string) => run(() => dispatchReview(id, status, reason));
  const [reasons, setReasons] = useState<Record<string, string>>({});
  if (!evidence.length) return <Card className="p-12 text-center text-[#777166]">暂无需要独立审核的技能证据</Card>;
  return <div className="grid gap-4">{evidence.map((item) => <Card key={item.id} className="p-6">
    <p className="text-xs font-black text-[#777166]">{item.user.displayName} · {item.skill.name}</p><h2 className="mt-2 text-2xl font-black">{item.project.title}</h2><p className="mt-2 text-sm text-[#777166]">项目评级 {item.grade} · 贡献比例 {item.contributionPercentage}%</p>
    <label className="mt-5 grid gap-2 text-sm font-bold">审核理由<textarea aria-label="审核理由" value={reasons[item.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-20 rounded-xl border border-black/10 p-3" /></label>
    <div className="mt-3 flex flex-wrap items-center gap-3"><SlideCommit label="滑动验证通过" doneLabel="已确认" disabled={pending || (reasons[item.id]?.trim().length ?? 0) < 2} onConfirm={() => onReview(item.id, 'VERIFIED', reasons[item.id]!.trim())} /><FeedbackButton successLabel="已拒绝" disabled={pending || (reasons[item.id]?.trim().length ?? 0) < 2} onClick={() => onReview(item.id, 'REJECTED', reasons[item.id]!.trim())} className="rounded-2xl border border-black/15 px-5 py-3 font-black disabled:opacity-40">拒绝证据</FeedbackButton></div>
  </Card>)}</div>;
}
