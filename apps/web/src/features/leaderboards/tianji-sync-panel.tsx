'use client';

import { Button, Card } from '@fangpian/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { errorMessage, jsonRequest } from '@/features/trainees/types';
import { shanghaiToday } from '@/features/trainees/access';
import type { TianjiStatus, TianjiSyncJob } from './types';

type Authorization = { consentUrl: string; state: string; callbackOrigin: string; messageSource: string };
const base = '/api/leaderboards/labeling/tianji';
export function TianjiSyncPanel({ identityId, from, to, rangeError }: { identityId: string; from: string; to: string; rangeError: string }) {
  const client = useQueryClient();
  const status = useQuery({ queryKey: ['labeling-tianji-status', identityId], queryFn: ({ signal }) => apiClient.request<TianjiStatus>(`${base}/status`, { signal }) });
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const popup = useRef<Window | null>(null);
  const authorization = useRef<Authorization | null>(null);
  const attempt = useRef(0);
  const [authorizing, setAuthorizing] = useState(false);
  const callbackBusy = useRef(false);
  const cancelAuthorization = useCallback(() => { attempt.current++; authorization.current = null; popup.current?.close(); }, []);
  const pendingId = jobId ?? status.data?.latestJob?.id;
  const job = useQuery({ queryKey: ['labeling-tianji-job', identityId, pendingId], enabled: !!pendingId,
    queryFn: ({ signal }) => apiClient.request<TianjiSyncJob>(`${base}/jobs/${pendingId}`, { signal }),
    refetchInterval: query => ['QUEUED', 'RUNNING'].includes(query.state.data?.status ?? '') ? 3000 : false });
  const result = job.data ?? status.data?.latestJob;
  const running = !!result && ['QUEUED', 'RUNNING'].includes(result.status);
  const notified = useRef('');
  const syncError = rangeError || (to > shanghaiToday() ? '抓取范围不能包含未来日期' : (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000 >= 31 ? '每次抓取最多31天，请缩小日期范围' : '');

  useEffect(() => {
    if (result?.status === 'SUCCEEDED' && notified.current !== result.id) {
      notified.current = result.id;
      void client.invalidateQueries({ queryKey: ['labeling-board', identityId] });
    }
  }, [result, client, identityId]);
  useEffect(() => {
    const receive = async (event: MessageEvent) => {
      const grant = authorization.current;
      if (!grant || event.source !== popup.current || event.origin !== grant.callbackOrigin || callbackBusy.current) return;
      const message = event.data;
      if (!message || message.source !== grant.messageSource || message.params?.state !== grant.state) return;
      const code = message.params?.code;
      if (message.params?.error) { setError('天玑授权未完成，请重试'); setAuthorizing(false); authorization.current = null; return; }
      if (typeof code !== 'string' || !code || code.length > 2048 || /[\s\x00-\x1f\x7f]/.test(code)) return;
      callbackBusy.current = true; const current = attempt.current;
      try {
        await apiClient.request(`${base}/login/callback`, jsonRequest('POST', { code, state: grant.state }));
        if (current !== attempt.current) return;
        authorization.current = null; setAuthorizing(false); setError('');
        await client.invalidateQueries({ queryKey: ['labeling-tianji-status', identityId] });
      } catch (cause) { if (current === attempt.current) { setError(errorMessage(cause)); setAuthorizing(false); authorization.current = null; } }
      finally { callbackBusy.current = false; }
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); cancelAuthorization(); };
  }, [client, identityId, cancelAuthorization]);
  useEffect(() => {
    if (!authorizing) return;
    const timeout = window.setTimeout(() => { attempt.current++; authorization.current = null; popup.current?.close(); setAuthorizing(false); setError('授权等待超时，请重新授权'); }, 180_000);
    const timer = window.setInterval(() => {
      if (popup.current?.closed && !callbackBusy.current && authorization.current) { authorization.current = null; setAuthorizing(false); setError('授权窗口已关闭，请重新发起授权'); }
    }, 1000);
    return () => { window.clearTimeout(timeout); window.clearInterval(timer); };
  }, [authorizing]);
  async function authorize() {
    const current = ++attempt.current;
    popup.current?.close(); authorization.current = null; setError('');
    popup.current = window.open('', 'fangpian-labeling-tianji-consent', 'width=560,height=720');
    if (!popup.current) { setError('授权窗口被浏览器拦截，请允许本站弹窗后重试'); return; }
    setAuthorizing(true);
    try {
      const value = await apiClient.request<Authorization>(`${base}/login/start`, jsonRequest('POST', {}));
      if (current !== attempt.current) return;
      const target = new URL(value.consentUrl);
      if (target.protocol !== 'https:' || value.callbackOrigin !== window.location.origin || value.messageSource !== 'fangpian-tianji-sso' || !/^[A-Za-z0-9_-]{43}$/.test(value.state)) throw new Error('天玑授权返回地址或状态无效');
      authorization.current = value; popup.current!.location.href = target.href;
    } catch (cause) { if (current === attempt.current) { popup.current?.close(); authorization.current = null; setAuthorizing(false); setError(errorMessage(cause)); } }
  }
  async function sync() {
    setBusy(true); setError('');
    try {
      const created = await apiClient.request<TianjiSyncJob>(`${base}/sync`, jsonRequest('POST', { from, to }));
      client.setQueryData(['labeling-tianji-job', identityId, created.id], created); setJobId(created.id);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <Card id="tianji-sync" className="mt-6 scroll-mt-24 p-5 sm:p-6"><h2 className="text-xl font-black">从天玑抓取标注数据</h2>
    <p className="mt-2 text-sm leading-6 text-[#6d685e]">AI中台主管和成员均可使用本人天玑账号授权、抓取。按实际提交时间统计，抓取任务在服务器后台执行。</p>
    <p className="mt-3 text-sm font-bold">{status.isFetching ? '正在检查本人的天玑授权…' : status.data?.authenticated ? `已授权：${status.data.name ?? '本人的天玑账号'}` : '尚未授权或授权已失效，请先连接本人的天玑账号。'}</p>
    <div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={authorizing || busy || running} onClick={() => void authorize()}>{authorizing ? '等待天玑授权…' : status.data?.authenticated ? '重新授权我的天玑账号' : '授权我的天玑账号'}</Button>
      <Button type="button" disabled={busy || authorizing || running || !status.data?.authenticated || !!syncError} onClick={() => void sync()}>{busy ? '正在创建任务…' : running ? '服务器正在抓取…' : '抓取所选日期数据'}</Button>
      <Button type="button" variant="secondary" disabled={busy || status.isFetching} onClick={() => { void status.refetch(); if (pendingId) void job.refetch(); }}>检查授权与进度</Button></div>
    <p className="mt-3 text-xs leading-5 text-[#6d685e]">每次抓取最多31天，仅同步AI中台管培生，其他部门不纳入。已有手工或批量录入的日期优先使用原总数。</p>
    {syncError && <p role="alert" className="mt-3 text-sm text-red-700">{syncError}</p>}
    {(error || status.isError || job.isError) && <p role="alert" className="mt-3 text-sm text-red-700">{error || errorMessage(status.error ?? job.error)}</p>}
    {result && <div role="status" className="mt-4 rounded-2xl bg-[#f7f5ee] p-4 text-sm leading-6"><p className="font-bold">{result.message}</p><p>{result.from} 至 {result.to} · 已读取 {result.processed.toLocaleString('zh-CN')} 条明细</p></div>}
  </Card>;
}
