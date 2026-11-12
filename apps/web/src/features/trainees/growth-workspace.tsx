'use client';

import { Badge, Button, Card } from '@fangpian/ui';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { shanghaiToday } from './access';
import { errorMessage, fieldClass, jsonRequest } from './types';
import { growthFields, planFields, type GrowthFields, type GrowthPlan, type GrowthRating, type GrowthWorkspaceData } from './growth-types';

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
function currentWeek() {
  const today = shanghaiToday(); const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const start = shiftDate(today, -((day + 6) % 7)); return { start, end: shiftDate(start, 6) };
}

export function GrowthWorkspace({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [data, setData] = useState<GrowthWorkspaceData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [person, setPerson] = useState('');
  const [selected, setSelected] = useState<GrowthPlan | 'new' | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError('');
    void apiClient.request<GrowthWorkspaceData>('/api/trainees/growth', { signal: controller.signal }, false)
      .then(result => { if (active) setData(result); })
      .catch(reason => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [refresh]);
  function saved(plan: GrowthPlan) {
    setData(current => current ? { ...current, plans: [plan, ...current.plans.filter(row => row.id !== plan.id).map(row =>
      row.traineeId === plan.traineeId && row.periodStart === shiftDate(plan.periodStart, 7)
        ? { ...row, previousRating: plan.rating ?? null, previousPeriodStart: plan.periodStart }
        : row)] } : current);
  }
  return <section className="mt-6 space-y-5" aria-label="成长计划">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-extrabold tracking-widest text-[#8a761f]">WEEKLY GROWTH</p><h1 className="mt-2 text-3xl font-black">每周成长计划</h1><p className="mt-3 text-sm text-[#6d685e]">{data?.selfOnly ? '查看导师发布给你的完整综合评价与成长建议。' : '沉淀本周成果与评价，明确下一阶段的成长方向。'}</p></div><div className="flex flex-wrap gap-3">{data?.people.some(row => row.canEdit) && !selected ? <Button onClick={() => setSelected('new')}>新建周档案</Button> : null}<Button variant="secondary" disabled={loading || !!selected} onClick={() => setRefresh(value => value + 1)}>刷新成长计划</Button></div></div>
    {error ? <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
    {loading ? <p role="status" className="rounded-2xl bg-[#f7f5ee] p-5 text-sm">正在加载成长计划…</p> : null}
    {data && !error ? <>
      {selected ? <GrowthEditor key={selected === 'new' ? 'new' : selected.id} initial={selected === 'new' ? undefined : selected} data={data} onDirtyChange={onDirtyChange} onSaved={saved} onClose={() => setSelected(null)} /> : <>
        <Card className="p-5"><label className="block text-sm font-bold">管培生<select className={fieldClass} value={person} onChange={event => setPerson(event.target.value)}><option value="">全部可见管培生</option>{data.people.map(row => <option key={row.userId} value={row.userId}>{row.displayName}{row.isSelf ? '（我）' : ''}</option>)}</select></label></Card>
        <div className="space-y-4">{data.plans.filter(row => !person || row.traineeId === person).sort((a, b) => b.periodStart.localeCompare(a.periodStart)).map(plan => <Card key={plan.id} className="min-w-0 p-5 sm:p-7"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black">{plan.traineeName}</h2><p className="mt-2 text-sm text-[#6d685e]">{plan.periodStart} 至 {plan.periodEnd}</p></div><Badge>{plan.status === 'PUBLISHED' ? '已发布' : '草稿'}</Badge></div><p className="mt-4 font-bold">本周评级：{plan.rating ?? '待评定'}</p><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{plan.growthAdvice || '暂无成长建议'}</p>{data.selfOnly ? <div className="mt-5 space-y-4"><p className="text-sm text-[#6d685e]">上一日历周评级：{plan.previousRating ? `${plan.previousRating}（${plan.previousPeriodStart}）` : '暂无上一周评级'}</p>{growthFields.filter(([key]) => key !== 'growthAdvice').map(([key, label]) => <div key={key}><h3 className="text-sm font-black">{label}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{plan[key] || '暂无'}</p></div>)}</div> : null}{!data.selfOnly ? <Button className="mt-4" variant="secondary" onClick={() => setSelected(plan)}>{plan.canEdit ? '查看与编辑周档案' : '查看周档案'}</Button> : null}</Card>)}</div>
        {!data.plans.some(row => !person || row.traineeId === person) ? <Card className="p-7 text-sm text-[#6d685e]">暂无可见周档案</Card> : null}
      </>}
    </> : null}
  </section>;
}

function GrowthEditor({ initial, data, onSaved, onClose, onDirtyChange }: { onDirtyChange: (dirty: boolean) => void; initial?: GrowthPlan; data: GrowthWorkspaceData; onSaved: (plan: GrowthPlan) => void; onClose: () => void }) {
  const [record, setRecord] = useState(initial);
  const [fields, setFields] = useState<GrowthFields>(() => planFields(initial));
  const [person, setPerson] = useState(initial?.traineeId ?? data.people.find(row => row.canEdit)?.userId ?? '');
  const [week] = useState(currentWeek);
  const [start, setStart] = useState(initial?.periodStart ?? week.start);
  const [end, setEnd] = useState(initial?.periodEnd ?? week.end);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const canEdit = record ? record.canEdit : !!data.people.find(row => row.userId === person)?.canEdit;
  const dirty = JSON.stringify(fields) !== JSON.stringify(planFields(record)) || (!record && (start !== week.start || end !== week.end || person !== (data.people.find(row => row.canEdit)?.userId ?? '')));
  useEffect(() => { onDirtyChange(dirty || files.length > 0 || busy); return () => onDirtyChange(false); }, [dirty, files.length, busy, onDirtyChange]);
  useEffect(() => { if (!dirty && !files.length && !busy) return; const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [dirty, files.length, busy]);
  const startDay = start ? new Date(`${start}T12:00:00Z`).getUTCDay() : 1;
  const previousStart = start ? shiftDate(start, -7 - ((startDay + 6) % 7)) : '';
  const previous = data.plans.find(row => row.traineeId === person && row.periodStart === previousStart);
  const previousRating = record ? record.previousRating : previous?.rating;
  const previousPeriod = record ? record.previousPeriodStart : previous?.periodStart;
  function close() { if ((!dirty && !files.length) || window.confirm('尚有未保存内容，确认离开并放弃这些修改？')) onClose(); }
  async function save(publish: boolean): Promise<GrowthPlan | undefined> {
    if (!person || !start || !end || start > end) throw new Error('请选择管培生和有效的完整周期');
    const row = await apiClient.request<GrowthPlan>(record ? `/api/trainees/growth/${record.id}` : '/api/trainees/growth', jsonRequest(record ? 'PATCH' : 'POST', record ? { ...fields, version: record.version, publish } : { ...fields, traineeId: person, periodStart: start, periodEnd: end, publish }), false);
    if (active.current) { setRecord(row); setFields(planFields(row)); onSaved(row); }
    return row;
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (reason) { if (active.current) setError(errorMessage(reason)); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  async function upload() {
    if (!files.length) throw new Error('请先选择来源文件');
    if (files.length > 5 || files.some(file => !/\.(txt|md|docx|pdf)$/i.test(file.name) || file.size > 8 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) throw new Error('请选择1至5个 TXT、MD、DOCX、PDF 文件；每个不超过8MiB，总计不超过20MiB');
    if (!window.confirm('上传将先保存当前文字为草稿，并调用AI将材料分析结果写入这份草稿，可能调整已有字段。确认继续？发布前请逐项核对。')) return;
    const draft = await save(false);
    if (!draft || !active.current) return;
    const form = new FormData(); files.forEach(file => form.append('files', file)); form.append('version', String(draft.version)); form.append('idempotencyKey', crypto.randomUUID());
    const result = await apiClient.request<GrowthPlan>(`/api/trainees/growth/${draft.id}/sources`, { method: 'POST', body: form }, false);
    if (active.current) { setRecord(result); setFields(planFields(result)); onSaved(result); setFiles([]); if (fileInput.current) fileInput.current.value = ''; setMessage('来源材料已处理并存入草稿，请核对所有字段后再发布。'); }
  }
  async function download(sourceId: string, filename: string) {
    if (!record) return;
    const response = await apiClient.requestRaw(`/api/trainees/growth/${record.id}/sources/${sourceId}`, {}, false);
    if (!response.ok) throw new Error(`下载失败（${response.status}），请重新登录或核对权限`);
    const blob = await response.blob(); if (!active.current) return;
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Card className="min-w-0 p-5 sm:p-7"><form onSubmit={event => { event.preventDefault(); void run(async () => { await save(false); setMessage('草稿已保存'); }); }}>
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-black">{record ? '周档案' : '新建周档案'}</h2><Button type="button" variant="secondary" disabled={busy} onClick={close}>返回列表</Button></div>
    <fieldset disabled={busy || !canEdit} className="mt-5 min-w-0 space-y-5">
      <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-bold">管培生<select className={fieldClass} disabled={!!record} value={person} onChange={event => setPerson(event.target.value)}>{data.people.filter(row => row.canEdit || row.userId === person).map(row => <option key={row.userId} value={row.userId}>{row.displayName}</option>)}</select></label><label className="text-sm font-bold">周期开始<input className={fieldClass} type="date" required disabled={!!record} value={start} onChange={event => setStart(event.target.value)} /></label><label className="text-sm font-bold">周期结束<input className={fieldClass} type="date" required disabled={!!record} value={end} min={start} onChange={event => setEnd(event.target.value)} /></label></div>
      <div className="rounded-2xl bg-[#fff3bf] p-4 text-sm">上一日历周评级：{previousRating ? `${previousRating}（${previousPeriod}）` : '暂无上一周评级'}{record ? <span className="ml-3">版本 {record.version ?? '—'} · {record.status === 'PUBLISHED' ? '已发布' : '草稿'}</span> : null}</div>
      <label className="block text-sm font-bold">本周评级<select className={fieldClass} value={fields.rating ?? ''} onChange={event => setFields(current => ({ ...current, rating: (event.target.value || null) as GrowthRating | null }))}><option value="">待评定</option>{['S', 'A+', 'A', 'A-', 'B', 'C'].map(rating => <option key={rating}>{rating}</option>)}</select></label>
      {record?.quantitativeStale ? <p className="text-sm text-[#8a6711]">本周评分口径已更新，旧汇总仅保留为来源记录。请重新生成事实草稿后核对新口径建议。</p> : record?.quantitativeSuggestion ? <p className="text-sm text-[#8a6711]">量化建议：{record.quantitativeSuggestion} · 总分 {record.quantitativeTotal?.toFixed(2) ?? '待核定'}。最终由导师确认。</p> : null}
      <label className="block text-sm font-bold">评级调整说明（偏离量化建议时必填）<textarea className={fieldClass} maxLength={2000} rows={2} value={fields.overrideReason ?? ''} onChange={event => setFields(current => ({ ...current, overrideReason:event.target.value }))} /></label>
      {growthFields.map(([key, label]) => <label key={key} className="block text-sm font-bold">{label}<textarea className={fieldClass} rows={key === 'departmentText' ? 2 : 4} value={fields[key]} onChange={event => setFields(current => ({ ...current, [key]: event.target.value }))} /></label>)}
    </fieldset>
    {record?.status === 'PUBLISHED' && canEdit ? <p className="mt-4 text-sm text-[#8a6711]">保存草稿后将撤回本次发布；管培生仅查看已发布的完整综合评价。</p> : null}
    {canEdit ? <div className="mt-5 flex flex-wrap gap-3"><Button type="submit" disabled={busy}>保存草稿</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => { if (window.confirm('确认发布当前完整综合评价给管培生？')) void run(async () => { await save(true); setMessage('成长计划已发布'); }); }}>发布综合评价</Button></div> : null}
  </form>
  {canEdit ? <section className="mt-7 border-t border-black/10 pt-5"><h3 className="font-black">来源文件与AI分析</h3><p className="mt-2 text-xs leading-6 text-[#6d685e]">TXT / Markdown / DOCX / 有文本层的PDF；最多5份，单份8MiB，总计20MiB。上传前保存当前文字为草稿，分析后请核对姓名、周期、评级及所有正文。</p><input ref={fileInput} className={`${fieldClass} block`} aria-label="选择成长计划来源文件" type="file" accept=".txt,.md,.docx,.pdf" multiple disabled={busy} onChange={event => setFiles(Array.from(event.target.files ?? []))} /><Button className="mt-3" type="button" variant="secondary" disabled={busy || !files.length} onClick={() => void run(upload)}>保存草稿并上传分析</Button></section> : null}
  {record?.sources?.length ? <section className="mt-6"><h3 className="font-black">已保存来源</h3><ul className="mt-3 space-y-3">{record.sources.map(source => <li key={source.id} className="break-words rounded-2xl bg-[#f7f5ee] p-4 text-sm"><span>{source.filename} · {({ READY: '已接收', ANALYZED: '已分析', FAILED: '分析失败' })[source.status]}</span>{source.error ? <p className="mt-2 text-red-800">{source.error}</p> : null}<Button className="ml-2" type="button" variant="secondary" disabled={busy} onClick={() => void run(() => download(source.id, source.filename))}>下载</Button></li>)}</ul></section> : null}
  {record?.history?.length ? <details className="mt-6 text-sm"><summary className="cursor-pointer font-bold">修改历史（{record.history.length}）</summary><ul className="mt-3 space-y-2">{record.history.map(item => <li key={item.version}>版本 {item.version} · {item.editorName} · {item.createdAt}</li>)}</ul></details> : null}
  {busy ? <p role="status" className="mt-5 text-sm">正在保存或处理，请稍候…</p> : null}{error ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}{message ? <p role="status" className="mt-5 rounded-2xl bg-[#fff3bf] p-4 text-sm">{message}</p> : null}
  </Card>;
}
