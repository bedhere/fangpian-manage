import { Badge, Button, Card } from '@fangpian/ui';
import { useState, type ReactNode } from 'react';
import { dateText, field, type Grade, type Review } from './types';
export function Section({ title, description, children }: {
    title: string;
    description?: string;
    children: ReactNode;
}) { return <section className="space-y-5"><div><h2 className="text-2xl font-black">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-[#756d59]">{description}</p>}</div>{children}</section>; }
export function Empty({ children = '暂无记录' }: {
    children?: ReactNode;
}) { return <Card className="p-7 text-sm text-[#756d59]">{children}</Card>; }
export function ErrorBox({ message }: {
    message: string;
}) { return message ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{message}</p> : null; }
export function GradeSelect({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (v: Grade) => void;
}) { return <label className="block text-sm font-bold">{label}<select required className={field} value={value} onChange={e => onChange(e.target.value as Grade)}><option value="" disabled>请选择等级</option>{['S', 'A', 'B', 'C'].map(g => <option key={g}>{g}</option>)}</select></label>; }
export function ReviewInfo({ review }: {
    review?: Review;
}) { return review ? <div className="rounded-xl bg-[#f7f4e9] p-4 text-sm leading-6"><Badge>质量 {review.grade}</Badge><p className="mt-2">评分人：{review.reviewerName} · {review.reviewerRole} · {dateText(review.at)}</p><p className="whitespace-pre-wrap break-words">{review.comment || '无附加评语'}</p>{review.reason && <p>调整依据：{review.reason}</p>}</div> : null; }
export function ReviewForm({ busy, existing, onReview, kind = '质量', allowReturn = true, late=false,initialRatio=1 }: {
    busy: boolean;
    existing?: Review;
    kind?: string;
    allowReturn?: boolean;
    late?:boolean;
    initialRatio?:number;
    onReview: (v: {
        decision: 'APPROVE' | 'RETURN';
        grade: Grade;
        comment: string;
        reason: string;
        completionRatio: number;
        reconcileLate?:boolean;
    }) => Promise<boolean>;
}) { const [grade, setGrade] = useState<Grade>(existing?.grade ?? 'A'); const [comment, setComment] = useState(''); const [reason, setReason] = useState(''); const [ratio, setRatio] = useState(initialRatio);const [lateDecision,setLateDecision]=useState<'pending'|'true'|'false'>('pending'); return <form className="space-y-4 rounded-2xl border border-[#e4ddc8] p-4" onSubmit={e => { e.preventDefault(); void onReview({ decision: 'APPROVE', grade, comment, reason, completionRatio: ratio,...(late&&lateDecision!=='pending'?{reconcileLate:lateDecision==='true'}:{}) }); }}><p className="font-black">{existing ? '复核 / 调整' : '审核'}{kind}</p><GradeSelect label={`${kind}评分（与难度独立）`} value={grade} onChange={setGrade}/>{kind === '交付质量' && <label className="block text-sm font-bold">已验收完成比例（0—1，独立于自报进度）<input type="number" min="0" max="1" step="0.01" required className={field} value={ratio} onChange={e => setRatio(Number(e.target.value))}/></label>}<label className="block text-sm font-bold">评价依据 / 退回原因<textarea className={field} value={comment} onChange={e => setComment(e.target.value)}/></label>{late&&<div className="rounded-xl bg-[#fff5cc] p-4"><p className="text-sm leading-6">此笔记为跨周补交。质量评分不会自动抹去原周缺交；如需计入原周，应明确复核时间与原因。</p><label className="mt-3 block text-sm font-bold">补交归属裁定<select className={field} value={lateDecision} onChange={e=>setLateDecision(e.target.value as typeof lateDecision)}><option value="pending">尚未裁定（保留待核定）</option><option value="true">计入原周，修订原周计分事实</option><option value="false">不调整原周缺交，补交只作整改展示</option></select></label></div>}{(existing||(late&&lateDecision!=='pending')) && <label className="block text-sm font-bold">改分 / 补交计分复核理由（必填）<textarea required minLength={2} className={field} value={reason} onChange={e => setReason(e.target.value)}/></label>}<div className="flex flex-wrap gap-3"><Button disabled={busy}>确认评分</Button>{allowReturn && <Button type="button" variant="secondary" disabled={busy || !comment.trim()} onClick={() => void onReview({ decision: 'RETURN', grade, comment, reason, completionRatio: ratio })}>退回修改</Button>}</div></form>; }
