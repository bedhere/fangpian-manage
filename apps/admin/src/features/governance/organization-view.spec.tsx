import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrganizationView } from "./organization-view";

describe("OrganizationView", () => {
  it("renders real users and departments returned by governance APIs", async () => {
    sessionStorage.setItem("valueflow_admin_token", "token");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "u1", displayName: "方小成", email: "a@example.com", status: "ACTIVE", department: { name: "产品部" }, roles: [{ role: { code: "EMPLOYEE" } }] }], total: 1, page: 1, pageSize: 50 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "d1", name: "产品部", code: "PRODUCT", status: "ACTIVE", head: null, _count: { members: 1 } }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "r1", name: "员工", code: "EMPLOYEE" }] }));
    render(<OrganizationView />);
    expect(await screen.findByText("方小成")).toBeInTheDocument();
    expect(screen.getAllByText("产品部").length).toBeGreaterThan(0);
    expect(screen.getByRole("slider", { name: "滑动暂停成员" })).toBeInTheDocument();
  });
});
