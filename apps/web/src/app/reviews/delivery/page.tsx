"use client";

import { Card } from '@fangpian/ui';
import { PageState } from '@/components/states/page-state';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type QueueItem = { id: string; title: string; status: string; updatedAt: string; publisher: { displayName: string }; owner: { displayName: string } | null; deliveries: Array<{ version: number; title: string }> };

export default function DeliveryReviewQueuePage() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { apiClient.request<QueueItem[]>('/api/projects/delivery-review-queue').then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : '验收队列加载失败')); }, []);
  if (!items) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '验收队列加载失败' : '正在读取验收任务'} description={error || '系统正在按项目关系分配你的验收角色'} /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-6xl"><Link href="/reviews" className="text-sm font-black">← 返回审核中心</Link><p className="mt-10 text-xs font-black tracking-[.2em] text-[#8a7b50]">DELIVERY REVIEW</p><h1 className="mt-2 text-5xl font-black">交付验收队列</h1><p className="mt-4 text-[#777166]">这里只出现由系统关系分配给你的三方验收或高价值确认任务。</p><div className="mt-8 grid gap-4">{items.length ? items.map((item) => <Card key={item.id} className="flex flex-wrap items-center justify-between gap-5 p-6"><div><span className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs font-black">{item.status}</span><h2 className="mt-3 text-2xl font-black">{item.title}</h2><p className="mt-2 text-sm text-[#777166]">发布人 {item.publisher.displayName} · 负责人 {item.owner?.displayName ?? '未分配'} · 最新 V{item.deliveries[0]?.version ?? 0}</p></div><Link href={`/projects/${item.id}/delivery`} className="rounded-2xl bg-[#303030] px-5 py-3 font-black text-white">进入验收工作台</Link></Card>) : <Card className="p-10 text-center"><h2 className="text-xl font-black">当前没有待处理交付</h2><p className="mt-2 text-sm text-[#777166]">新任务会依据发布人、部门负责人、直属主管或高管权限自动进入这里。</p></Card>}</div></div></main>;
}
