import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectShareButton } from "./project-share-button";
const writeText = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: undefined,
  });
});
describe("project card sharing", () => {
  it("uses the selected link as a browser copy fallback when clipboard permission is unavailable", async () => {
    const copy = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: copy,
    });
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<ProjectShareButton projectId="p3" title="兼容复制" />);
    fireEvent.click(screen.getByRole("button", { name: "转发分享：兼容复制" }));
    expect(await screen.findByRole("status")).toHaveTextContent("链接已复制");
    expect(copy).toHaveBeenCalledWith("copy");
  });
  it("copies the exact project detail link and confirms it in a visible sharing dialog", async () => {
    render(<ProjectShareButton projectId="p1" title="示例品牌内容全量爬取" />);
    fireEvent.click(
      screen.getByRole("button", { name: "转发分享：示例品牌内容全量爬取" }),
    );
    const url = location.origin + "/projects/p1";
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    expect(screen.getByRole("textbox", { name: "项目链接" })).toHaveValue(url);
    expect(await screen.findByRole("status")).toHaveTextContent("链接已复制");
    expect(screen.getByText("示例品牌内容全量爬取")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps a selectable link when clipboard access fails, allowing retry without navigating", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<ProjectShareButton projectId="p2" title="另一个项目" />);
    fireEvent.click(
      screen.getByRole("button", { name: "转发分享：另一个项目" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("手动复制");
    const input = screen.getByRole("textbox", {
      name: "项目链接",
    }) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(location.origin + "/projects/p2");
    fireEvent.click(screen.getByRole("button", { name: "复制链接" }));
    expect(await screen.findByRole("status")).toHaveTextContent("链接已复制");
    expect(writeText).toHaveBeenCalledTimes(2);
  });
});
