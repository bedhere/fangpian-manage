import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TitleCell } from "../../../team-work/src/components/TaskCells";
import { TaskDetail } from "../../../team-work/src/components/TaskDetail";
const { state, api } = vi.hoisted(() => ({
  state: {
    selectedId: "task",
    select: vi.fn(),
    refresh: vi.fn(),
    pushToast: vi.fn(),
    org: { users: [{ id: "me", name: "示例员工0101" }], departments: [], groups: [] },
  },
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock("../../../team-work/src/store/AppProvider", () => ({
  useApp: () => state,
}));
vi.mock("../../../team-work/src/api/client", () => ({ api }));
const task = {
  id: "task",
  title: "完整任务名称，点击可以进入详情",
  note: "原始工作说明",
  progress: 60,
  status: "open",
  ownerId: "me",
  creatorId: "me",
  priority: "normal",
  category: "AI",
  type: "卡点清单",
  createdAt: "2026-10-22T00:00:00Z",
} as any;
const detail = () => ({
  task: { ...task },
  children: [],
  parent: null,
  updates: [] as any[],
  permissions: {
    canEdit: true,
    canUpdateProgress: true,
    canClaim: false,
    progressHint: "",
  },
});
describe("department task detail", () => {
  it.each([['进行中',100],['未开始',50]])('shows a source conflict without replacing the original %s state', async (status,progress) => {
    const d=detail();Object.assign(d.task,{progress,sourceStatus:status,status:'open',progressConflict:true});
    api.get.mockResolvedValue(d);render(<TaskDetail/>);
    await screen.findByText('原表状态与进度存在冲突，当前保留原值，请核对后再更新。');
    expect(screen.getByText(status)).toBeVisible();
  });
  it('distinguishes missing source progress from zero and preserves the source status', async () => {
    const d = detail();Object.assign(d.task,{progress:0,progressUnspecified:true,sourceStatus:'进行中'});
    api.get.mockResolvedValue(d);render(<TaskDetail/>);
    await screen.findByText('未填');expect(screen.getByText('进行中')).toBeVisible();
    expect(screen.queryByText('未开始')).toBeNull();
  });
  it("supports loading retry and restores keyboard focus when closed", async () => {
    api.get
      .mockRejectedValueOnce(new Error("详情暂不可用"))
      .mockResolvedValueOnce(detail());
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const view = render(<TaskDetail />);
    await screen.findByText("详情暂不可用");
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    await screen.findByText("原始工作说明");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(state.select).toHaveBeenCalledWith(null);
    view.unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue(detail());
    state.refresh.mockResolvedValue(undefined);
  });
  it("opens readable titles even for users who cannot edit them", () => {
    render(<TitleCell task={task} canEdit={false} />);
    fireEvent.click(screen.getByRole("button", { name: task.title }));
    expect(state.select).toHaveBeenCalledWith(task.id);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("opens the progress form, keeps draft on failure and appends persisted result on retry", async () => {
    render(<TaskDetail />);
    await screen.findByText("原始工作说明");
    fireEvent.click(screen.getByRole("button", { name: "更新进度" }));
    fireEvent.change(screen.getByLabelText("进度百分比"), {
      target: { value: "75" },
    });
    fireEvent.change(screen.getByLabelText("进展摘要"), {
      target: { value: "完成主要功能" },
    });
    fireEvent.change(screen.getByLabelText("下一步"), {
      target: { value: "联调验证" },
    });
    fireEvent.change(screen.getByLabelText("阻塞事项（选填）"), {
      target: { value: "等待反馈" },
    });
    api.post.mockRejectedValueOnce(new Error("连接中断，请重试"));
    fireEvent.click(screen.getByRole("button", { name: "保存进展" }));
    await screen.findByText("连接中断，请重试");
    expect(screen.getByLabelText("进展摘要")).toHaveValue("完成主要功能");
    const updated = detail();
    updated.task.progress = 75;
    updated.updates = [
      {
        id: "u",
        taskId: "task",
        authorName: "示例员工0101",
        createdAt: "2026-10-22T01:00:00Z",
        progressPercent: 75,
        summary: "完成主要功能",
        nextAction: "联调验证",
        blockers: "等待反馈",
        riskLevel: 0,
      },
    ];
    api.post.mockResolvedValueOnce(updated);
    fireEvent.click(screen.getByRole("button", { name: "保存进展" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith("/api/tasks/task/progress", {
        progressPercent: 75,
        summary: "完成主要功能",
        nextAction: "联调验证",
        blockers: "等待反馈",
        riskLevel: 0,
      }),
    );
    await screen.findByText("完成主要功能");
    expect(screen.queryByRole("button", { name: "保存进展" })).toBeNull();
    expect(state.refresh).toHaveBeenCalled();
  });
  it("offers read-only summary details with child navigation instead of a progress action", async () => {
    const d = detail();
    d.permissions = {
      canEdit: false,
      canUpdateProgress: false,
      canClaim: false,
      progressHint: "主任务进度由子任务自动汇总，请进入具体子任务更新。",
    };
    d.children = [{ ...task, id: "child", title: "具体子任务" }] as any;
    api.get.mockResolvedValue(d);
    render(<TaskDetail />);
    await screen.findByText(/主任务进度由子任务/);
    expect(screen.queryByRole("button", { name: "更新进度" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /具体子任务/ }));
    expect(state.select).toHaveBeenCalledWith("child");
  });
  it("requires summary and next action and edits information without sending progress", async () => {
    render(<TaskDetail />);
    await screen.findByText("原始工作说明");
    fireEvent.click(screen.getByRole("button", { name: "更新进度" }));
    fireEvent.click(screen.getByRole("button", { name: "保存进展" }));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑任务信息" }));
    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "调整后的名称" },
    });
    api.patch.mockResolvedValue({});
    fireEvent.click(screen.getByRole("button", { name: "保存信息" }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/tasks/task", {
        title: "调整后的名称",
        note: "原始工作说明",
      }),
    );
  });
});
