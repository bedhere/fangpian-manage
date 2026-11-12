"use client";

import { Card } from "@fangpian/ui";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { dateInput, dueText, personalStatusMeta, type PersonalProject, type PersonalStatus } from "./types";

type Patch = Partial<Pick<PersonalProject, "title" | "description" | "status" | "progress">> & { startDate?: string | null; dueDate?: string | null };

export type MyProjectActions = {
  update: (patch: Patch) => Promise<unknown>;
  addTask: (title: string) => Promise<unknown>;
  toggleTask: (taskId: string, done: boolean) => Promise<unknown>;
  removeTask: (taskId: string) => Promise<unknown>;
  addUpdate: (content: string, progress?: number) => Promise<unknown>;
  remove: () => Promise<unknown>;
};

const statuses: PersonalStatus[] = ["PLANNING", "IN_PROGRESS", "PAUSED", "DONE"];

/** One personal project: progress, checklist, and a dated log of what moved. */
export function MyProjectDetail({ project, actions, busy }: { project: PersonalProject; actions: MyProjectActions; busy: boolean }) {
  const [progressDraft, setProgressDraft] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const due = dueText(project.dueDate, project.status);
  const doneTasks = project.tasks.filter((task) => task.done).length;
  const progress = progressDraft ?? project.progress;
  const autoProgress = project.tasks.length > 0;

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get("title") ?? "").trim();
    if (!title) return;
    await actions.addTask(title);
    form.reset();
  }
  async function addUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const content = String(data.get("content") ?? "").trim();
    if (!content) return;
    const raw = String(data.get("progress") ?? "");
    await actions.addUpdate(content, raw === "" || autoProgress ? undefined : Number(raw));
    form.reset();
  }

  return <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-3"><span className={`fp-status ${personalStatusMeta[project.status].tone}`}>{personalStatusMeta[project.status].label}</span><span className={`fp-due fp-due--${due.tone}`}>{due.text}</span></div>
        <h1 className="mt-3 text-3xl font-black tracking-[-.03em]">{project.title}</h1>
        {project.description ? <p className="mt-2 whitespace-pre-wrap text-[#5f5b52]">{project.description}</p> : null}
        <div className="mt-5 flex items-center gap-4"><div className="fp-meter fp-meter--lg" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div><strong className="w-16 text-right text-2xl font-black tabular-nums">{progress}%</strong></div>
        {autoProgress
          ? <p className="mt-2 text-xs font-bold text-[#8a857a]">进度按任务完成情况自动计算（{doneTasks}/{project.tasks.length}）</p>
          : <label className="mt-3 block text-sm font-bold">手动调整进度<input type="range" min={0} max={100} step={5} value={progress} disabled={busy} onChange={(event) => setProgressDraft(Number(event.target.value))} onPointerUp={() => { if (progressDraft !== null && progressDraft !== project.progress) void actions.update({ progress: progressDraft }).finally(() => setProgressDraft(null)); }} onKeyUp={() => { if (progressDraft !== null && progressDraft !== project.progress) void actions.update({ progress: progressDraft }).finally(() => setProgressDraft(null)); }} className="mt-2 w-full" /></label>}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between"><h2 className="text-xl font-black">任务清单</h2><span className="text-sm font-bold text-[#8a857a]">{doneTasks}/{project.tasks.length} 已完成</span></div>
        <ul className="mt-3">{project.tasks.map((task) => <li key={task.id} className="fp-check" data-done={task.done || undefined}>
          <label className="flex min-w-0 flex-1 items-center gap-3"><input type="checkbox" checked={task.done} disabled={busy} onChange={(event) => void actions.toggleTask(task.id, event.target.checked)} /><span className="truncate">{task.title}</span></label>
          <button type="button" aria-label={`删除任务 ${task.title}`} disabled={busy} onClick={() => void actions.removeTask(task.id)} className="fp-check__remove"><Trash2 size={15} /></button>
        </li>)}</ul>
        {!project.tasks.length ? <p className="py-3 text-sm text-[#8a857a]">把项目拆成几个可完成的小任务，进度会自动计算。</p> : null}
        <form onSubmit={addTask} className="mt-3 flex gap-2"><input name="title" required maxLength={200} placeholder="添加任务，回车保存" className="h-11 min-w-0 flex-1 rounded-xl border border-black/10 px-3" /><button type="submit" disabled={busy} className="fp-button fp-button--secondary">添加</button></form>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-black">进展记录</h2>
        <form onSubmit={addUpdate} className="mt-3 grid gap-2">
          <textarea name="content" required rows={3} maxLength={4000} placeholder="今天推进了什么、遇到什么问题、下一步打算" className="rounded-xl border border-black/10 p-3" />
          <div className="flex flex-wrap items-center gap-3">{autoProgress ? null : <label className="flex items-center gap-2 text-sm font-bold">同步进度<input name="progress" type="number" min={0} max={100} placeholder={String(project.progress)} className="h-10 w-20 rounded-xl border border-black/10 px-2" />%</label>}<button type="submit" disabled={busy} className="fp-button fp-button--primary ml-auto">记录进展</button></div>
        </form>
        <ol className="fp-log mt-5">{project.updates.map((update) => <li key={update.id}><time dateTime={update.createdAt}>{new Date(update.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time><p>{update.content}</p>{update.progress !== null ? <span className="fp-log__progress">进度 → {update.progress}%</span> : null}</li>)}</ol>
        {!project.updates.length ? <p className="py-3 text-sm text-[#8a857a]">还没有进展记录。</p> : null}
      </Card>
    </div>

    <aside className="space-y-5">
      <Card className="p-6">
        <h2 className="text-lg font-black">项目设置</h2>
        <div className="mt-4 grid gap-4">
          <label className="fp-field">状态<select value={project.status} disabled={busy} onChange={(event) => void actions.update({ status: event.target.value as PersonalStatus })}>{statuses.map((status) => <option key={status} value={status}>{personalStatusMeta[status].label}</option>)}</select></label>
          <label className="fp-field">开始日期<input type="date" defaultValue={dateInput(project.startDate)} disabled={busy} onBlur={(event) => { const value = event.target.value || null; if (value !== (dateInput(project.startDate) || null)) void actions.update({ startDate: value }); }} /></label>
          <label className="fp-field">截止日期<input type="date" defaultValue={dateInput(project.dueDate)} disabled={busy} onBlur={(event) => { const value = event.target.value || null; if (value !== (dateInput(project.dueDate) || null)) void actions.update({ dueDate: value }); }} /></label>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-lg font-black">删除项目</h2>
        <p className="mt-2 text-sm text-[#5f5b52]">删除后任务和进展记录一并移除，无法恢复。</p>
        {confirmDelete
          ? <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void actions.remove()} className="fp-button bg-[#b44335] text-white">确认删除</button><button type="button" onClick={() => setConfirmDelete(false)} className="fp-button fp-button--secondary">取消</button></div>
          : <button type="button" onClick={() => setConfirmDelete(true)} className="mt-3 text-sm font-black text-[#b44335]">删除这个项目</button>}
      </Card>
      <Link href="/my-projects" className="inline-flex text-sm font-black">← 返回我的项目</Link>
    </aside>
  </div>;
}
