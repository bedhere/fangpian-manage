"use client";

import { PageState } from '@/components/states/page-state';
import { ContributionWorkspaceView, type ContributionWorkspace } from '@/features/settlement/contribution-workspace-view';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function ContributionsPage() {
  const { id } = useParams<{ id: string }>(); const [workspace, setWorkspace] = useState<ContributionWorkspace | null>(null); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(() => apiClient.request<ContributionWorkspace>(`/api/projects/${id}/contribution-workspace`).then(setWorkspace), [id]);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : '贡献工作台加载失败')); }, [load]);
  async function action(name: string, input?: Record<string, unknown>) { setError(''); try { if (name === 'propose') await apiClient.request(`/api/projects/${id}/contributions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); if (name === 'respond') { const { contributionId, ...body } = input ?? {}; await apiClient.request(`/api/projects/${id}/contributions/${contributionId}/respond`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); } if (name === 'arbitrate') await apiClient.request(`/api/projects/${id}/contribution-arbitration`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }); setMessage('贡献分配事实已保存。'); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); return false; } }
  if (!workspace) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '贡献工作台加载失败' : '正在读取贡献事实'} description={error || '正在同步方案版本、确认、争议和仲裁'} /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-7xl"><Link href={`/projects/${id}`} className="text-sm font-black">← 返回项目详情</Link>{message ? <p role="status" className="mt-5 rounded-2xl bg-[#fff1b8] p-4 font-bold">{message}</p> : null}{error ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-red-800">{error}</p> : null}<div className="mt-6"><ContributionWorkspaceView workspace={workspace} onAction={action} /></div></div></main>;
}
