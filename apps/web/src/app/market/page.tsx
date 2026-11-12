"use client";

import { useEffect, useState } from "react";
import { MarketView, type ApplicationInput, type MarketProject } from "@/features/market/market-view";
import { apiClient } from "@/lib/api";

export default function MarketPage() {
  const [projects, setProjects] = useState<MarketProject[]>([]);
  const [message, setMessage] = useState("正在加载任务市场…");

  useEffect(() => {
    apiClient.request<MarketProject[]>("/api/market/projects").then((data) => {
      setProjects(data);
      setMessage(data.length ? "" : "当前没有开放项目");
    }).catch((error) => setMessage(error instanceof Error ? error.message : "加载失败"));
  }, []);

  async function apply(projectId: string, input: ApplicationInput) {
    return apiClient.request<{ status: string }>(`/api/projects/${projectId}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  return <main className="min-h-screen bg-[#f4f1e8] px-5 py-8 text-[#303030]">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-black tracking-[.16em] text-black/45">FANGPIAN MARKET</p><h1 className="mt-1 text-4xl font-black">任务市场</h1><p className="mt-2 text-black/60">匹配解释公开透明，申请内容由你亲自确认后提交。</p></div>
      </header>
      {message ? <p role="status" className="mt-6 rounded-2xl border border-black/10 bg-white p-4 font-bold">{message}</p> : null}
      <MarketView projects={projects} onApply={apply} />
    </div>
  </main>;
}
