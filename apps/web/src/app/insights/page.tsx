"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageState } from '@/components/states/page-state';
import { CompanyInsightsView, type CompanyInsight } from '@/features/insights/company-insights-view';
import { apiClient } from '@/lib/api';
import { ProjectGanttPanel } from '@/features/insights/project-gantt-panel';
export default function InsightsPage() {
  const [data, setData] = useState<CompanyInsight | null>(null); const [error, setError] = useState('');
  useEffect(() => { apiClient.request<CompanyInsight>('/api/insights/company').then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : '经营洞察加载失败')); }, []);
  if (!data) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '无法查看公司洞察' : '正在聚合公司价值流'} description={error || '同步项目、验收、奖金、产能与 AI 效率'} /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-[1800px]"><Link href="/dashboard" className="text-sm font-black">← 返回工作台</Link><p className="mt-10 text-xs font-black tracking-[.2em] text-[#8a7b50]">COMPANY INSIGHTS</p><h1 className="mt-2 text-5xl font-black">公司价值流洞察</h1><p className="mt-3 text-[#777166]">从需求、项目、交付、评价到奖金的同一套真实数据。</p><div className="mt-8"><div className="mb-6"><ProjectGanttPanel /></div><CompanyInsightsView data={data}/></div></div></main>;
}


