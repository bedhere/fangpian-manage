"use client";

import { PageState } from "@/components/states/page-state";
import { ProjectDetailView } from "@/features/projects/project-detail-view";
import { ProjectClaimButton } from "@/features/projects/project-claim-button";
import { ExecutionPage } from "@/features/execution/execution-page";
import type { ProjectDetail } from "@/features/projects/project-types";
import { apiClient } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState("");
  const currentId = useRef(id);
  currentId.current = id;
  const load = useCallback(
    () => apiClient.request<ProjectDetail>(`/api/projects/${id}`),
    [id],
  );
  useEffect(() => {
    let active = true;
    setError("");
    setProject(null);
    load()
      .then((result) => {
        if (active) setProject(result);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "项目加载失败");
      });
    return () => {
      active = false;
    };
  }, [load]);
  async function resubmit() {
    if (!project) return;
    await apiClient.request(`/api/projects/${id}/resubmit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: project.version }),
    });
    const result = await load();
    if (currentId.current === id) setProject(result);
  }
  if (error)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <PageState title="项目加载失败" description={error} />
      </main>
    );
  if (!project || project.id !== id)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <PageState
          title="正在读取项目"
          description="正在同步项目事实、审核记录和可执行操作"
        />
      </main>
    );
  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/projects" className="text-sm font-black">
          ← 返回项目中心
        </Link>
        <div className="mt-6">
          <ProjectDetailView
            project={project}
            onResubmit={() => resubmit()}
            claim={
              <ProjectClaimButton
                key={project.id}
                projectId={project.id}
                title={project.title}
                status={project.status}
              />
            }
            timeline={<ExecutionPage projectId={id} mode="timeline" />}
          />
        </div>
      </div>
    </main>
  );
}
