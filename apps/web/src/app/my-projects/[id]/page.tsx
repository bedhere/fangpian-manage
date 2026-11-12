"use client";

import { PageState } from "@/components/states/page-state";
import { MyProjectDetail, type MyProjectActions } from "@/features/my-projects/my-project-detail";
import type { PersonalProject } from "@/features/my-projects/types";
import { apiClient } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function MyProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<PersonalProject | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => apiClient.request<PersonalProject>(`/api/personal-projects/${id}`).then(setProject), [id]);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "项目加载失败")); }, [load]);

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true); setActionError("");
    try {
      const result = await apiClient.request<PersonalProject>(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      if (result && "tasks" in result) setProject(result);
      return result;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "操作失败，请重试");
      return false;
    } finally { setBusy(false); }
  }

  const base = `/api/personal-projects/${id}`;
  const actions: MyProjectActions = {
    update: (patch) => call(base, "PATCH", patch),
    addTask: (title) => call(`${base}/tasks`, "POST", { title }),
    toggleTask: (taskId, done) => call(`${base}/tasks/${taskId}`, "PATCH", { done }),
    removeTask: (taskId) => call(`${base}/tasks/${taskId}`, "DELETE"),
    addUpdate: (content, progress) => call(`${base}/updates`, "POST", progress === undefined ? { content } : { content, progress }),
    remove: async () => { const result = await call(base, "DELETE"); if (result !== false) router.push("/my-projects"); },
  };

  if (error) return <main className="mx-auto max-w-3xl p-6"><PageState title="项目加载失败" description={error} /></main>;
  if (!project) return <main className="mx-auto max-w-3xl p-6"><PageState title="正在读取项目" description="同步任务与进展记录" /></main>;
  return <main className="px-5 py-8"><div className="mx-auto max-w-7xl">{actionError ? <p role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{actionError}</p> : null}<MyProjectDetail project={project} actions={actions} busy={busy} /></div></main>;
}
