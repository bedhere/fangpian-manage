"use client";

import { PageState } from '@/components/states/page-state';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ReviewQueueView, type ReviewQueueProject } from './review-queue-view';

export function ReviewQueuePage({ stage }: { stage: 'BUSINESS' | 'TECHNICAL' }) {
  const slug = stage === 'BUSINESS' ? 'business' : 'technical';
  const [projects, setProjects] = useState<ReviewQueueProject[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => apiClient.request<ReviewQueueProject[]>(`/api/reviews/${slug}`).then(setProjects), [slug]);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : '审核队列加载失败')); }, [load]);
  async function decide(id: string, input: Record<string, unknown>) {
    setError(''); setMessage('');
    try {
      await apiClient.request(`/api/projects/${id}/${slug}-review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      setMessage('审核决定已保存，并已通知项目发布人。');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '审核提交失败'); return false; }
  }
  if (!projects) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '审核队列加载失败' : '正在读取审核队列'} description={error || '正在同步待处理项目'} /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/reviews" className="text-sm font-black">← 返回审核中心</Link><h1 className="text-3xl font-black">{stage === 'BUSINESS' ? '业务审核' : '技术审核'}</h1></div>{message ? <p role="status" className="mt-5 rounded-2xl bg-[#fff1b8] p-4 font-bold">{message}</p> : null}{error ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-red-800">{error}</p> : null}<div className="mt-6"><ReviewQueueView stage={stage} projects={projects} onDecide={decide} /></div></div></main>;
}
