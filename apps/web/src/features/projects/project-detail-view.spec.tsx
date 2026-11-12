import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectDetailView } from "./project-detail-view";

describe("ProjectDetailView", () => {
  it("keeps claiming available in the actions card without requiring previous approval records", () => {
    render(
      <ProjectDetailView
        project={{
          id: "p1",
          title: "开放项目",
          description: "",
          businessProblem: "",
          expectedResult: "",
          acceptanceCriteria: "",
          status: "APPLICATION_OPEN",
          version: 1,
          projectLevel: "P2",
          requiredCapabilityLevel: "L2",
          estimatedHours: null,
          approvedHours: null,
          publisher: { displayName: "员工" },
          publisherDepartment: { name: "部门" },
          owner: null,
          approvals: [],
          aiAssessments: [],
          allowedActions: [],
        }}
        onResubmit={vi.fn()}
        claim={<button>领取任务</button>}
      />,
    );
    expect(
      within(screen.getByRole("complementary")).getByRole("button", {
        name: "领取任务",
      }),
    ).toBeVisible();
  });
  it("shows the progress timeline before owner assignment and does not gate it on execution actions", () => {
    render(
      <ProjectDetailView
        project={{
          id: "p1",
          title: "待审核项目",
          description: "",
          businessProblem: "",
          expectedResult: "",
          acceptanceCriteria: "",
          status: "TECH_REVIEW",
          version: 1,
          projectLevel: "P2",
          requiredCapabilityLevel: "L2",
          estimatedHours: "20",
          approvedHours: null,
          publisher: { displayName: "示例员工0101" },
          publisherDepartment: { name: "AI中台" },
          owner: null,
          approvals: [],
          aiAssessments: [],
          allowedActions: [],
        }}
        onResubmit={vi.fn()}
        timeline={
          <section>
            <h2>项目进度时间轴</h2>
            <p>项目开始</p>
          </section>
        }
      />,
    );
    expect(
      screen.getByRole("heading", { name: "项目进度时间轴" }),
    ).toBeInTheDocument();
    expect(screen.getByText("项目开始")).toBeInTheDocument();
  });
  it("shows only actions authorized by the API", () => {
    render(
      <ProjectDetailView
        project={{
          id: "p1",
          title: "客户资料自动整理",
          description: "减少重复工作",
          businessProblem: "人工录入",
          expectedResult: "自动整理",
          acceptanceCriteria: "抽样通过",
          status: "HUMAN_REQUIRED",
          version: 2,
          projectLevel: "P2",
          requiredCapabilityLevel: "L3",
          estimatedHours: "20",
          approvedHours: null,
          publisher: { displayName: "员工一" },
          publisherDepartment: { name: "销售部" },
          owner: null,
          approvals: [],
          aiAssessments: [],
          allowedActions: ["RESUBMIT"],
        }}
        onResubmit={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "重新提交审核" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /业务审核/ }),
    ).not.toBeInTheDocument();
  });

  it("links an authorized reviewer to applicant comparison", () => {
    render(
      <ProjectDetailView
        project={{
          id: "p1",
          title: "客户资料自动整理",
          description: "减少重复工作",
          businessProblem: "人工录入",
          expectedResult: "自动整理",
          acceptanceCriteria: "抽样通过",
          status: "APPLICATION_OPEN",
          version: 3,
          projectLevel: "P2",
          requiredCapabilityLevel: "L3",
          estimatedHours: "20",
          approvedHours: "20",
          publisher: { displayName: "员工一" },
          publisherDepartment: { name: "销售部" },
          owner: null,
          approvals: [],
          aiAssessments: [],
          allowedActions: ["REVIEW_APPLICATIONS"],
        }}
        onResubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("link", { name: "查看并比较申请人" }),
    ).toHaveAttribute("href", "/projects/p1/applications");
  });
});
