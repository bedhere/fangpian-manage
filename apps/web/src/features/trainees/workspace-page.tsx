"use client";

import { Badge, Button, Card } from '@fangpian/ui';
import { QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';
import { useSessionStore } from '@/stores/session-store';
import { isTraineeOnly, shanghaiToday } from './access';
import Link from 'next/link';
import { GrowthWorkspace } from './growth-workspace';
import { Enrollment, MentorAssignment } from './mentor-controls';
import { SubmissionDetail } from './submission-detail';
import { SubmissionForm } from './submission-form';
import { errorMessage, fieldClass, statusLabels, type Submission, type TraineeWorkspace } from './types';

export function TraineeWorkspacePage() {
  const [client] = useState(createQueryClient);
  const identityId = useSessionStore(state => state.identity?.id);
  return <QueryClientProvider client={client}><Workspace key={identityId ?? 'loading'} /></QueryClientProvider>;
}

function Workspace() {
  const [tab, setTab] = useState<'daily' | 'growth'>('daily');
  const [growthDirty, setGrowthDirty] = useState(false);
  return <><nav aria-label="管培生工作区" className="mx-auto flex max-w-6xl gap-3 px-4 pt-7 sm:px-6">
    <Link href="/ai-center" className="inline-flex min-h-11 items-center rounded-full bg-[#fff0b5] px-5 text-sm font-bold">AI中台 · 任务与学习</Link>
    <Button type="button" variant={tab === 'daily' ? 'primary' : 'secondary'} aria-pressed={tab === 'daily'} onClick={() => { if (!growthDirty || window.confirm('尚有未保存内容或正在处理的操作，确认离开成长计划？')) setTab('daily'); }}>每日需求</Button>
    <Button type="button" variant={tab === 'growth' ? 'primary' : 'secondary'} aria-pressed={tab === 'growth'} onClick={() => setTab('growth')}>成长计划</Button>
  </nav>{tab === 'daily' ? <DailyWorkspace /> : <main className="min-h-screen min-w-0 px-4 pb-10 text-[#303030] sm:px-6"><div className="mx-auto max-w-6xl"><GrowthWorkspace onDirtyChange={setGrowthDirty} /></div></main>}</>;
}

function DailyWorkspace() {
  const client = useQueryClient();
  const identity = useSessionStore(state => state.identity);
  const [today] = useState(shanghaiToday);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [traineeId, setTraineeId] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [form, setForm] = useState<'new' | 'edit' | null>(null);
  const [message, setMessage] = useState('');
  const rangeError = !from || !to ? '请选择完整日期范围' : from > to ? '开始日期不能晚于结束日期' : '';
  const workspaceOptions = (personId: string) => ({
    queryKey: ['trainees', identity?.id, from, to, personId, status],
    queryFn: ({ signal }: { signal: AbortSignal }) => {
      const params = new URLSearchParams({ from, to });
      if (personId) params.set('traineeId', personId);
      if (status) params.set('status', status);
      return apiClient.request<TraineeWorkspace>(`/api/trainees?${params}`, { signal });
    },
    enabled: !rangeError,
  });
  const options = workspaceOptions(traineeId);
  const query = useQuery(options);
  // Reuse the same authorized date/status query for candidates. With no person filter,
  // React Query deduplicates this observer with the board request.
  const candidates = useQuery(workspaceOptions(''));
  const data = query.data;
  function refreshData() { void client.invalidateQueries({ queryKey: ['trainees', identity?.id] }); }
  function resetDetail() { setSelected(null); setForm(null); setMessage(''); }
  function refresh() { resetDetail(); refreshData(); }
  function changed() { resetDetail(); setMessage('导师信息已保存'); refreshData(); }
  function updated(row: Submission) { setSelected(row); setMessage('需求状态已更新'); refreshData(); }
  function saved(row: Submission) {
    setSelected(row);
    // Replace only with the server write response; 示例品牌 aggregate counts authoritative
    // until the follow-up workspace read. Abort an older read before updating its cache.
    void client.cancelQueries({ queryKey: options.queryKey, exact: true });
    client.setQueryData<TraineeWorkspace>(options.queryKey, current => {
      if (!current) return current;
      const matches = row.workDate >= from && row.workDate <= to && (!traineeId || row.traineeId === traineeId) && (!status || row.status === status);
      const rest = current.submissions.filter(existing => existing.id !== row.id);
      return { ...current, submissions: matches ? [row, ...rest] : rest };
    });
    void client.invalidateQueries({ queryKey: ['trainees', identity?.id], refetchType: 'none' });
  }
  function done(row: Submission) { setSelected(row); setForm(null); setMessage(row.status === 'DRAFT' ? '草稿已保存，仅本人可见' : '需求已提交，等待导师审核'); refreshData(); }
  return <main className="min-h-screen min-w-0 px-4 py-7 text-[#303030] sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-extrabold tracking-[.16em] text-[#8a761f]">DAILY DISCOVERY</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">管培生入驻</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#6d685e]">在业务一线发现问题，把思考沉淀为方案。按人、按日查看需求与导师审核进展。</p></div><div className="flex flex-wrap gap-3">{data?.canSubmit ? <Button type="button" onClick={() => { setSelected(null); setForm('new'); setMessage(''); }}>填写需求</Button> : null}<Button type="button" variant="secondary" onClick={refresh} disabled={query.isFetching}>刷新工作区</Button></div></div>
    <Card className="mt-7 p-5"><div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block min-w-0 text-sm font-bold">开始日期<input type="date" className={fieldClass} value={from} onChange={e => { setFrom(e.target.value); resetDetail(); }} /></label>
      <label className="block min-w-0 text-sm font-bold">结束日期<input type="date" className={fieldClass} value={to} onChange={e => { setTo(e.target.value); resetDetail(); }} /></label>
      <label className="block min-w-0 text-sm font-bold">管培生<select className={fieldClass} value={traineeId} onChange={e => { setTraineeId(e.target.value); resetDetail(); }}><option value="">全部可见管培生</option>{!candidates.isError ? candidates.data?.trainees.map(person => <option key={person.userId} value={person.userId}>{person.displayName}</option>) : null}</select></label>
      <label className="block min-w-0 text-sm font-bold">审核状态<select className={fieldClass} value={status} onChange={e => { setStatus(e.target.value); resetDetail(); }}><option value="">全部状态</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div><p className="mt-3 text-xs leading-5 text-[#6d685e]">日期均为北京时间；人数、统计与需求仅包含服务端授权及当前筛选范围内的数据。他人草稿不展示。</p></Card>
    {rangeError ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{rangeError}</p> : null}
    {message ? <p role="status" className="mt-5 rounded-2xl bg-[#fff3bf] p-4 text-sm font-bold">{message}</p> : null}
    {query.isError ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">工作区加载失败：{errorMessage(query.error)}。可点击“刷新工作区”重试。</p> : null}
    {query.isFetching ? <p role="status" className="mt-6 rounded-2xl bg-[#f7f5ee] p-5 text-sm">正在同步管培生与每日需求…</p> : null}
    {data && !rangeError && form ? <SubmissionForm key={form === 'edit' ? selected?.id : 'new'} workspace={data} initial={form === 'edit' && selected ? selected : undefined} today={today} onSaved={saved} onDone={done} onPartialSave={refreshData} onCancel={() => setForm(null)} /> : null}
    {data && !rangeError && !query.isError ? <>
      {!data.selfProfile && !data.canSubmit && identity && identity.roles.length > 0 && !isTraineeOnly(identity.roles) ? <div className="mt-5"><Enrollment mentors={data.mentors} selfId={identity.id} onChanged={() => { setMessage('已入驻，可以填写需求'); refreshData(); }} /></div> : null}
      {!form && selected ? <SubmissionDetail key={selected.id} row={selected} onEdit={() => setForm('edit')} onUpdate={updated} onClose={() => setSelected(null)} /> : null}
      <section aria-label="按人查看需求" className="mt-6 space-y-5">
        {!data.trainees.length ? <Card className="p-7"><h2 className="text-xl font-black">当前筛选范围内暂无管培生</h2><p className="mt-2 text-sm leading-6 text-[#6d685e]">可调整日期、人员或审核状态。只会显示你有权查看的数据。</p></Card> : data.trainees.map(person => <Card key={person.userId} className="min-w-0 overflow-hidden p-5 sm:p-7">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[1fr_1fr]"><div className="min-w-0"><h2 className="break-words text-xl font-black">{person.displayName}{person.isSelf ? <span className="ml-2 text-sm font-normal text-[#6d685e]">（我）</span> : null}</h2><p className="mt-2 text-sm">导师：{person.mentorName ?? '待分配'}</p><p className="mt-1 text-sm text-[#6d685e]">导师直属上级：{person.mentorManagerName ?? '未设置'}</p>{!person.mentorId ? <p className="mt-3 text-sm font-bold text-[#8a6711]">待分配导师 · 可提交，待分配后审核</p> : null}</div>
          <dl aria-label={`${person.displayName}的需求统计`} className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['需求总数', person.counts.total], ['待审', person.counts.pending], ['已通过', person.counts.approved], ['未通过', person.counts.rejected]].map(([label, count]) => <div key={label} className="rounded-2xl bg-[#f7f5ee] p-3"><dt className="text-xs text-[#6d685e]">{label}</dt><dd className="mt-2 text-2xl font-black">{count}</dd></div>)}</dl></div>
          {data.canManageMentors ? <MentorAssignment key={`${person.userId}-${person.mentorId}`} person={person} mentors={data.mentors} onChanged={changed} /> : null}
          <div className="mt-5 space-y-3 border-t border-black/10 pt-5">{data.submissions.filter(row => row.traineeId === person.userId).map(row => <article key={row.id} className="min-w-0 rounded-2xl border border-black/10 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-[#6d685e]">{row.workDate} · {row.departmentName}</p><h3 className="mt-2 break-words text-lg font-black">{row.title}</h3><p className="mt-1 text-xs text-[#6d685e]">填报人：{row.traineeName}{!row.mentorId ? ' · 导师待分配' : ''}</p></div><Badge>{statusLabels[row.status]}</Badge></div><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2"><p className="line-clamp-3 break-words text-sm leading-6 [overflow-wrap:anywhere]"><strong>问题：</strong>{row.problem}</p><p className="line-clamp-3 break-words text-sm leading-6 [overflow-wrap:anywhere]"><strong>方案：</strong>{row.solution}</p></div><Button type="button" variant="secondary" className="mt-4" aria-label={`查看需求：${row.title}`} onClick={() => { setSelected(row); setForm(null); setMessage(''); }}>查看详情{row.canReview ? ' · 可审核' : ''}</Button></article>)}
          {!data.submissions.some(row => row.traineeId === person.userId) ? <p className="py-3 text-sm text-[#6d685e]">当前筛选范围内暂无可见需求</p> : null}</div>
        </Card>)}
      </section>
    </> : null}
  </div></main>;
}
