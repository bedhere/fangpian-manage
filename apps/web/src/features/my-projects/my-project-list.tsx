"use client";

import { Card } from "@fangpian/ui";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { dueText, personalStatusMeta, type PersonalProjectSummary } from "./types";

export type NewPersonalProject = { title: string; description?: string; startDate?: string; dueDate?: string; tasks: string[] };

/** The employee's own projects with progress at a glance, plus a quick create form. */
export function MyProjectList({ projects, onCreate }: { projects: PersonalProjectSummary[]; onCreate: (input: NewPersonalProject) => Promise<unknown> }) {
  const [creating, setCreating] = useState(projects.length === 0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const active = projects.filter((project) => project.status !== "DONE");
  const done = projects.filter((project) => project.status === "DONE");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) { setError("请填写项目名称"); return; }
    setSaving(true); setError("");
    try {
      await onCreate({
        title,
        description: String(form.get("description") ?? "").trim() || undefined,
        startDate: String(form.get("startDate") ?? "") || undefined,
        dueDate: String(form.get("dueDate") ?? "") || undefined,
        tasks: String(form.get("tasks") ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败，请重试");
    } finally { setSaving(false); }
  }

  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-black tracking-[.2em] text-[#8a7b50]">MY PROJECTS</p><h1 className="mt-2 text-4xl font-black">我的项目</h1><p className="mt-2 text-[#5f5b52]">自己发起、自己推进的事情放在这里：拆任务、记进展，进度一目了然。</p></div>
      {!creating ? <button type="button" className="fp-button fp-button--primary inline-flex items-center gap-2" onClick={() => setCreating(true)}><Plus size={18} aria-hidden="true" />新建项目</button> : null}
    </div>

    {creating ? <Card className="p-6">
      <div className="flex items-center justify-between"><h2 className="text-xl font-black">新建项目</h2>{projects.length ? <button type="button" aria-label="收起" className="grid size-9 place-items-center rounded-full hover:bg-[#f4f1e8]" onClick={() => setCreating(false)}><X size={18} /></button> : null}</div>
      <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <label className="fp-field md:col-span-2">项目名称<input name="title" required maxLength={120} placeholder="例如：门店周报自动化" /></label>
        <label className="fp-field md:col-span-2">说明（选填）<textarea name="description" rows={2} maxLength={4000} placeholder="要解决什么问题、做到什么程度算完成" /></label>
        <label className="fp-field">开始日期<input name="startDate" type="date" /></label>
        <label className="fp-field">截止日期<input name="dueDate" type="date" /></label>
        <label className="fp-field md:col-span-2">拆分任务（每行一个，选填）<textarea name="tasks" rows={4} placeholder={"整理现有周报模板\n接入门店数据\n试运行一周"} /></label>
        {error ? <p role="alert" className="text-sm font-bold text-[#b44335] md:col-span-2">{error}</p> : null}
        <div className="md:col-span-2"><button type="submit" disabled={saving} className="fp-button fp-button--primary">{saving ? "正在创建…" : "创建项目"}</button></div>
      </form>
    </Card> : null}

    {active.length ? <ol className="fp-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">{active.map((project) => <li key={project.id}><ProjectCard project={project} /></li>)}</ol> : !creating ? <Card className="p-10 text-center text-[#777166]"><img src="/brand/tiger-headband-running.webp" alt="" className="fp-float mx-auto mb-3 h-24 w-24 object-contain" /><p>手上没有进行中的项目</p></Card> : null}

    {done.length ? <details className="fp-done"><summary>已完成 {done.length} 个</summary><ol className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{done.map((project) => <li key={project.id}><ProjectCard project={project} /></li>)}</ol></details> : null}
  </section>;
}

function ProjectCard({ project }: { project: PersonalProjectSummary }) {
  const meta = personalStatusMeta[project.status];
  const due = dueText(project.dueDate, project.status);
  const doneTasks = project.tasks.filter((task) => task.done).length;
  const latest = project.updates[0];
  return <Link href={`/my-projects/${project.id}`} className="fp-card fp-lift flex h-full flex-col p-5">
    <div className="flex items-center justify-between gap-3"><span className={`fp-status ${meta.tone}`}>{meta.label}</span><span className={`fp-due fp-due--${due.tone}`}>{due.text}</span></div>
    <h2 className="mt-3 truncate text-lg font-black">{project.title}</h2>
    <div className="mt-3 flex items-center gap-3"><div className="fp-meter" aria-hidden="true"><span style={{ width: `${project.progress}%` }} /></div><strong className="w-12 text-right text-sm tabular-nums">{project.progress}%</strong></div>
    <p className="mt-2 text-xs font-bold text-[#8a857a]">{project.tasks.length ? `任务 ${doneTasks}/${project.tasks.length}` : "未拆分任务"}</p>
    {latest ? <p className="mt-3 line-clamp-2 text-sm text-[#5f5b52]">最新进展：{latest.content}</p> : null}
  </Link>;
}
