"use client";

import { PageState } from "@/components/states/page-state";
import { RequestListView, type RequestSummary } from "@/features/requests/request-list-view";
import { apiClient } from "@/lib/api";
import { useEffect, useState } from "react";

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiClient.request<RequestSummary[]>("/api/requests")
      .then(setRequests)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "需求列表加载失败"));
  }, []);
  if (!requests) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? "需求列表加载失败" : "正在读取我的需求"} description={error || "同步你提过的需求、诊断结果和转化进度"} /></main>;
  return <main className="px-5 py-8"><div className="mx-auto max-w-6xl"><RequestListView requests={requests} /></div></main>;
}
