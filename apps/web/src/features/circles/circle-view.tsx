"use client";
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';

import { Card } from "@fangpian/ui";
import { FormEvent } from "react";
import { ConfirmAction } from "../../components/feedback/confirm-action";
export type CircleItem = {
  id: string;
  ownerId: string;
  title: string;
  topic: string;
  visibility: string;
  status: string;
  members: Array<{ userId: string }>;
  joinRequests: Array<{
    id: string;
    applicantId: string;
    status: string;
    message?: string;
  }>;
  discussions: Array<{
    id?: string;
    authorId: string;
    content: string;
    createdAt?: string;
  }>;
};
export function CircleView({
  currentUserId,
  circles,
  onCreate,
  onApply,
  onReview,
  onDiscuss,
  onKnowledge,
  onClose,
}: {
  currentUserId: string;
  circles: CircleItem[];
  onCreate: (x: unknown) => unknown | Promise<unknown>;
  onApply: (id: string) => unknown | Promise<unknown>;
  onReview: (id: string, rid: string, d: "APPROVED" | "REJECTED") => unknown | Promise<unknown>;
  onDiscuss: (id: string, c: string) => unknown | Promise<unknown>;
  onKnowledge: (id: string, x: { title: string; summary: string }) => unknown | Promise<unknown>;
  onClose: (id: string) => unknown | Promise<unknown>;
}) {
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    return onCreate({
      title: d.get("title"),
      topic: d.get("topic"),
      visibility: d.get("visibility"),
    });
  }
  return (
    <div>
      <Card className="p-6">
        <h1 className="text-3xl font-black">发起临时圈子</h1>
        <FeedbackForm onSubmit={create} className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            name="title"
            required
            minLength={3}
            placeholder="圈子名称"
            className="h-11 rounded-xl border px-3"
          />
          <input
            name="topic"
            required
            minLength={10}
            placeholder="探索主题"
            className="h-11 rounded-xl border px-3"
          />
          <select name="visibility" className="h-11 rounded-xl border px-3">
            <option value="ORGANIZATION">全组织</option>
            <option value="DEPARTMENT">本部门</option>
            <option value="MEMBERS">仅成员</option>
          </select>
          <FeedbackButton successLabel="已创建" className="h-11 rounded-xl bg-[#303030] font-black text-white md:col-span-3">
            创建圈子
          </FeedbackButton>
        </FeedbackForm>
      </Card>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {circles.map((c) => {
          const member = c.members.some((m) => m.userId === currentUserId);
          const owner = c.ownerId === currentUserId;
          return (
            <Card key={c.id} className="p-6">
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-black">{c.title}</h2>
                  <p className="mt-1 text-sm text-[#777166]">
                    {c.topic} · {c.members.length} 人
                  </p>
                </div>
                {owner ? (
                  <ConfirmAction
                    slide
                    label="关闭"
                    description="关闭后圈子将停止接收申请和新协作。"
                    onConfirm={() => onClose(c.id)}
                    className="text-sm underline"
                  />
                ) : !member ? (
                  <FeedbackButton successLabel="已提交"
                    onClick={() => onApply(c.id)}
                    className="rounded-full bg-[#ffd85f] px-4 py-2 text-sm font-black"
                  >
                    申请加入
                  </FeedbackButton>
                ) : null}
              </div>
              {owner &&
                c.joinRequests
                  .filter((r) => r.status === "PENDING")
                  .map((r) => (
                    <div
                      key={r.id}
                      className="mt-3 flex justify-between rounded-xl bg-[#fff4c9] p-3"
                    >
                      <span>成员申请 {r.applicantId}</span>
                      <span>
                        <FeedbackButton successLabel="已提交"
                          onClick={() => onReview(c.id, r.id, "REJECTED")}
                        >
                          拒绝
                        </FeedbackButton>
                        <FeedbackButton successLabel="已提交"
                          onClick={() => onReview(c.id, r.id, "APPROVED")}
                          className="ml-3 font-black"
                        >
                          通过
                        </FeedbackButton>
                      </span>
                    </div>
                  ))}
              {member ? (
                <>
                  <div className="mt-4 max-h-48 space-y-2 overflow-auto">
                    {c.discussions.map((d, i) => (
                      <p
                        key={d.id ?? i}
                        className="rounded-xl bg-white p-3 text-sm"
                      >
                        {d.content}
                      </p>
                    ))}
                  </div>
                  <FeedbackForm
                    onSubmit={(e) => {
                      e.preventDefault();
                      const d = new FormData(e.currentTarget);
                      return onDiscuss(c.id, String(d.get("content")));
                    }}
                    className="mt-3 flex gap-2"
                  >
                    <input
                      aria-label="讨论内容"
                      name="content"
                      required
                      className="h-10 flex-1 rounded-xl border px-3"
                    />
                    <FeedbackButton successLabel="已发送" className="rounded-xl bg-[#303030] px-4 text-sm font-black text-white">
                      发送讨论
                    </FeedbackButton>
                  </FeedbackForm>
                  <FeedbackButton successLabel="已提交"
                    onClick={() =>
                      onKnowledge(c.id, {
                        title: `${c.title}复盘`,
                        summary: c.topic,
                      })
                    }
                    className="mt-3 rounded-full bg-[#ffd85f] px-4 py-2 text-sm font-black"
                  >
                    沉淀知识草稿
                  </FeedbackButton>
                </>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
