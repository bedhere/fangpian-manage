"use client";

import { PageState } from "@/components/states/page-state";
import { KnowledgeView, type KnowledgeAsset } from "@/features/knowledge/knowledge-view";
import { apiClient } from "@/lib/api";
import { useSessionStore } from "@/stores/session-store";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function KnowledgePage() {
  const identity = useSessionStore((state) => state.identity);
  const [assets, setAssets] = useState<KnowledgeAsset[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => apiClient.request<KnowledgeAsset[]>("/api/knowledge-assets").then(setAssets), []);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "知识库加载失败")); }, [load]);
  async function mutate(path: string, body?: unknown) {
    await apiClient.request(path, { method: "POST", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    await load();
  }
  if (error) return <main className="mx-auto max-w-3xl p-6"><PageState title="知识库加载失败" description={error} /></main>;
  if (!assets || !identity) return <main className="mx-auto max-w-3xl p-6"><PageState title="正在加载知识库" description="正在同步知识资产与审核队列" /></main>;
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-7xl"><Link href="/dashboard" className="text-sm font-black">← 返回工作台</Link><div className="mt-6"><KnowledgeView assets={assets} currentUserId={identity.id} permissions={identity.permissions} onCreate={(input) => mutate("/api/knowledge-assets", input)} onSubmit={(id) => mutate(`/api/knowledge-assets/${id}/submit`)} onReview={(id, stage, decision) => mutate(`/api/knowledge-assets/${id}/reviews`, { stage, decision })} onReuse={(id, input) => mutate(`/api/knowledge-assets/${id}/reuse`, { ...input, idempotencyKey: `web-${input.referenceType}-${input.referenceId}` })} /></div></div></main>;
}
