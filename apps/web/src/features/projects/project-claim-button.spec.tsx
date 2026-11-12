import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectClaimButton } from "./project-claim-button";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: { request } }));
const project = {
  id: "p1",
  title: "共享项目",
  matching: {
    employeeLevel: 3,
    requiredLevel: 2,
    specialReviewRequired: false,
  },
  applicationState: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue([project]);
});
describe("claiming from a shared project detail", () => {
  it("bounds marketplace lookup for valid long titles without splitting emoji and still matches exact ID", async () => {
    const title = "中".repeat(99) + "😀".repeat(30);
    request.mockResolvedValue([{ ...project, title }]);
    render(
      <ProjectClaimButton
        projectId="p1"
        title={title}
        status="APPLICATION_OPEN"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "领取任务" }));
    await screen.findByRole("dialog", { name: `申请承接 ${title}` });
    const url = new URL(request.mock.calls[0][0], "https://example.invalid");
    expect(url.searchParams.get("search")!.length).toBeLessThanOrEqual(100);
  });
  it("opens the existing application flow for exactly this project and only submits explicit values", async () => {
    request
      .mockResolvedValueOnce([
        { ...project, id: "other", title: "同名的其他项目" },
        project,
      ])
      .mockResolvedValueOnce({ status: "PENDING" });
    render(
      <ProjectClaimButton
        projectId="p1"
        title="共享项目"
        status="APPLICATION_OPEN"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "领取任务" }));
    await screen.findByRole("dialog", { name: "申请承接 共享项目" });
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("申请动机"), {
      target: { value: "可以完成该项目并提交验收成果" },
    });
    fireEvent.change(screen.getByLabelText("预计投入工时"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("相关经验"), {
      target: { value: "有类似项目经验" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认提交申请" }));
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(
        "/api/projects/p1/apply",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            motivation: "可以完成该项目并提交验收成果",
            estimatedHours: 8,
            relevantExperience: "有类似项目经验",
          }),
        }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "申请已提交，等待审核",
    );
    expect(screen.getByRole("button", { name: "申请审核中" })).toBeDisabled();
  });
  it("recognizes an existing application without submitting again", async () => {
    request.mockResolvedValue([{ ...project, applicationState: "PENDING" }]);
    render(
      <ProjectClaimButton projectId="p1" title="共享项目" status="PUBLISHED" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "领取任务" }));
    expect(
      await screen.findByRole("button", { name: "申请审核中" }),
    ).toBeDisabled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not pretend a project awaiting review is already claimable", () => {
    render(
      <ProjectClaimButton
        projectId="p1"
        title="共享项目"
        status="HUMAN_REQUIRED"
      />,
    );
    expect(screen.queryByRole("button", { name: "领取任务" })).toBeNull();
    expect(screen.getByText(/审核中/)).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });
});
