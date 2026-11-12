import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WecomPanel } from "../../../team-work/src/components/WecomPanel";
const { get, post, refresh } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../../../team-work/src/api/client", () => ({ api: { get, post } }));
vi.mock("../../../team-work/src/store/AppProvider", () => ({
  useApp: () => ({ refresh }),
}));
const preview = {
  previewId: "p",
  mode: "import",
  documentName: "副本-吉米的项目进度甘特图",
  sheetTitle: "卡点清单",
  fields: [{ field_id: "title", field_title: "任务", field_type: "text" }],
  mapping: { title: "title" },
  departmentMap: {},
  platformDepartments: [],
  departments: ["AI"],
  skipped: 1,
  rows: [
    {
      recordId: "r",
      title: "真实任务完整标题",
      project: "项目甲",
      department: "AI",
      departmentId: "ai",
      ownerName: "示例员工0654",
      progress: 80,
      sourceStatus: "已完成",
      conflict: true,
      priority: "high",
      warnings: ["状态与进度冲突，按原值保留"],
      error: "",
      boundTaskId: null,
      candidates: [],
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({
    authorized: true,
    canImport: true,
    documentName: "副本-吉米的项目进度甘特图",
    url: "https://doc.weixin.qq.com/smartsheet/s3_doc?tab=tab",
  });
  post.mockResolvedValue(preview);
  refresh.mockResolvedValue(undefined);
});
describe("WeCom panel review flow", () => {
  it("shows the document separately from its worksheet and requires explicit record selection before import", async () => {
    render(<WecomPanel onClose={() => {}} />);
    await screen.findByText("副本-吉米的项目进度甘特图");
    fireEvent.click(screen.getByRole("button", { name: "读取预览" }));
    await screen.findByText("内部工作表：卡点清单");
    expect(screen.getByText("真实任务完整标题")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "确认导入 / 关联（0）" }),
    ).toBeDisabled();
    expect(post).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "选择真实任务完整标题" }),
    );
    post.mockResolvedValueOnce({ created: 1, linked: 0, updated: 0 });
    fireEvent.click(
      screen.getByRole("button", { name: "确认导入 / 关联（1）" }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(
        "/api/team-work/tasks/wecom/import",
        {
          previewId: "p",
          choices: [{ recordId: "r", action: "create", project: "项目甲" }],
        },
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("新增1条");
  });
  it("makes changed mappings invalidate selection and blocks accidental reuse of a preview", async () => {
    render(<WecomPanel onClose={() => {}} />);
    await screen.findByText("副本-吉米的项目进度甘特图");
    fireEvent.click(screen.getByRole("button", { name: "读取预览" }));
    await screen.findByText("内部工作表：卡点清单");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "选择真实任务完整标题" }),
    );
    fireEvent.change(screen.getByLabelText("任务标题字段"), {
      target: { value: "" },
    });
    expect(
      screen.getByRole("button", { name: "确认导入 / 关联（0）" }),
    ).toBeDisabled();
    expect(screen.getByText("映射已更改，请重新读取预览。")).toBeVisible();
  });
  it("ordinary members only receive writeback mode and can never launch a source import preview", async () => {
    get.mockResolvedValue({
      authorized: true,
      canImport: false,
      documentName: "副本-吉米的项目进度甘特图",
      url: "",
    });
    render(<WecomPanel onClose={() => {}} />);
    await screen.findByText("副本-吉米的项目进度甘特图");
    expect(screen.queryByRole("button", { name: "从企微导入" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "读取预览" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/team-work/tasks/wecom/preview",
        expect.objectContaining({ mode: "export" }),
      ),
    );
  });
});
