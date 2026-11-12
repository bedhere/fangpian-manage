import Link from 'next/link';
import { Badge } from '@fangpian/ui';
import { dateText, type IvyTaskEntry, type Workspace } from './types';

export function ivyTaskEntries(data: Workspace, ownerId: string | null, dateKey: string) {
  return data.ivyTaskDays?.find(d => d.ownerId === ownerId && d.dateKey === dateKey)?.entries ?? [];
}
export function AutomaticIvyTasks({ entries, historical = false }: { entries: IvyTaskEntry[]; historical?: boolean }) {
  if (!entries.length) return null;
  return <section aria-label="自动关联任务" className="space-y-3 rounded-2xl border border-[#ead89e] bg-[#fff8e1] p-4">
    <div className="flex flex-wrap items-center gap-2"><h4 className="font-black">{historical ? '当日关联任务' : '今日关联任务'}</h4><Badge>{entries.length} 项</Badge></div>
    <p className="text-xs leading-6 text-[#756d59]">{historical ? '以下为当日保留的任务状态。日报原文和评分继续保留。' : '已批准的任务自动带入，导师验收通过后标记完成。点击任务可查看详情或更新进度，仍可在下方填写其他事项。'}</p>
    <ul className="space-y-2">{entries.map(entry => {
      const cancelled = ['CANCELLED', 'CANCELED'].includes(entry.taskStatus);
      const state = cancelled ? '已取消' : entry.status === 'DONE' ? '导师已验收' : entry.taskStatus === 'SUBMITTED' ? '待导师验收' : entry.taskStatus === 'RETURNED' ? '退回完善' : '进行中';
      return <li key={entry.taskId} className="rounded-xl border border-[#eee3c6] bg-white p-3 text-sm">
        <div className="flex flex-wrap items-start gap-2"><span aria-label={entry.status === 'DONE' ? '完成' : cancelled ? '已取消' : '进行中'}>{entry.status === 'DONE' ? '✅' : cancelled ? '❌' : '🚶'}</span><Link prefetch={false} href={`/ai-center/records/${encodeURIComponent(entry.taskId)}`} className="min-w-0 flex-1 break-words font-bold underline decoration-[#d7bd66] underline-offset-4">{entry.title}</Link><Badge>{entry.priority}</Badge><Badge>{state}</Badge></div>
        <p className="mt-2 text-xs text-[#756d59]">跟踪进度 {entry.progress}%{entry.dueAt ? ` · 截止 ${dateText(entry.dueAt)}` : ''}</p>
      </li>;
    })}</ul>
  </section>;
}
