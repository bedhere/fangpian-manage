"use client";

import { PageState } from "@/components/states/page-state";
import { RequestDetailView, type BusinessRequestDetail } from "@/features/requests/request-detail-view";
import { apiClient } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { diagnosisFeedback } from '@/features/requests/diagnosis-feedback';
import { finishProjectConfirmation } from '@/features/requests/review-submission-feedback';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<BusinessRequestDetail | null>(null);
  const [error, setError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [demoPending, setDemoPending] = useState(false);
  const actionInFlight = useRef(false);
  const load = useCallback(() => apiClient.request<BusinessRequestDetail>(`/api/requests/${id}`).then(setRequest), [id]);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "需求加载失败")); }, [load]);
  async function mutate(path: string, body: unknown) {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setActionPending(true); setActionError(''); setActionNotice('');
    let succeeded = true;
    try {
      const result = await apiClient.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (path.endsWith('/diagnose')) {
        const feedback = diagnosisFeedback(result);
        setActionError(feedback.error); setActionNotice(feedback.notice);
        succeeded = !feedback.error;
      }
      if (path.endsWith('/confirm-project')) {
        const project = result as NonNullable<BusinessRequestDetail['linkedProject']>;
        setRequest((current) => current ? { ...current, linkedProject: { id: project.id, title: project.title, status: project.status } } : current);
        finishProjectConfirmation(project, (path) => router.push(path));
        return;
      }
      try { await load(); }
      catch { setActionError('操作已成功，但最新状态读取失败，请刷新页面查看。'); }
      return succeeded;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '操作失败，请重试');
     return false; } finally {
      actionInFlight.current = false;
      setActionPending(false);
    }
  }
  if (error) return <main className="mx-auto max-w-3xl p-6"><PageState title="需求加载失败" description={error} /></main>;
  if (!request) return <main className="mx-auto max-w-3xl p-6"><PageState title="正在读取需求" description="正在同步诊断与工作区记录" /></main>;
  const sessionId = request.workspaceSessions[0]?.id;
  async function generateDemo(instruction: string) {
    if (!sessionId) return false;
    setDemoPending(true);
    try { return await mutate(`/api/ai-workspaces/${sessionId}/demo`, { instruction: instruction || undefined, idempotencyKey: crypto.randomUUID() }); }
    finally { setDemoPending(false); }
  }
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-7xl"><Link href="/requests" className="text-sm font-black">← 我的需求</Link><div className="mt-6"><RequestDetailView request={request} actionPending={actionPending} actionError={actionError} actionNotice={actionNotice} onDiagnose={(route) => mutate(`/api/requests/${id}/diagnose`, { route })} onSendMessage={(content) => sessionId && mutate(`/api/ai-workspaces/${sessionId}/messages`, { content, idempotencyKey: crypto.randomUUID() })} onComplete={(assistantMessageId) => sessionId && mutate(`/api/ai-workspaces/${sessionId}/complete`, { assistantMessageId })} onConfirmProject={() => mutate(`/api/requests/${id}/confirm-project`, {})} onGenerateDemo={generateDemo} demoPending={demoPending} /></div></div></main>;
}


