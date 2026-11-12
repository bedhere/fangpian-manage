'use client';
import { ExecutionPage } from '@/features/execution/execution-page';
import { useParams } from 'next/navigation';
export default function ProjectManagePage() { const { id } = useParams<{ id: string }>(); return <main className="min-h-screen bg-[#f4f1e8] px-5 py-8 text-[#303030]"><div className="mx-auto max-w-7xl"><ExecutionPage projectId={id} mode="manage" /></div></main>; }
