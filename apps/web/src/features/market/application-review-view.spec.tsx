import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationReviewView } from "./application-review-view";

const applications = [
  {
    id: "regular-id",
    status: "PENDING",
    motivation: "能按计划交付",
    estimatedHours: "20",
    relevantExperience: "完成过类似项目",
    matchingScore: "86",
    matchingBreakdown: { components: { skills: 90, capacity: 80 } },
    specialReviewReason: null,
    applicant: {
      displayName: "员工甲",
      profile: { capabilityLevel: "L3", reputationScore: 82 },
      skills: [{ skill: { name: "AI应用" }, proficiency: 4 }],
    },
  },
  {
    id: "special-id",
    status: "SPECIAL_CAPABILITY_REVIEW",
    motivation: "希望挑战更高等级任务",
    estimatedHours: "28",
    relevantExperience: "具备相关行业经验",
    matchingScore: "72",
    matchingBreakdown: { components: { skills: 80, capacity: 100 } },
    specialReviewReason: "能力等级 L2 低于要求 L3",
    applicant: {
      displayName: "员工乙",
      profile: { capabilityLevel: "L2", reputationScore: 78 },
      skills: [{ skill: { name: "数据分析" }, proficiency: 3 }],
    },
  },
];

describe("ApplicationReviewView", () => {
  it("keeps a rejected API request in the retry state rather than reporting success", async () => {
    render(<ApplicationReviewView applications={applications} onDecide={vi.fn().mockRejectedValue(new Error('拒绝提交失败'))} />);
    fireEvent.click(screen.getByRole('button', { name: '拒绝员工甲' }));
    expect(await screen.findByRole('button', { name: '未完成，请重试' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('拒绝提交失败');
  });
  it("uses an explicit special approval action for a capability-gap candidate", async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<ApplicationReviewView applications={applications} onDecide={onDecide} />);

    expect(screen.getByText("能力等级 L2 低于要求 L3")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("slider", { name: "滑动特殊批准并指派员工乙" }), { key: "End" });

    await waitFor(() =>
      expect(onDecide).toHaveBeenCalledWith("special-id", "SPECIAL_APPROVED"),
    );
  });
});
