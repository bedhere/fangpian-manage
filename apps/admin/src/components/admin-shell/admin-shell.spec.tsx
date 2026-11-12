import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminShell } from "./admin-shell";

describe("AdminShell", () => {
  it("separates platform governance from the employee application", () => {
    render(<AdminShell><div>治理内容</div></AdminShell>);

    expect(screen.getByText("管理控制台")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "后台导航" })).toHaveTextContent("审计日志");
    expect(screen.getByText("治理内容")).toBeInTheDocument();
  });
});
