import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageState } from "./page-state";

describe("PageState", () => {
  it.each([
    ["正在加载", "正在获取最新数据"],
    ["暂时没有内容", "新内容出现后会显示在这里"],
    ["加载失败", "请稍后重试"],
  ])("renders accessible state: %s", (title, description) => {
    render(<PageState title={title} description={description} />);
    expect(screen.getByRole("status")).toHaveTextContent(title);
    expect(screen.getByRole("status")).toHaveTextContent(description);
  });
});
