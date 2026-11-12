"use client";
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';


import { Card } from "@fangpian/ui";
import { FormEvent, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { CopyButton, DemoPreview, ResultBody, readResult } from "./workspace-result";
import Link from "next/link";

type WorkspaceSession = { id: string; status: string; result: unknown; messages: Array<{ id: string; role: string; content: string; createdAt: string; metadata?: { result?: Record<string, unknown> } | null }> };
export type BusinessRequestDetail = {
  id: string; title: string; problem: string; businessContext: string; expectedOutcome: string; constraints: string | null;
  status: string; diagnosis: { recommendedProjectLevel?: string; estimatedHours?: number; reason?: string } | null;
  linkedProject: { id: string; title: string; status: string } | null; workspaceSessions: WorkspaceSession[];
};

const statusLabels: Record<string, string> = { DRAFT: "待诊断", AI_WORKSPACE: "AI 工作中", HUMAN_PROJECT: "待确认项目", COMPLETED: "已完成" };

export function RequestDetailView({ request, onDiagnose, onSendMessage, onComplete, onConfirmProject, onGenerateDemo, demoPending = false, actionPending = false, actionError = '', actionNotice = '' }: {
  request: BusinessRequestDetail;
  onDiagnose: (route: "AUTO" | "AI" | "HUMAN") => unknown | Promise<unknown>;
  onSendMessage: (content: string) => unknown | Promise<unknown>;
  onComplete: (assistantMessageId: string) => unknown | Promise<unknown>;
  onConfirmProject: () => unknown | Promise<unknown>;
  /** Asks the AI to build a runnable single-file demo; the optional text refines it. */
  onGenerateDemo?: (instruction: string) => unknown | Promise<unknown>;
  demoPending?: boolean;
  actionPending?: boolean;
  actionError?: string;
  actionNotice?: string;
}) {
  const session = request.workspaceSessions[0];
  const confirmedProject = request.linkedProject?.status === 'DRAFT' ? null : request.linkedProject;
  const completedAssistantMessage = session?.messages.toReversed().find((message) => message.role === "ASSISTANT" && message.metadata?.result);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = session?.messages.length ?? 0;
  // 示例品牌 the newest reply in view as the conversation grows.
  useEffect(() => { const box = scrollRef.current; if (box) box.scrollTop = box.scrollHeight; }, [messageCount]);
  const latestDemo = session?.messages.toReversed().map((message) => message.role === "ASSISTANT" ? readResult(message.metadata)?.demo : undefined).find(Boolean);
  const finalResult = request.status === "COMPLETED" ? readResult({ result: (request.workspaceSessions.find((item) => item.result)?.result ?? undefined) as Record<string, unknown> | undefined }) : null;
  async function generateDemo() {
    if (!onGenerateDemo) return false;
    const instruction = inputRef.current?.value.trim() ?? "";
    const outcome = await onGenerateDemo(instruction);
    if (outcome !== false && inputRef.current) inputRef.current.value = "";
    return outcome;
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "").trim();
    if (!content) return false;
    const outcome = await onSendMessage(content);
    if (outcome !== false) form.reset();
    return outcome;
  }
  return <div className={`grid gap-5 ${request.status === "AI_WORKSPACE" || request.status === "COMPLETED" ? "lg:grid-cols-[.55fr_1.45fr]" : "lg:grid-cols-[.75fr_1.25fr]"}`}>
    <Card className="p-7"><span className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs font-black">{statusLabels[request.status] ?? request.status}</span><h1 className="mt-5 text-4xl font-black tracking-[-.04em]">{request.title}</h1><dl className="mt-7 space-y-5 text-sm"><div><dt className="font-black">问题</dt><dd className="mt-2 leading-7 text-[#777166]">{request.problem}</dd></div><div><dt className="font-black">业务背景</dt><dd className="mt-2 leading-7 text-[#777166]">{request.businessContext}</dd></div><div><dt className="font-black">期望成果</dt><dd className="mt-2 leading-7 text-[#777166]">{request.expectedOutcome}</dd></div></dl></Card>
    <Card className="p-7">
      {actionError ? <p role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{actionError}</p> : null}
      {actionNotice ? <p role="status" className="mb-4 rounded-2xl bg-[#fff3bf] p-4 text-sm">{actionNotice}</p> : null}
      {request.status === "DRAFT" ? <section><h2 className="text-2xl font-black">需求诊断</h2><p className="mt-2 text-sm text-[#777166]">先由已配置的 AI 服务给出结构化诊断；服务不可用时仍可人工判断，原始需求不会丢失。</p><FeedbackButton successLabel="已提交" disabled={actionPending} onClick={() => onDiagnose("AUTO")} className="mt-6 w-full rounded-2xl bg-[#303030] p-5 text-left font-black text-white">{actionPending ? '正在进行 AI 诊断…' : '开始 AI 诊断'}</FeedbackButton><div className="mt-3 grid gap-3 sm:grid-cols-2"><FeedbackButton successLabel="已提交" disabled={actionPending} onClick={() => onDiagnose("AI")} className="rounded-2xl border border-black/10 bg-white p-4 text-left text-sm font-black">人工判断：AI 可完成</FeedbackButton><FeedbackButton successLabel="已提交" disabled={actionPending} onClick={() => onDiagnose("HUMAN")} className="rounded-2xl bg-[#ffd85f] p-4 text-left text-sm font-black">人工判断：转项目</FeedbackButton></div></section> : null}
      {request.status === "AI_WORKSPACE" && session ? <section>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">AI 工作区</h2>{onGenerateDemo ? <span className="text-xs font-bold text-[#777166]">文字成果直接看正文，要能上手用的就点「生成可用 Demo」</span> : null}</div>
        {demoPending ? <div className="fp-demo-wait" role="status"><span className="fp-demo-wait__bar" aria-hidden="true" /><strong>正在生成可用 Demo…</strong><span>AI 正在编写完整的页面和交互，通常需要 1–2 分钟，请不要关闭页面。</span></div> : null}
        {latestDemo && !demoPending ? <div className="mt-4"><DemoPreview demo={latestDemo} /></div> : null}
        <div ref={scrollRef} className="fp-chat mt-4">{session.messages.length ? session.messages.map((message) => {
          const result = message.role === "ASSISTANT" ? readResult(message.metadata) : null;
          return <article key={message.id} className={`fp-chat__msg ${message.role === "USER" ? "is-user" : "is-ai"}`}>
            <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
            {result?.content ? <div className="fp-result"><div className="fp-result__head"><strong>{result.title ?? "成果正文"}</strong><CopyButton text={result.content} /></div><ResultBody content={result.content} /></div> : null}
            {result?.demo ? <p className="mt-2 text-xs font-bold text-[#8a6a00]">已生成 Demo「{result.demo.title}」{result.demo.html === latestDemo?.html ? "，见上方预览" : ""}</p> : null}
          </article>;
        }) : <p className="py-12 text-center text-[#777166]">还没有对话消息。描述你想要的成果，或直接生成一个可用 Demo。</p>}</div>
        <FeedbackForm onSubmit={send} className="mt-4 flex flex-wrap gap-2"><input ref={inputRef} name="content" required className="h-12 min-w-0 flex-1 rounded-2xl border border-black/10 px-4" placeholder="继续补充要求，或描述 Demo 需要的功能" /><FeedbackButton successLabel="已发送" disabled={demoPending} className="rounded-2xl bg-[#303030] px-5 font-black text-white">发送</FeedbackButton>{onGenerateDemo ? <FeedbackButton type="button" successLabel="Demo 已生成" pendingLabel="正在生成 Demo…" disabled={demoPending || actionPending} onClick={generateDemo} className="inline-flex items-center gap-2 rounded-2xl bg-[#ffd85f] px-5 font-black text-[#303030]"><Sparkles size={16} aria-hidden="true" />{latestDemo ? "按要求改进 Demo" : "生成可用 Demo"}</FeedbackButton> : null}</FeedbackForm>
        <FeedbackButton successLabel="已提交" disabled={!completedAssistantMessage || demoPending} onClick={() => completedAssistantMessage && onComplete(completedAssistantMessage.id)} className="mt-3 h-12 w-full rounded-2xl border border-black/15 font-black disabled:cursor-not-allowed disabled:opacity-50">{completedAssistantMessage ? "固化当前成果" : "等待 AI 生成可固化成果"}</FeedbackButton>
      </section> : null}
      {request.status === "HUMAN_PROJECT" ? <section><h2 className="text-2xl font-black">{confirmedProject ? '项目草稿已创建' : '人工项目草稿'}</h2>{confirmedProject ? <><p className="mt-4 leading-7 text-[#777166]">项目草稿已保存，可以进入项目详情查看和继续完善。</p><Link href={`/projects/${confirmedProject.id}`} className="mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#303030] px-5 py-3 font-black text-white">查看项目草稿</Link></> : <><p className="mt-4 leading-7 text-[#777166]">建议等级 {request.diagnosis?.recommendedProjectLevel ?? "待定"}，预计 {request.diagnosis?.estimatedHours ?? "待定"} 小时。确认后才会创建项目，不会自动进入市场。</p><FeedbackButton successLabel="已创建" disabled={actionPending} onClick={onConfirmProject} className="mt-6 h-12 w-full rounded-2xl bg-[#303030] font-black text-white disabled:cursor-wait disabled:opacity-60">{actionPending ? '正在创建项目草稿…' : '确认创建项目草稿'}</FeedbackButton></>}</section> : null}
      {request.status === "COMPLETED" ? <section><h2 className="text-2xl font-black">需求已完成</h2><p className="mt-3 text-[#777166]">成果已经固化，可以继续沉淀为知识资产。</p>
        {finalResult?.demo ? <div className="mt-5"><DemoPreview demo={finalResult.demo} /></div> : null}
        {finalResult?.content ? <div className="fp-result mt-5"><div className="fp-result__head"><strong>{finalResult.title ?? "成果正文"}</strong><CopyButton text={finalResult.content} /></div><ResultBody content={finalResult.content} /></div> : null}
        <Link href="/knowledge" className="mt-6 inline-flex rounded-2xl bg-[#ffd85f] px-5 py-3 font-black">沉淀知识资产</Link></section> : null}
    </Card>
  </div>;
}


