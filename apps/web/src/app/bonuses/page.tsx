"use client";

import { PageState } from '@/components/states/page-state';
import { BonusLedgerView, type BonusLedger } from '@/features/settlement/bonus-ledger-view';
import { TransparentBonusLedger, type TransparentBonusItem } from '@/features/settlement/transparent-bonus-ledger';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function BonusesPage() {
  const [ledgers, setLedgers] = useState<BonusLedger[] | null>(null); const [error, setError] = useState('');
  const [transparent, setTransparent] = useState<TransparentBonusItem[]>([]);
  useEffect(() => { Promise.all([apiClient.request<BonusLedger[]>('/api/bonuses/me'), apiClient.request<{ items: TransparentBonusItem[] }>('/api/bonuses/transparent?page=1&pageSize=50')]).then(([mine, organization]) => { setLedgers(mine); setTransparent(organization.items); }).catch((cause) => setError(cause instanceof Error ? cause.message : '奖金流水加载失败')); }, []);
  if (!ledgers) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? '奖金流水加载失败' : '正在读取奖金事实'} description={error || '正在同步项目奖金、贡献比例与月结状态'} /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-6xl"><Link href="/dashboard" className="text-sm font-black">← 返回工作台</Link><p className="mt-10 text-xs font-black tracking-[.2em] text-[#8a7b50]">MY VALUE</p><h1 className="mt-2 text-5xl font-black">我的项目奖金</h1><p className="mt-4 text-[#777166]">每一笔奖金都能追溯到项目评级、最终贡献比例和结算月份。</p><div className="mt-8"><BonusLedgerView ledgers={ledgers} /></div><section className="mt-12"><p className="text-xs font-black tracking-[.2em] text-[#8a7b50]">OPEN LEDGER</p><h2 className="mt-2 text-3xl font-black">组织奖金透明账本</h2><p className="mt-3 text-sm text-[#777166]">仅展示价值分配事实，不公开邮箱、密码或其他私密身份信息。</p><div className="mt-6"><TransparentBonusLedger items={transparent}/></div></section></div></main>;
}
