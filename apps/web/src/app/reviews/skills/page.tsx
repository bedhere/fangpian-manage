'use client';

import { PageState } from '@/components/states/page-state';
import { SkillEvidenceReview, type SkillEvidenceItem } from '@/features/feedback/skill-evidence-review';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function SkillEvidenceReviewPage() {
  const [items, setItems] = useState<SkillEvidenceItem[] | null>(null); const [error, setError] = useState('');
  const load = useCallback(() => apiClient.request<SkillEvidenceItem[]>('/api/feedback/skill-evidence/pending').then(setItems), []);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : '技能证据加载失败')); }, [load]);
  async function review(id: string, status: 'VERIFIED' | 'REJECTED', reason: string) { await apiClient.request(`/api/feedback/skill-evidence/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, reason }) }); await load(); }
  if (!items) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '技能证据加载失败' : '正在读取技能证据'} description={error || '仅展示来自真实项目且不能由本人审核的记录'} /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-5xl"><Link href="/reviews" className="text-sm font-black">← 返回审核中心</Link><h1 className="mt-8 text-4xl font-black">技能证据审核</h1><p className="mt-3 text-[#777166]">根据项目评级、贡献比例和技能要求进行独立验证。</p><div className="mt-8"><SkillEvidenceReview evidence={items} onReview={(id, status, reason) => review(id, status, reason)} /></div></div></main>;
}
