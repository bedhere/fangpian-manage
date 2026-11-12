"use client";
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';

import { Card } from "@fangpian/ui";
import { FormEvent } from "react";
import { ConfirmAction } from "../../components/feedback/confirm-action";
export type OpportunityItem = {
  id: string;
  publisherId: string;
  title: string;
  description: string;
  valueTags: string[];
  visibility: string;
  status: string;
  deadline: string | null;
  followers: Array<unknown>;
  proposals: Array<{
    id: string;
    proposerId: string;
    title: string;
    approach: string;
    expectedValue: string;
    status: string;
  }>;
  conversion: { businessRequestId: string } | null;
};
export function OpportunityMarketView({
  currentUserId,
  items,
  onCreate,
  onFollow,
  onPropose,
  onConvert,
}: {
  currentUserId: string;
  items: OpportunityItem[];
  onCreate: (input: unknown) => unknown | Promise<unknown>;
  onFollow: (id: string, followed: boolean) => unknown | Promise<unknown>;
  onPropose: (id: string, input: unknown) => unknown | Promise<unknown>;
  onConvert: (id: string, proposalId: string) => unknown | Promise<unknown>;
}) {
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    return onCreate({
      title: d.get("title"),
      description: d.get("description"),
      valueTags: String(d.get("valueTags") ?? "")
        .split(/[，,]/)
        .map((x) => x.trim())
        .filter(Boolean),
      visibility: d.get("visibility"),
      deadline: d.get("deadline") || undefined,
    });
  }
  function propose(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    return onPropose(id, {
      title: d.get("title"),
      approach: d.get("approach"),
      expectedValue: d.get("expectedValue"),
    });
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[.7fr_1.3fr]">
      <Card className="p-6">
        <p className="text-xs font-black tracking-[.2em] text-[#8a7b50]">
          NEW OPPORTUNITY
        </p>
        <h1 className="mt-2 text-3xl font-black">发布内部机会</h1>
        <FeedbackForm onSubmit={create} className="mt-5 grid gap-3">
          <input
            name="title"
            required
            minLength={3}
            placeholder="机会标题"
            className="h-11 rounded-xl border px-3"
          />
          <textarea
            name="description"
            required
            minLength={10}
            placeholder="说明问题、线索和价值"
            className="min-h-32 rounded-xl border p-3"
          />
          <input
            name="valueTags"
            placeholder="价值标签，用逗号分隔"
            className="h-11 rounded-xl border px-3"
          />
          <select name="visibility" className="h-11 rounded-xl border px-3">
            <option value="ORGANIZATION">全组织</option>
            <option value="DEPARTMENT">本部门</option>
          </select>
          <input
            name="deadline"
            type="datetime-local"
            className="h-11 rounded-xl border px-3"
          />
          <FeedbackButton successLabel="已提交" className="h-11 rounded-xl bg-[#303030] font-black text-white">
            发布机会
          </FeedbackButton>
        </FeedbackForm>
      </Card>
      <section>
        <h2 className="text-3xl font-black">可讨论的价值线索</h2>
        <div className="mt-5 space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="p-6">
              <div className="flex justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    {item.valueTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs font-black"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-3 text-xl font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#777166]">
                    {item.description}
                  </p>
                </div>
                <FeedbackButton successLabel="已提交"
                  onClick={() => onFollow(item.id, item.followers.length === 0)}
                  className="h-10 rounded-full border px-4 text-sm font-black"
                >
                  {item.followers.length ? "取消关注" : "关注"}
                </FeedbackButton>
              </div>
              {item.publisherId !== currentUserId && item.status === "OPEN" ? (
                <FeedbackForm
                  onSubmit={(e) => propose(e, item.id)}
                  className="mt-4 grid gap-2 rounded-2xl bg-[#fff4c9] p-4"
                >
                  <input
                    name="title"
                    required
                    minLength={3}
                    placeholder="提案标题"
                    className="h-10 rounded-xl bg-white px-3"
                  />
                  <textarea
                    name="approach"
                    required
                    minLength={10}
                    placeholder="实施方法"
                    className="rounded-xl bg-white p-3"
                  />
                  <input
                    name="expectedValue"
                    required
                    minLength={5}
                    placeholder="预期价值"
                    className="h-10 rounded-xl bg-white px-3"
                  />
                  <FeedbackButton successLabel="已提交" className="h-10 rounded-xl bg-[#303030] font-black text-white">
                    提交提案
                  </FeedbackButton>
                </FeedbackForm>
              ) : null}
              {item.publisherId === currentUserId && item.proposals.length ? (
                <div className="mt-4 space-y-2">
                  {item.proposals.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-2xl bg-white p-4"
                    >
                      <span>
                        <strong>{p.title}</strong>
                        <small className="block text-[#777166]">
                          {p.expectedValue}
                        </small>
                      </span>
                      {p.status === "PENDING" ? (
                        <ConfirmAction
                          label="接受并转为需求"
                          description="确认后会创建正式业务需求，并关闭其他待处理提案。"
                          onConfirm={() => onConvert(item.id, p.id)}
                          className="rounded-full bg-[#ffd85f] px-4 py-2 text-sm font-black"
                        />
                      ) : (
                        <b>{p.status}</b>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              {item.conversion ? (
                <a
                  href={`/requests/${item.conversion.businessRequestId}`}
                  className="mt-4 inline-block font-black underline"
                >
                  查看已转换需求 →
                </a>
              ) : null}
            </Card>
          ))}
          {!items.length ? (
            <Card className="p-10 text-center">暂无可见机会</Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
