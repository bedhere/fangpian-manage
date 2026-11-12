"use client";

import { Badge, Button, Card } from '@fangpian/ui';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { errorMessage, fieldClass, jsonRequest, statusLabels, type Submission } from './types';

function time(value: string) { return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }); }
export function SubmissionDetail({ row, onEdit, onUpdate, onClose }: { row: Submission; onEdit: () => void; onUpdate: (row: Submission) => void; onClose: () => void }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  async function decide(decision: 'APPROVED' | 'REJECTED') {
    if (pending.current) return;
    if (decision === 'REJECTED' && !comment.trim()) { setError('请填写不通过原因'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const updated = await apiClient.request<Submission>(`/api/trainees/submissions/${row.id}/review`, jsonRequest('POST', { version: row.version, decision, ...(comment.trim() ? { comment: comment.trim() } : {}) }));
      onUpdate(updated); setComment('');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function submit() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { onUpdate(await apiClient.request<Submission>(`/api/trainees/submissions/${row.id}/submit`, jsonRequest('POST', { version: row.version }))); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div ref={panel} tabIndex={-1} className="mt-6 outline-none" role="region" aria-label="需求详情"><Card className="p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Badge>{statusLabels[row.status]}</Badge><h2 className="mt-3 break-words text-2xl font-black">{row.title}</h2><p className="mt-2 text-sm text-[#6d685e]">{row.traineeName} · {row.workDate} · {row.departmentName}</p><p className="mt-1 text-sm text-[#6d685e]">导师：{row.mentorName ?? '待分配'} · 版本 {row.version}</p></div><Button type="button" variant="secondary" onClick={onClose}>关闭详情</Button></div>
    <dl className="mt-6 space-y-6">{[['发现的问题', row.problem], ['解决方案', row.solution], ['预期价值', row.expectedValue ?? '未填写']].map(([label, value]) => <div key={label}><dt className="font-black">{label}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-[#575248] [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
    {row.reviewedAt ? <div className="mt-6 rounded-2xl bg-[#f7f5ee] p-4 text-sm leading-6"><p className="font-bold">最近审核：{row.reviewerName ?? '—'} · {time(row.reviewedAt)}</p><p className="whitespace-pre-wrap break-words">{row.reviewComment || '未填写审核意见'}</p>{row.status === 'SUBMITTED' || row.status === 'DRAFT' ? <p className="mt-2 text-[#6d685e]">以上为上一轮审核意见，本次状态以顶部标签为准。</p> : null}</div> : null}
    <section className="mt-6"><h3 className="font-black">审核历史</h3>{row.history.length ? <ol className="mt-3 space-y-3">{row.history.map(review => <li key={review.id} className="rounded-2xl border border-black/10 p-4 text-sm"><p className="font-bold">{statusLabels[review.decision]} · {review.reviewerName} · 版本 {review.version}</p><p className="mt-1 text-xs text-[#6d685e]">{time(review.reviewedAt)}（北京时间）</p><p className="mt-2 whitespace-pre-wrap break-words">{review.comment || '未填写审核意见'}</p></li>)}</ol> : <p className="mt-2 text-sm text-[#6d685e]">暂无审核记录</p>}</section>
    {row.canEdit ? <div className="mt-6 flex flex-wrap gap-3"><Button type="button" onClick={onEdit} disabled={busy}>修改需求</Button><Button type="button" variant="secondary" disabled={busy} loading={busy} onClick={() => void submit()}>{row.status === 'REJECTED' ? '重新提交审核' : '提交导师审核'}</Button></div> : null}
    {row.canReview ? <section className="mt-6 border-t border-black/10 pt-6"><h3 className="font-black">导师审核</h3><label className="mt-3 block text-sm font-bold">审核意见<textarea className={`${fieldClass} min-h-28`} maxLength={5000} value={comment} onChange={e => setComment(e.target.value)} disabled={busy} /></label><p className="mt-2 text-xs text-[#6d685e]">不通过时必须说明原因，通过时可选填。</p><div className="mt-4 flex flex-wrap gap-3"><Button type="button" disabled={busy} loading={busy} onClick={() => void decide('APPROVED')}>通过</Button><Button type="button" variant="secondary" disabled={busy} loading={busy} onClick={() => void decide('REJECTED')}>不通过</Button></div></section> : null}
    {error ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
  </Card></div>;
}
