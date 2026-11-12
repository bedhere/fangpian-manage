"use client";

import { PageState } from '@/components/states/page-state'; import { apiClient } from '@/lib/api'; import { useRouter } from 'next/navigation'; import { useEffect } from 'react';
export default function MyProfilePage() { const router = useRouter(); useEffect(() => { apiClient.request<{ user: { id: string } }>('/api/workspace/bootstrap').then((result) => router.replace(`/profile/${result.user.id}`)).catch(() => router.replace('/')); }, [router]); return <main className="mx-auto max-w-3xl p-6"><PageState title="正在打开示例公司有限公司画像" description="同步你的能力、贡献、技能和成长记录" /></main>; }
