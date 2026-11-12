'use client';

import { Button, Card } from '@fangpian/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { apiClient } from '@/lib/api';
import { shanghaiToday } from '@/features/trainees/access';
import { errorMessage, fieldClass, jsonRequest } from '@/features/trainees/types';
import type { LabelingDaily, LabelingEntry } from './types';

export function LabelingEditor({ identityId, initialDate }: { identityId: string; initialDate: string }) {
  const client = useQueryClient();
  const [date, setDate] = useState(initialDate > shanghaiToday() ? shanghaiToday() : initialDate);
  const [person, setPerson] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const daily = useQuery({ queryKey: ['labeling-daily', identityId, date], enabled: !!date,
    queryFn: ({ signal }) => apiClient.request<LabelingDaily>(`/api/leaderboards/labeling/daily?${new URLSearchParams({ date })}`, { signal }) });
  const selectedId = person || daily.data?.rows[0]?.traineeId || '';
  const selected = daily.data?.rows.find(row => row.traineeId === selectedId);
  async function save(count: number, note: string, version: number) {
    setBusy(true); setMessage('');
    try {
      await apiClient.request('/api/leaderboards/labeling/entries', jsonRequest('PUT', { traineeId: selectedId, workDate: date, count, note, version }));
      await Promise.all([
        client.invalidateQueries({ queryKey: ['labeling-daily', identityId] }),
        client.invalidateQueries({ queryKey: ['labeling-board', identityId] }),
      ]);
      setMessage('完成数量已保存，排行榜已更新');
    } finally { setBusy(false); }
  }
  return <Card className="mt-6 p-5 sm:p-7"><h2 className="text-xl font-black">录入打标签数量</h2><p className="mt-2 text-sm leading-6 text-[#6d685e]">填写这一天的完成总数。修改已有记录时，以新总数替换原数量；填 0 可更正误录。</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="min-w-0 text-sm font-bold">录入日期<input className={fieldClass} type="date" value={date} max={shanghaiToday()} disabled={busy} onChange={e => { setDate(e.target.value); setMessage(''); }} /></label>
      <label className="min-w-0 text-sm font-bold">管培生<select className={fieldClass} value={selectedId} disabled={busy || daily.isFetching || daily.isError} onChange={e => { setPerson(e.target.value); setMessage(''); }}>{daily.data?.rows.map(row => <option key={row.traineeId} value={row.traineeId}>{row.displayName}</option>)}</select></label>
    </div>
    {!date && <p role="alert" className="mt-4 text-sm text-red-700">请选择录入日期</p>}
    {daily.isFetching && <p role="status" className="mt-4 text-sm">正在读取当日数量…</p>}
    {daily.isError && <div role="alert" className="mt-4 text-sm text-red-700">{errorMessage(daily.error)}<Button type="button" variant="secondary" className="ml-3" onClick={() => void daily.refetch()}>重新加载当日数据</Button></div>}
    {!daily.isError && !daily.isFetching && selected && <EntryForm key={`${date}/${selectedId}/${selected.entry?.version ?? 0}`} entry={selected.entry} disabled={busy} save={save} reload={() => void daily.refetch()} />}
    {!daily.isFetching && daily.data && !daily.data.rows.length && <p className="mt-4 text-sm">暂无可录入的管培生，请先完成管培生入驻。</p>}
    {message && <p role="status" className="mt-4 text-sm font-bold text-[#326049]">{message}</p>}
  </Card>;
}

function EntryForm({ entry, disabled, save, reload }: { entry: LabelingEntry | null; disabled: boolean; save: (count: number, note: string, version: number) => Promise<void>; reload: () => void }) {
  const [count, setCount] = useState(entry ? String(entry.count) : '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const value = Number(count);
    if (!count.trim() || !Number.isInteger(value) || value < 0 || value > 1_000_000_000) { setError('请填写0到1000000000之间的整数'); return; }
    try { await save(value, note, entry?.version ?? 0); }
    catch (cause) { setError(errorMessage(cause)); }
  }
  return <form aria-label="打标签数量录入" onSubmit={submit} className="mt-5 space-y-4">
    <p className="text-sm text-[#6d685e]">{entry ? `已记录 ${entry.count.toLocaleString('zh-CN')} 个 · ${entry.source === 'API' ? '接口导入' : '手动录入'}` : '这一天尚未录入数量'}</p>
    <label className="block text-sm font-bold">当日完成总数<input className={fieldClass} type="number" inputMode="numeric" required min={0} max={1_000_000_000} step={1} value={count} disabled={disabled} onChange={e => setCount(e.target.value)} /></label>
    <label className="block text-sm font-bold">备注（选填）<textarea className={fieldClass} rows={2} maxLength={1000} value={note} disabled={disabled} onChange={e => setNote(e.target.value)} /></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={disabled}>{disabled ? '正在保存…' : '保存当日总数'}</Button><Button type="button" variant="secondary" disabled={disabled} onClick={reload}>重新加载当日数据</Button></div>
  </form>;
}
