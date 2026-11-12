'use client';

import { Badge, Button, Card } from '@fangpian/ui';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';
import { useSessionStore } from '@/stores/session-store';
import { shanghaiToday } from '@/features/trainees/access';
import { errorMessage, fieldClass } from '@/features/trainees/types';
import { LabelingEditor } from './labeling-editor';
import type { LabelingBoard } from './types';
import { TianjiSyncPanel } from './tianji-sync-panel';

const number = (value: number) => value.toLocaleString('zh-CN');
function shift(date: string, days: number) { return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10); }

export function LabelingLeaderboardPage() {
  const identityId = useSessionStore(state => state.identity?.id);
  return <LeaderboardSession key={identityId ?? 'loading'} identityId={identityId} />;
}
function LeaderboardSession({ identityId }: { identityId?: string }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}><Leaderboard identityId={identityId} /></QueryClientProvider>;
}

function Leaderboard({ identityId }: { identityId?: string }) {
  const [today] = useState(shanghaiToday);
  const [from, setFrom] = useState(today), [to, setTo] = useState(today);
  const [editing, setEditing] = useState(false);
  const rangeError = !from || !to ? '请选择完整日期范围' : from > to ? '开始日期不能晚于结束日期' : (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000 >= 366 ? '每次最多查看366天' : '';
  const query = useQuery({ queryKey: ['labeling-board', identityId, from, to], enabled: !!identityId && !rangeError,
    queryFn: ({ signal }) => apiClient.request<LabelingBoard>(`/api/leaderboards/labeling?${new URLSearchParams({ from, to })}`, { signal }) });
  const data = !rangeError && !query.isError ? query.data : undefined;
  const presets = [
    { label: '今日', start: today, end: today }, { label: '昨日', start: shift(today, -1), end: shift(today, -1) },
    { label: '近7天', start: shift(today, -6), end: today }, { label: '本月', start: `${today.slice(0, 7)}-01`, end: today },
  ];
  return <main className="min-h-screen min-w-0 px-4 py-7 text-[#303030] sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Badge><Trophy size={14} aria-hidden="true" className="mr-1 inline" /> 管培生排行榜</Badge><h1 className="mt-3 text-3xl font-black sm:text-4xl">打标签数量排行</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#6d685e]">每一份完成，都值得被看见。按所选日期内的完成总数排名，所有登录成员均可查看。</p></div>
      <div className="flex flex-wrap gap-3">{data?.canManage && <Button type="button" variant={editing ? 'secondary' : 'primary'} aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? '收起录入' : '录入数量'}</Button>}<Button type="button" variant="secondary" disabled={!identityId || !!rangeError || query.isFetching} onClick={() => void query.refetch()}>刷新排行榜</Button></div></div>
    <Card className="mt-7 p-5 sm:p-6"><div className="flex flex-wrap gap-2" aria-label="快捷日期">{presets.map(preset => <Button key={preset.label} type="button" variant={from === preset.start && to === preset.end ? 'primary' : 'secondary'} aria-pressed={from === preset.start && to === preset.end} onClick={() => { setFrom(preset.start); setTo(preset.end); }}>{preset.label}</Button>)}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm font-bold">开始日期<input type="date" className={fieldClass} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="min-w-0 text-sm font-bold">结束日期<input type="date" className={fieldClass} value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label></div>
      <p className="mt-3 text-xs leading-5 text-[#6d685e]">按北京时间统计，包含开始和结束当天；每次最多查看366天。相同数量并列排名，未录入者不参与排名。</p>
      {rangeError && <p role="alert" className="mt-3 text-sm text-red-700">{rangeError}</p>}
    </Card>
    {data?.canSync && identityId && <TianjiSyncPanel identityId={identityId} from={from} to={to} rangeError={rangeError} />}
    {(query.isFetching || !identityId) && !rangeError && <p role="status" className="mt-6 rounded-2xl bg-[#f7f5ee] p-5 text-sm">正在读取排行榜…</p>}
    {query.isError && !rangeError && <Card className="mt-6 p-6"><p role="alert" className="text-sm text-red-700">{errorMessage(query.error)}</p><Button type="button" variant="secondary" className="mt-4" onClick={() => void query.refetch()}>重新加载</Button></Card>}
    {data && <>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">{[['完成总数', `${number(data.summary.totalCount)} 个`], ['有数据人数', `${data.summary.participants} / ${data.summary.traineeCount} 人`], ['统计日期', data.from === data.to ? data.from : `${data.from} 至 ${data.to}`]].map(([label, value]) => <Card key={label} className="min-w-0 p-5"><dt className="text-sm text-[#6d685e]">{label}</dt><dd className="mt-2 break-words text-xl font-black tabular-nums sm:text-2xl">{value}</dd></Card>)}</dl>
      <Card className="mt-6 overflow-hidden"><div className="border-b border-black/10 p-5 sm:p-6"><h2 className="text-xl font-black">完成榜单</h2><p className="mt-2 text-sm text-[#6d685e]">按打标签数量从高到低排列；有手工录入的日期优先使用原总数，其他日期采用天玑按实际提交时间同步的数量。</p></div>
        {!data.summary.participants && <p role="status" className="mx-5 mt-5 rounded-2xl bg-[#f7f5ee] p-4 text-sm leading-6">所选日期暂无打标签记录。{data.canManage ? '可通过「录入数量」补充完成总数。' : '录入后将在这里展示排行。'}</p>}
        {!data.rows.length ? <p className="p-6 text-sm text-[#6d685e]">暂无已入驻的管培生</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{data.from}至{data.to}管培生打标签数量排行榜</caption><thead className="text-[#6d685e]"><tr><th scope="col" className="px-4 py-4 sm:px-6">排名</th><th scope="col" className="px-3 py-4">管培生</th><th scope="col" className="px-3 py-4 text-right">完成数量</th><th scope="col" className="px-4 py-4 text-right sm:px-6">录入天数</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.traineeId} className={`border-t border-black/5 ${row.isSelf ? 'bg-[#fff7d8]' : ''}`}>
          <td className="px-4 py-5 font-black tabular-nums sm:px-6"><span className={row.rank && row.rank <= 3 ? 'inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-[#fff0b5] text-[#66500a]' : ''}>{row.rank ?? '—'}</span></td>
          <th scope="row" className="max-w-48 break-words px-3 py-5 font-bold">{row.displayName}{row.isSelf && <span className="ml-1 text-xs text-[#66500a]">（我）</span>}<span className="mt-1 block text-xs font-normal text-[#6d685e]">{row.departmentName ?? '未分配部门'}</span></th>
          <td className="whitespace-nowrap px-3 py-5 text-right font-black tabular-nums">{row.reportedDays ? number(row.count) : <span className="text-xs font-normal text-[#6d685e]">未录入</span>}</td><td className="px-4 py-5 text-right tabular-nums sm:px-6">{row.reportedDays}</td>
        </tr>)}</tbody></table></div>}
      </Card>
      {editing && data.canManage && identityId && <LabelingEditor identityId={identityId} initialDate={to} />}
    </>}
  </div></main>;
}
