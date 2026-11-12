"use client";

import { PageState } from "@/components/states/page-state";
import { DashboardView, type WorkspaceBootstrap } from "@/features/dashboard/dashboard-view";
import { apiClient } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { useSessionStore } from "@/stores/session-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCallback } from "react";
import { useBusinessEvents } from "@/lib/business-events";
import { ReviewSubmittedDialog } from '@/features/dashboard/review-submitted-dialog';

export default function DashboardPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceBootstrap | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const setIdentity = useSessionStore((state) => state.setIdentity);
  const refresh = useCallback(() => { apiClient.request<WorkspaceBootstrap>("/api/workspace/bootstrap").then(setWorkspace).catch(() => undefined); }, []);
  useBusinessEvents(refresh);

  useEffect(() => {
    apiClient.request<WorkspaceBootstrap>("/api/workspace/bootstrap")
      .then((result) => {
        setIdentity(result.user);
        setWorkspace(result);
      })
      .catch((reason: unknown) => {
        const invalid = reason instanceof ApiError && reason.status === 401;
        setError(invalid ? '登录已失效，请重新登录' : '暂时无法加载工作台，请检查网络后重新加载。当前登录信息已保留。');
        if (invalid) router.replace('/');
      });
  }, [router, setIdentity, retry]);

  if (error) return <main className="mx-auto max-w-3xl p-6"><PageState title="暂时无法加载工作台" description={error} /><button type="button" className="mt-4 rounded-xl bg-[#ffd85f] px-5 py-3 font-bold" onClick={() => { setError(''); setRetry(value => value + 1); }}>重新加载</button></main>;
  if (!workspace) return <main className="mx-auto max-w-3xl p-6"><PageState title="正在加载工作台" description="正在同步你的项目、申请与最新动态" /></main>;

  return <>
    <DashboardView workspace={workspace} />
    <ReviewSubmittedDialog />
  </>;
}
