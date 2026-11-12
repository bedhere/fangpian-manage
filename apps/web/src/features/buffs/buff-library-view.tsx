"use client";
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';

import { Card } from "@fangpian/ui";
import { FormEvent } from "react";
import { ConfirmAction } from "../../components/feedback/confirm-action";
export type BuffItem = {
  id: string;
  authorId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  permissionCodes: string[];
  versions: Array<{ id: string; version: number; inputSchema: unknown }>;
  runs: Array<{ id: string; status: string; output?: unknown; error?: string }>;
};
export function BuffLibraryView({
  currentUserId,
  buffs,
  onCreate,
  onPublish,
  onRun,
}: {
  currentUserId: string;
  buffs: BuffItem[];
  onCreate: (x: unknown) => unknown | Promise<unknown>;
  onPublish: (id: string) => unknown | Promise<unknown>;
  onRun: (id: string, input: Record<string, unknown>) => unknown | Promise<unknown>;
}) {
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    return onCreate({
      knowledgeAssetId: d.get("knowledgeAssetId"),
      name: d.get("name"),
      description: d.get("description"),
      type: d.get("type"),
      permissionCodes: [],
      instructions: d.get("instructions"),
      inputSchema: JSON.parse(String(d.get("inputSchema"))),
    });
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[.7fr_1.3fr]">
      <Card className="p-6">
        <h1 className="text-3xl font-black">创建 AI Buff</h1>
        <p className="mt-2 text-sm text-[#777166]">
          仅可关联已完成业务与技术双审的知识资产。
        </p>
        <FeedbackForm onSubmit={create} className="mt-5 grid gap-3">
          <input
            name="knowledgeAssetId"
            required
            placeholder="已发布知识资产 ID"
            className="h-11 rounded-xl border px-3"
          />
          <input
            name="name"
            required
            minLength={2}
            placeholder="Buff 名称"
            className="h-11 rounded-xl border px-3"
          />
          <input
            name="description"
            required
            minLength={5}
            placeholder="用途说明"
            className="h-11 rounded-xl border px-3"
          />
          <select name="type" className="h-11 rounded-xl border px-3">
            <option>PROMPT</option>
            <option>AGENT</option>
            <option>WORKFLOW</option>
            <option>TOOL</option>
          </select>
          <textarea
            name="instructions"
            required
            minLength={5}
            placeholder="执行指令"
            className="min-h-24 rounded-xl border p-3"
          />
          <textarea
            name="inputSchema"
            required
            defaultValue={'{"type":"object","required":["text"]}'}
            className="min-h-20 rounded-xl border p-3"
          />
          <FeedbackButton successLabel="已创建" className="h-11 rounded-xl bg-[#303030] font-black text-white">
            创建 Buff 草稿
          </FeedbackButton>
        </FeedbackForm>
      </Card>
      <section>
        <h2 className="text-3xl font-black">可复用能力包</h2>
        <div className="mt-5 space-y-4">
          {buffs.map((b) => (
            <Card key={b.id} className="p-6">
              <div className="flex justify-between">
                <div>
                  <span className="text-xs font-black text-[#8a7b50]">
                    {b.type} · V{b.versions[0]?.version ?? 0} · {b.status}
                  </span>
                  <h3 className="mt-2 text-xl font-black">{b.name}</h3>
                  <p className="mt-2 text-sm text-[#777166]">{b.description}</p>
                </div>
                {b.authorId === currentUserId && b.status === "DRAFT" ? (
                  <ConfirmAction
                    slide
                    label="发布"
                    description="发布后所有具备所需权限的组织成员都可运行此版本。"
                    onConfirm={() => onPublish(b.id)}
                    className="rounded-full bg-[#ffd85f] px-4 py-2 text-sm font-black"
                  />
                ) : null}
              </div>
              {b.status === "PUBLISHED" ? (
                <FeedbackForm
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    return onRun(b.id, JSON.parse(String(d.get("input"))));
                  }}
                  className="mt-4 grid gap-2"
                >
                  <textarea
                    aria-label={`${b.name}输入`}
                    name="input"
                    required
                    defaultValue={'{"text":""}'}
                    className="min-h-20 rounded-xl border p-3"
                  />
                  <FeedbackButton successLabel="已提交运行" className="h-10 rounded-xl bg-[#303030] font-black text-white">
                    运行{b.name}
                  </FeedbackButton>
                </FeedbackForm>
              ) : null}
              <div className="mt-3 space-y-2">
                {b.runs.map((r) => (
                  <div key={r.id} className="rounded-xl bg-white p-3 text-sm">
                    <b>{r.status}</b>
                    {r.error ? (
                      <span className="ml-2 text-red-700">
                        {r.error} · 可改走人工流程
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
