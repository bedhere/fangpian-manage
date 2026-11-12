'use client';

import { PageState } from '@/components/states/page-state';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ExecutionView, type ExecutionOverview } from './execution-view';
import { ProjectTimelineView } from './project-timeline-view';

export function ExecutionPage({ projectId, mode }: { projectId: string; mode: 'plan' | 'manage' | 'timeline' }) {
  const [execution, setExecution] = useState<ExecutionOverview | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => apiClient.request<ExecutionOverview>(`/api/projects/${projectId}/execution`).then(setExecution), [projectId]);
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : '执行信息加载失败')); }, [load]);
  async function action(name: string, payload?: unknown) {
    if (name === 'save-timeline-node' || name === 'delete-timeline-node') {
      const { nodeId, ...body } = payload as { nodeId: string | null; title?: string; description?: string; date?: string | null; status?: string };
      await apiClient.request(`/api/projects/${projectId}/timeline-nodes${nodeId ? `/${encodeURIComponent(nodeId)}` : ''}`, {
        method: name === 'delete-timeline-node' ? 'DELETE' : nodeId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' }, body: name === 'delete-timeline-node' ? undefined : JSON.stringify(body),
      });
      await load();
      return;
    }
    if (name === 'respond-invitation') {
      const response = payload as { invitationId: string; accept: boolean };
      await apiClient.request(`/api/projects/invitations/${response.invitationId}/respond`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accept: response.accept }) });
      await load();
      return;
    }
    const paths: Record<string, string> = { 'save-plan': 'plan', 'submit-plan': 'plan/submit', 'confirm-plan': 'plan/confirm', start: 'start', progress: 'progress', invite: 'invitations', 'risk-action': 'risk-actions', 'replace-owner': 'replace-owner' };
    await apiClient.request(`/api/projects/${projectId}/${paths[name]}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    await load();
  }
  if (error) return <PageState title="执行信息加载失败" description={error} />;
  if (!execution) return <PageState title="正在同步执行事实" description="正在读取计划、团队、进展与健康记录" />;
  if (mode === 'timeline') return <ProjectTimelineView nodes={execution.timelineNodes ?? []} progress={execution.progressLogs[0]?.progressPercent ?? 0} canEdit={execution.canEditTimeline ?? false} onAction={action} />;
  return <><Link href={`/projects/${projectId}`} className="text-sm font-black">← 返回项目详情</Link><div className="mt-6"><ExecutionView execution={execution} mode={mode} onAction={action} /></div></>;
}
