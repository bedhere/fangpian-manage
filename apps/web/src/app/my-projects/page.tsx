"use client";

import { PageState } from "@/components/states/page-state";
import { MyProjectList, type NewPersonalProject } from "@/features/my-projects/my-project-list";
import type { PersonalProject, PersonalProjectSummary } from "@/features/my-projects/types";
import { apiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function MyProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<PersonalProjectSummary[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiClient.request<PersonalProjectSummary[]>("/api/personal-projects").then(setProjects).catch((cause) => setError(cause instanceof Error ? cause.message : "项目加载失败"));
  }, []);
  async function create(input: NewPersonalProject) {
    const project = await apiClient.request<PersonalProject>("/api/personal-projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    router.push(`/my-projects/${project.id}`);
  }
  if (!projects) return <main className="mx-auto max-w-3xl p-6"><PageState title={error ? "我的项目加载失败" : "正在读取我的项目"} description={error || "同步你的项目、任务与进展"} /></main>;
  return <main className="px-5 py-8"><div className="mx-auto max-w-7xl space-y-5"><MyProjectList projects={projects} onCreate={create} /></div></main>;
}
