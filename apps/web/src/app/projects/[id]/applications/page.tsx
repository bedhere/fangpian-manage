"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageState } from "@/components/states/page-state";
import {
  ApplicationReviewView,
  type ApplicationDecision,
  type ProjectApplication,
} from "@/features/market/application-review-view";
import { apiClient } from "@/lib/api";

export default function ProjectApplicationsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [applications, setApplications] = useState<ProjectApplication[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => apiClient.request<ProjectApplication[]>(`/api/projects/${id}/applications`).then(setApplications), [id]);

  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "申请列表加载失败")); }, [load]);

  async function decide(applicationId: string, decision: ApplicationDecision) {
    await apiClient.request(`/api/projects/${id}/applications/${applicationId}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (decision === "REJECTED") await load();
    else router.push(`/projects/${id}`);
  }

  if (error) return <main className="mx-auto max-w-3xl p-6"><PageState title="申请列表加载失败" description={error} /></main>;
  if (!applications) return <main className="mx-auto max-w-3xl p-6"><PageState title="正在读取申请" description="正在计算候选人的能力、产能和匹配解释" /></main>;

  return <main className="min-h-screen bg-[#f4f1e8] px-5 py-8 text-[#303030]"><div className="mx-auto max-w-7xl"><Link href={`/projects/${id}`} className="text-sm font-black">← 返回项目详情</Link><div className="mt-6"><p className="text-sm font-black tracking-[.16em] text-black/45">CANDIDATE REVIEW</p><h1 className="mt-1 text-4xl font-black">申请人对比</h1><p className="mt-2 text-black/60">匹配分用于解释，不替代审核决定；能力不足必须显式特殊批准。</p></div><div className="mt-8"><ApplicationReviewView applications={applications} onDecide={decide} /></div></div></main>;
}
