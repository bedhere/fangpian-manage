import { Card } from "@fangpian/ui";
import Link from "next/link";

export type RequestSummary = {
  id: string;
  title: string;
  problem: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  linkedProject: { id: string; title: string; status: string } | null;
};

const statusMeta: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "待诊断", tone: "is-wait" },
  AI_WORKSPACE: { label: "AI 工作中", tone: "is-run" },
  HUMAN_PROJECT: { label: "待确认项目", tone: "is-wait" },
  HUMAN_REQUIRED: { label: "已转为项目", tone: "is-done" },
  COMPLETED: { label: "已完成", tone: "is-done" },
};

export function RequestListView({ requests }: { requests: RequestSummary[] }) {
  return <section>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-black tracking-[.2em] text-[#8a7b50]">MY REQUESTS</p><h1 className="mt-2 text-5xl font-black">我的需求</h1><p className="mt-3 text-[#777166]">你提出的每个问题，从诊断、AI 工作区到转成项目，进度都在这里。</p></div>
      <Link href="/requests/new" className="fp-button fp-button--primary inline-flex items-center gap-2">发起需求<span className="fp-arrow" aria-hidden="true">→</span></Link>
    </div>
    {requests.length
      ? <ol className="fp-stagger grid gap-4 md:grid-cols-2">{requests.map((request) => {
        const meta = statusMeta[request.status] ?? { label: request.status, tone: "is-wait" };
        return <li key={request.id}><Card className="fp-lift flex h-full flex-col p-6">
          <div className="flex items-center justify-between gap-3"><span className={`fp-status ${meta.tone}`}>{meta.label}</span><time className="text-xs font-bold text-[#777166]" dateTime={request.updatedAt}>更新于 {new Date(request.updatedAt).toLocaleDateString("zh-CN")}</time></div>
          <h2 className="mt-4 text-2xl font-black">{request.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5f5b52]">{request.problem}</p>
          {request.linkedProject ? <p className="mt-3 text-sm font-bold">关联项目：<Link href={`/projects/${request.linkedProject.id}`} className="underline decoration-[#ffd85f] decoration-4 underline-offset-4">{request.linkedProject.title}</Link></p> : null}
          <Link href={`/requests/${request.id}`} className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-sm font-black">查看需求<span className="fp-arrow" aria-hidden="true">→</span></Link>
        </Card></li>;
      })}</ol>
      : <Card className="p-10 text-center"><img src="/brand/tiger-thinking-seated.webp" alt="" className="fp-sticker fp-float mx-auto mb-4 h-28 w-28 object-contain" /><h2 className="text-xl font-black">还没有提过需求</h2><p className="mt-2 text-sm text-[#777166]">遇到想解决的问题，就把它写下来，AI 会先帮你诊断该怎么推进。</p><Link href="/requests/new" className="fp-button fp-button--primary mt-5 inline-flex items-center">发起第一个需求</Link></Card>}
  </section>;
}
