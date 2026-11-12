'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';
import { ProjectGanttView, type GanttProject } from './project-gantt-view';
export function ProjectGanttPanel() {
  const [projects, setProjects] = useState<GanttProject[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setProjects((await apiClient.request<{ projects: GanttProject[] }>('/api/insights/project-gantt')).projects); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '甘特图加载失败'); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    apiClient.request<{ projects: GanttProject[] }>('/api/insights/project-gantt')
      .then((response) => { if (!cancelled) setProjects(response.projects); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : '甘特图加载失败'); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <div role="alert" className="rounded-3xl bg-white p-6"><p>{error}</p><button className="fp-timeline-primary mt-3" onClick={() => void load()}>重新加载甘特图</button></div>;
  if (!projects) return <p role="status" className="rounded-3xl bg-white p-6">正在读取所有项目时间轴…</p>;
  return <ProjectGanttView projects={projects} />;
}
