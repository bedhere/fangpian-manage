import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeView, type KnowledgeAsset } from "./knowledge-view";

const assets: KnowledgeAsset[] = [
  { id: "a1", title: "竞品分析方法", summary: "可复用的分析流程", status: "DRAFT", authorId: "u1", author: { displayName: "方小成" }, updatedAt: "2026-10-08", reviews: [] },
  { id: "a2", title: "需求访谈清单", summary: "业务访谈模板", status: "BUSINESS_REVIEW", authorId: "u2", author: { displayName: "方小敢" }, updatedAt: "2026-10-08", reviews: [] },
];

describe("KnowledgeView", () => {
  it("shows real assets and only exposes actions allowed by identity and permission", () => {
    render(<KnowledgeView assets={assets} currentUserId="u1" permissions={["project:business-review"]} onCreate={vi.fn()} onSubmit={vi.fn()} onReview={vi.fn()} />);
    expect(screen.getByText("竞品分析方法")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交审核" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "滑动通过业务审核" })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "滑动通过技术审核" })).not.toBeInTheDocument();
  });

  it("submits a structured knowledge draft", () => {
    const create = vi.fn();
    render(<KnowledgeView assets={[]} currentUserId="u1" permissions={[]} onCreate={create} onSubmit={vi.fn()} onReview={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("知识标题"), { target: { value: "竞品分析方法" } });
    fireEvent.change(screen.getByLabelText("知识摘要"), { target: { value: "可复用的竞品分析流程" } });
    fireEvent.change(screen.getByLabelText("知识正文"), { target: { value: "第一步收集资料，第二步统一维度。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存知识草稿" }));
    expect(create).toHaveBeenCalledWith({ title: "竞品分析方法", summary: "可复用的竞品分析流程", content: { text: "第一步收集资料，第二步统一维度。" }, assetType: "PLAYBOOK" });
  });
});
