"use client";

import { PageState } from '@/components/states/page-state';
import { ProjectListView } from '@/features/projects/project-list-view';
import type { ProjectSummary } from '@/features/projects/project-types';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type ProjectPage = { items: ProjectSummary[]; page: number; pageSize: number; total: number; view?: string };

export default function ProjectsPage() {
  return <Suspense fallback={<PageState title="正在读取项目" description="正在同步项目列表" />}><ProjectPageContent /></Suspense>;
}

function ProjectPageContent() {
  const params = useSearchParams();
  const owned = params.get('view') === 'OWNED';
  const department = params.get('view') === 'DEPARTMENT';
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ProjectPage | null>(null);
  const [error, setError] = useState('');
  const view = department ? 'DEPARTMENT' : owned ? 'OWNED' : 'MINE';
  const loading = !result || result.page !== page || result.view !== view;
  useEffect(() => { setPage(1); }, [view]);
  useEffect(() => {
    let cancelled = false;
    apiClient.request<ProjectPage>(`/api/projects?view=${view}&page=${page}&pageSize=20`)
      .then((response) => { if (!cancelled) { setResult({ ...response, view }); setError(''); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : '项目加载失败'); });
    return () => { cancelled = true; };
  }, [view, page]);
  if (error) return <main className="mx-auto max-w-3xl p-6"><PageState title="项目加载失败" description={error} /></main>;
  if (!result) return <main className="mx-auto max-w-3xl p-6"><PageState title="正在读取项目" description={department ? '正在同步本部门进行中的项目' : '正在同步你发布、负责和参与的项目'} /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-7xl"><div className="mb-6 flex justify-between"><Link href="/dashboard" className="text-sm font-black">← 返回工作台</Link><Link href="/requests/new" className="rounded-full bg-[#ffd85f] px-4 py-2 text-sm font-black">发起需求</Link></div><ProjectListView projects={result.items} total={result.total} owned={owned} department={department} />{result.total > 20 ? <nav aria-label="项目分页" className="mt-6 flex items-center justify-center gap-4"><button className="fp-timeline-text-button" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)}>上一页</button><span>第 {result.page} / {Math.ceil(result.total / 20)} 页</span><button className="fp-timeline-text-button" disabled={loading || page * 20 >= result.total} onClick={() => setPage((value) => value + 1)}>下一页</button></nav> : null}</div></main>;
}

