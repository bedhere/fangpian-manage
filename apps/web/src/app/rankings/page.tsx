"use client";

import { PageState } from '@/components/states/page-state';
import { RankingView, type RankingRow, type RankingType } from '@/features/analytics/ranking-view';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function RankingsPage() { const [type, setType] = useState<RankingType>('contribution'); const [rows, setRows] = useState<RankingRow[] | null>(null); const [error, setError] = useState(''); const load = useCallback(() => apiClient.request<RankingRow[]>(`/api/analytics/rankings?type=${type}`).then(setRows), [type]); useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : '排行加载失败')); }, [load]); if (!rows) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '排行加载失败' : '正在计算排行'} description={error || '按组织事实计算，不使用展示占位数据'} /></main>; return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-6xl"><Link href="/dashboard" className="text-sm font-black">← 返回工作台</Link><p className="mt-10 text-xs font-black tracking-[.2em] text-[#8a7b50]">VALUE RANKINGS</p><h1 className="mt-2 text-5xl font-black">组织价值排行</h1><p className="mt-4 text-[#777166]">七个视角共享真实项目、奖金、协作与成长事实。</p><div className="mt-8"><RankingView type={type} rows={rows} onTypeChange={setType} /></div></div></main>; }
