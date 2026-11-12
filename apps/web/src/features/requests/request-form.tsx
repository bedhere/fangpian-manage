"use client";
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';


import { FormEvent, useState } from "react";

export type BusinessRequestInput = {
  title: string;
  problem: string;
  businessContext: string;
  expectedOutcome: string;
  constraints?: string;
};

const fields = [
  { name: "problem", label: "现在遇到的问题", hint: "描述当前阻碍、重复劳动或尚未解决的矛盾" },
  { name: "businessContext", label: "业务背景", hint: "说明它发生在哪个场景、影响哪些人或指标" },
  { name: "expectedOutcome", label: "期望成果", hint: "说明完成后应该得到什么可验证的结果" },
  { name: "constraints", label: "限制与边界（选填）", hint: "例如时间、数据权限、合规或必须兼容的系统" },
] as const;

export function RequestForm({ onSubmit }: { onSubmit: (input: BusinessRequestInput) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        title: String(form.get("title") ?? ""),
        problem: String(form.get("problem") ?? ""),
        businessContext: String(form.get("businessContext") ?? ""),
        expectedOutcome: String(form.get("expectedOutcome") ?? ""),
        constraints: String(form.get("constraints") ?? "") || undefined,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "需求创建失败");
     return false; } finally {
      setBusy(false);
    }
  }

  return <FeedbackForm onSubmit={submit} className="space-y-5">
    <label className="block text-sm font-bold">需求标题<input required minLength={3} maxLength={200} name="title" className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none focus:border-black" placeholder="用一句话说清想解决什么" /></label>
    {fields.map((field) => <label key={field.name} className="block text-sm font-bold">{field.label}<textarea required={field.name !== "constraints"} minLength={field.name === "constraints" ? undefined : 5} maxLength={4000} name={field.name} className="mt-2 min-h-28 w-full rounded-2xl border border-black/10 bg-white p-4 leading-7 outline-none focus:border-black" placeholder={field.hint} /></label>)}
    {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
    <FeedbackButton successLabel="已创建" disabled={busy} className="h-12 w-full rounded-2xl bg-[#303030] font-black text-white transition hover:bg-black disabled:opacity-60">{busy ? "正在创建…" : "创建并开始诊断"}</FeedbackButton>
  </FeedbackForm>;
}
