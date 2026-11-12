import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders the Fangpian identity and role-aware employee navigation", () => {
    render(
      <AppShell roles={["EMPLOYEE"]} permissions={["project:read"]}>
        <div>业务内容</div>
      </AppShell>,
    );

    expect(screen.getByAltText("方片·敢想敢成")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toHaveTextContent("机会市场");
    expect(screen.queryByText("经营驾驶舱")).not.toBeInTheDocument();
    expect(screen.getByText("业务内容")).toBeInTheDocument();
  });
});
