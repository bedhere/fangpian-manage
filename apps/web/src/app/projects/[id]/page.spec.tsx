import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailPage from "./page";
const { params, request } = vi.hoisted(() => ({
  params: { id: "a" },
  request: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => params }));
vi.mock("@/lib/api", () => ({ apiClient: { request } }));
vi.mock("@/features/execution/execution-page", () => ({
  ExecutionPage: () => null,
}));
vi.mock("@/features/projects/project-claim-button", () => ({
  ProjectClaimButton: ({ projectId }: { projectId: string }) => (
    <button>领取{projectId}</button>
  ),
}));
const fixture = (id: string) => ({
  id,
  title: `项目${id}`,
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
});
beforeEach(() => {
  params.id = "a";
  vi.clearAllMocks();
});
describe("shared project route loading", () => {
  it("never shows an old project or claim action when requests resolve out of order", async () => {
    let old!: (value: unknown) => void;
    request.mockImplementation((path: string) =>
      path.endsWith("/a")
        ? new Promise((resolve) => {
            old = resolve;
          })
        : Promise.resolve(fixture("b")),
    );
    const view = render(<ProjectDetailPage />);
    params.id = "b";
    view.rerender(<ProjectDetailPage />);
    await screen.findByRole("heading", { name: "项目b" });
    await act(async () => old(fixture("a")));
    expect(screen.getByRole("heading", { name: "项目b" })).toBeVisible();
    expect(screen.getByRole("button", { name: "领取b" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "项目a" })).toBeNull();
  });
});
