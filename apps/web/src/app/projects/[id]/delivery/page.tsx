"use client";
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';


import { PageState } from '@/components/states/page-state';
import { DeliveryWorkspaceView, type DeliveryWorkspace } from '@/features/delivery/delivery-workspace-view';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

export default function DeliveryPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<DeliveryWorkspace | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => apiClient.request<DeliveryWorkspace>(`/api/projects/${id}/delivery-workspace`).then(setWorkspace), [id]);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : '交付工作台加载失败')); }, [load]);
  async function action(name: string, input?: Record<string, unknown>) {
    setError(''); setMessage('');
    try {
      if (name === 'accept') await apiClient.request(`/api/projects/${id}/acceptances`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      if (name === 'ai-review') await apiClient.request(`/api/projects/${id}/delivery-ai-review/run`, { method: 'POST' });
      if (name === 'confirm-rating') await apiClient.request(`/api/projects/${id}/executive-confirmation`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      setMessage(name === 'accept' ? '验收决定已保存。' : name === 'ai-review' ? 'AI 评审已提交，可以稍后查看结果。' : '高价值评级已确认。');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); return false; }
  }
  async function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError(''); setMessage('');
    try {
      const file = form.get('file');
      let storageKey: string | undefined;
      if (file instanceof File && file.size > 0) {
        const signed = await apiClient.request<{ uploadUrl: string; storageKey: string }>(`/api/projects/${id}/delivery-upload-url`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }) });
        const upload = await fetch(signed.uploadUrl, { method: 'PUT', body: file });
        if (!upload.ok) throw new Error('文件上传失败');
        storageKey = signed.storageKey;
      }
      const delivery = await apiClient.request<{ version: number }>(`/api/projects/${id}/deliveries`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: form.get('type'), title: form.get('title'), url: form.get('url') || undefined, content: form.get('content') || undefined, storageKey, changeSummary: form.get('changeSummary') }) });
      formElement.reset(); setMessage(`版本 V${delivery.version} 已提交，历史版本保持不变。`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '提交失败');  return false; }
    finally { setBusy(false); }
  }
  if (!workspace) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '交付工作台加载失败' : '正在读取交付事实'} description={error || '正在同步版本、AI 评审、验收角色与评分规则'} /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/projects/${id}`} className="text-sm font-black">← 返回项目详情</Link><Link href="/reviews/delivery" className="rounded-2xl bg-[#ffd85f] px-4 py-2 text-sm font-black">我的交付验收队列</Link></div>{message ? <p role="status" className="mt-5 rounded-2xl bg-[#fff1b8] p-4 font-bold">{message}</p> : null}{error ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-800">{error}</p> : null}{workspace.allowedActions.includes('SUBMIT_DELIVERY') ? <FeedbackForm onSubmit={submitDelivery} className="mt-6 grid gap-3 rounded-[28px] border border-black/10 bg-white p-6 md:grid-cols-2"><div className="md:col-span-2"><h2 className="text-2xl font-black">提交新交付版本</h2><p className="mt-1 text-sm text-[#777166]">文件、链接或正文至少填写一项；每次提交都会创建新版本。</p></div><label className="grid gap-2 text-sm font-bold">成果类型<select name="type" className="h-11 rounded-xl border border-black/10 px-3"><option value="FILE">文件</option><option value="LINK">链接</option><option value="TEXT">文本</option><option value="REPOSITORY">代码仓库</option><option value="OTHER">其他</option></select></label><label className="grid gap-2 text-sm font-bold">成果标题<input name="title" required minLength={2} className="h-11 rounded-xl border border-black/10 px-3" /></label><label className="grid gap-2 text-sm font-bold">成果链接<input name="url" type="url" className="h-11 rounded-xl border border-black/10 px-3" /></label><label className="grid gap-2 text-sm font-bold">成果文件<input name="file" type="file" className="h-11 rounded-xl border border-black/10 px-3 py-2" /></label><label className="grid gap-2 text-sm font-bold md:col-span-2">文本成果<textarea name="content" className="min-h-24 rounded-xl border border-black/10 p-3" /></label><label className="grid gap-2 text-sm font-bold md:col-span-2">本版变更说明<textarea name="changeSummary" required minLength={2} className="min-h-24 rounded-xl border border-black/10 p-3" /></label><FeedbackButton successLabel="已提交" disabled={busy} className="rounded-2xl bg-[#303030] px-5 py-3 font-black text-white md:col-span-2">{busy ? '提交中…' : '提交新版本'}</FeedbackButton></FeedbackForm> : null}<div className="mt-6"><DeliveryWorkspaceView workspace={workspace} onAction={action} /></div></div></main>;
}
