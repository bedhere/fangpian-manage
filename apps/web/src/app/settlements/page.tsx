"use client";

import { Card } from '@fangpian/ui';
import { SettlementConfirmControls } from '@/features/settlement/settlement-confirm-controls';
import { PageState } from '@/components/states/page-state';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Overview = { batches: Array<{ id: string; settlementMonth: string; status: string; totalAmount: string; lockedAt: string; paidAt: string | null; ledgers: unknown[] }>; ledgers: Array<{ id: string; amount: string; contributionPercentage: string; status: string; settlementMonth: string; user: { displayName: string }; project: { title: string } }> };
export default function SettlementsPage() {
  const [pending, setPending] = useState(false);
  const [data, setData] = useState<Overview | null>(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const load = useCallback(() => apiClient.request<Overview>(`/api/settlements?month=${month}`).then(setData), [month]);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : '月结数据加载失败')); }, [load]);
  async function lock() { setPending(true); setError(''); setMessage(''); try { await apiClient.request('/api/settlements/lock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ month }) }); setMessage(`${month} 已幂等锁定。`); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : '锁定失败'); return false; } finally { setPending(false); } }
  async function pay(id: string) { setPending(true); setError(''); setMessage(''); try { await apiClient.request(`/api/settlements/${id}/pay`, { method: 'POST' }); setMessage('奖金批次已标记发放。'); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : '发放失败'); return false; } finally { setPending(false); } }
  if (!data) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '月结数据加载失败' : '正在读取月结事实'} description={error || '正在同步奖金流水和结算批次'} /></main>;
  const batch = data.batches[0]; const total = data.ledgers.reduce((sum, item) => sum + Number(item.amount), 0);
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-7xl"><Link href="/dashboard" className="text-sm font-black">← 返回工作台</Link><p className="mt-10 text-xs font-black tracking-[.2em] text-[#8a7b50]">SETTLEMENT CONTROL</p><h1 className="mt-2 text-5xl font-black">奖金月结管理</h1><div className="mt-6 flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-bold">结算月份<input type="month" disabled={pending} value={month} onChange={(event) => setMonth(event.target.value)} className="h-11 rounded-xl border border-black/10 bg-white px-3" /></label><SettlementConfirmControls month={month} batch={batch} pending={pending} onLock={lock} onPay={pay} /></div>{message ? <p className="mt-4 rounded-2xl bg-[#fff1b8] p-4 font-bold">{message}</p> : null}{error ? <p className="mt-4 rounded-2xl bg-red-50 p-4 text-red-800">{error}</p> : null}<div className="mt-6 grid gap-4 md:grid-cols-3"><Card className="bg-[#303030] p-6 text-white"><p className="text-sm text-white/60">本月流水</p><strong className="mt-2 block text-4xl">¥ {total.toFixed(2)}</strong></Card><Card className="p-6"><p className="text-sm text-[#777166]">流水数量</p><strong className="mt-2 block text-4xl">{data.ledgers.length}</strong></Card><Card className="bg-[#ffd85f] p-6"><p className="text-sm font-bold">批次状态</p><strong className="mt-2 block text-3xl">{batch?.status ?? '尚未锁定'}</strong></Card></div><div className="mt-6 space-y-3">{data.ledgers.map((item) => <Card key={item.id} className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto_auto]"><strong>{item.project.title}</strong><span>{item.user.displayName} · {item.contributionPercentage}%</span><strong>¥ {Number(item.amount).toFixed(2)}</strong><span className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs font-black">{item.status}</span></Card>)}</div></div></main>;
}
