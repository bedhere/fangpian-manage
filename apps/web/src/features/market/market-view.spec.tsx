import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketView, type MarketProject } from "./market-view";

const project: MarketProject = {
  id: "project-id",
  title: "销售线索自动分级",
  description: "减少销售团队重复筛选工作。",
  projectLevel: "P2",
  estimatedHours: "20",
  deadline: "2026-12-31T00:00:00.000Z",
  publisherDepartment: { name: "销售部" },
  requiredSkills: [{ skill: { name: "AI应用" } }],
  _count: { applications: 2 },
  matching: {
    score: 82,
    specialReviewRequired: false,
    employeeLevel: 3,
    requiredLevel: 2,
    components: {
      skills: 100,
      capability: 100,
      successRate: 50,
      similarExperience: 0,
      capacity: 80,
      reputation: 80,
    },
  },
  estimatedBonus: 5000,
  applicationState: null,
};

describe("MarketView", () => {
  it("opens a real form and submits the applicant's own values", async () => {
    const onApply = vi.fn().mockResolvedValue({ status: "PENDING" });
    render(<MarketView projects={[project]} onApply={onApply} />);

    fireEvent.click(screen.getByRole("button", { name: "申请承接" }));
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("申请动机"), {
      target: { value: "我能将现有销售流程自动化并提供可验证结果。" },
    });
    fireEvent.change(screen.getByLabelText("预计投入工时"), {
      target: { value: "32" },
    });
    fireEvent.change(screen.getByLabelText("相关经验"), {
      target: { value: "负责过两次销售线索评分项目。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认提交申请" }));

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith("project-id", {
        motivation: "我能将现有销售流程自动化并提供可验证结果。",
        estimatedHours: 32,
        relevantExperience: "负责过两次销售线索评分项目。",
        note: undefined,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "申请已提交，等待审核",
    );
  });

  it("shows matching facts and prevents a duplicate active application", () => {
    render(<MarketView projects={[{ ...project, applicationState: "PENDING" }]} onApply={vi.fn()} />);

    expect(screen.getByText("预计奖金 ¥5,000")).toBeInTheDocument();
    expect(screen.getByText("产能 80%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "申请审核中" })).toBeDisabled();
  });

  it("filters marketplace cards by search, project level and capability outcome", () => {
    render(<MarketView projects={[
      project,
      {
        ...project,
        id: "project-l4",
        title: "高级预测模型",
        projectLevel: "P0",
        matching: { ...project.matching, requiredLevel: 4, specialReviewRequired: true },
      },
    ]} onApply={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("搜索项目"), { target: { value: "高级" } });
    expect(screen.queryByText("销售线索自动分级")).not.toBeInTheDocument();
    expect(screen.getByText("高级预测模型")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("匹配情况"), { target: { value: "STANDARD" } });
    expect(screen.queryByText("高级预测模型")).not.toBeInTheDocument();
  });
});
