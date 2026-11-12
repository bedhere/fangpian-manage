import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequestDetailView, type BusinessRequestDetail } from "./request-detail-view";

const base: BusinessRequestDetail = {
  id: "r1", title: "整理竞品资料", problem: "资料分散", businessContext: "季度分析",
  expectedOutcome: "结构化报告", constraints: null, status: "DRAFT", diagnosis: null,
  linkedProject: null, workspaceSessions: [],
};

describe("RequestDetailView", () => {
  it('shows immediate AI diagnosis feedback and prevents repeated clicks', () => {
    render(<RequestDetailView request={base} actionPending onDiagnose={vi.fn()} onSendMessage={vi.fn()} onComplete={vi.fn()} onConfirmProject={vi.fn()} />);
    expect(screen.getByRole('button', { name: '正在进行 AI 诊断…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '人工判断：转项目' })).toBeDisabled();
  });
  it("offers real AI diagnosis first while retaining explicit manual continuation", () => {
    const diagnose = vi.fn();
    render(<RequestDetailView request={base} onDiagnose={diagnose} onSendMessage={vi.fn()} onComplete={vi.fn()} onConfirmProject={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "开始 AI 诊断" }));
    expect(diagnose).toHaveBeenCalledWith("AUTO");
    expect(screen.getByRole("button", { name: "人工判断：AI 可完成" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "人工判断：转项目" })).toBeInTheDocument();
  });

  it("renders persisted messages and completion action for an active workspace", () => {
    render(<RequestDetailView request={{ ...base, status: "AI_WORKSPACE", workspaceSessions: [{ id: "s1", status: "ACTIVE", result: null, messages: [{ id: "m1", role: "USER", content: "请生成表格", createdAt: "2026-10-08" }, { id: "m2", role: "ASSISTANT", content: "表格已生成", createdAt: "2026-10-08", metadata: { result: { summary: "成果" } } }] }] }} onDiagnose={vi.fn()} onSendMessage={vi.fn()} onComplete={vi.fn()} onConfirmProject={vi.fn()} />);
    expect(screen.getByText("请生成表格")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "固化当前成果" })).toBeInTheDocument();
  });

  it("does not allow completion before the server has generated an AI result", () => {
    render(<RequestDetailView request={{ ...base, status: "AI_WORKSPACE", workspaceSessions: [{ id: "s1", status: "ACTIVE", result: null, messages: [{ id: "m1", role: "USER", content: "请生成表格", createdAt: "2026-10-08" }] }] }} onDiagnose={vi.fn()} onSendMessage={vi.fn()} onComplete={vi.fn()} onConfirmProject={vi.fn()} />);
    expect(screen.getByRole("button", { name: "等待 AI 生成可固化成果" })).toBeDisabled();
  });

  it("offers explicit project confirmation only on the human route", () => {
    render(<RequestDetailView request={{ ...base, status: "HUMAN_PROJECT", diagnosis: { recommendedProjectLevel: "P2", estimatedHours: 20 } }} onDiagnose={vi.fn()} onSendMessage={vi.fn()} onComplete={vi.fn()} onConfirmProject={vi.fn()} />);
    expect(screen.getByRole("button", { name: "确认创建项目草稿" })).toBeInTheDocument();
  });
  it('links to the submitted project instead of offering duplicate confirmation', () => {
    render(<RequestDetailView request={{ ...base, status: 'HUMAN_PROJECT', linkedProject: { id: 'p1', title: '整理竞品资料', status: 'HUMAN_REQUIRED' } }} onDiagnose={vi.fn()} onSendMessage={vi.fn()} onComplete={vi.fn()} onConfirmProject={vi.fn()} />);
    expect(screen.getByRole('link', { name: '查看项目草稿' })).toHaveAttribute('href', '/projects/p1');
    expect(screen.queryByRole('button', { name: '确认创建项目草稿' })).not.toBeInTheDocument();
  });
  it('allows a legacy draft to be submitted without creating a duplicate', () => {
    const confirm = vi.fn();
    render(<RequestDetailView request={{ ...base, status: 'HUMAN_PROJECT', linkedProject: { id: 'p1', title: '整理竞品资料', status: 'DRAFT' } }} onDiagnose={vi.fn()} onSendMessage={vi.fn()} onComplete={vi.fn()} onConfirmProject={confirm} />);
    fireEvent.click(screen.getByRole('button', { name: '确认创建项目草稿' }));
    expect(confirm).toHaveBeenCalledOnce();
  });
  it('prevents repeated confirmation while saving and shows action errors', () => {
    render(<RequestDetailView request={{ ...base, status: 'HUMAN_PROJECT' }} actionPending actionError="创建失败，请重试" onDiagnose={vi.fn()} onSendMessage={vi.fn()} onComplete={vi.fn()} onConfirmProject={vi.fn()} />);
    expect(screen.getByRole('button', { name: '正在创建项目草稿…' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('创建失败，请重试');
  });
});
