import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardView, type WorkspaceBootstrap } from "./dashboard-view";

const workspace: WorkspaceBootstrap = {
  user: { id: "u1", email: "employee@example.com", displayName: "方小成", departmentName: "产品部", capabilityLevel: "L2", reputationScore: 108, roles: ["EMPLOYEE"], permissions: ["project:read"] },
  navigation: [],
  counters: { activeProjects: 2, pendingApplications: 1, unreadNotifications: 3, totalBonus: "1200.00" },
  tasks: [{ id: "p1", title: "客户洞察自动化", status: "IN_PROGRESS", deadline: "2026-10-30T00:00:00.000Z", updatedAt: "2026-10-08T00:00:00.000Z" }],
  notifications: [{ id: "n1", title: "申请已进入审核", body: "负责人将在工作台处理", entityType: "Project", entityId: "p1", createdAt: "2026-10-08T00:00:00.000Z" }],
};

describe("DashboardView", () => {
  it('opens the existing todo board and uses its task count instead of department project count', () => {
    render(<DashboardView workspace={{ ...workspace, workQueues: { myProjects: 2, myApplications: 0, pendingScores: 0, contributionDisputes: 0, riskProjects: 0, supervisedProjects: 0, departmentProjects: 3, departmentTodos: 14, skillVerifications: 0 } }} />);
    expect(screen.getByRole('link', { name: /部门待办.*14/ })).toHaveAttribute('href', '/tasks');
    expect(screen.getByRole('link', { name: '部门待办' })).toHaveAttribute('href', '/tasks');
    expect(screen.queryByRole('link', { name: /部门项目/ })).toBeNull();
  });
  it("renders real workspace counters, tasks and identity", () => {
    render(<DashboardView workspace={workspace} />);
    expect(screen.getByRole("heading", { name: /方小成/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "2" })).toBeInTheDocument();
    expect(screen.getByText("客户洞察自动化")).toBeInTheDocument();
    expect(screen.getByText("申请已进入审核")).toBeInTheDocument();
    expect(screen.getByText("¥1,200.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "发起新需求" })).toHaveAttribute("href", "/requests/new");
    expect(screen.getByRole("link", { name: '我推进的项目' })).toHaveAttribute('href', '/projects?view=OWNED');
    expect(screen.getByRole('link', { name: /客户洞察自动化/ })).toHaveAttribute('href', '/projects/p1/manage');
  });

  it("shows an honest empty state instead of placeholder tasks", () => {
    render(<DashboardView workspace={{ ...workspace, tasks: [], notifications: [] }} />);
    expect(screen.getByText("目前没有需要推进的项目")).toBeInTheDocument();
    expect(screen.getByText("暂无未读动态")).toBeInTheDocument();
  });
});
