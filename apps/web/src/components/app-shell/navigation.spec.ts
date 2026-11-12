import { describe, expect, it } from "vitest";
import { getNavigationItems, getNavigationGroups } from "./navigation";

describe("role-aware navigation", () => {
  it('places the Departments dropdown immediately after Collaboration and before Growth', () => {
    const groups = getNavigationGroups({ roles: ['EMPLOYEE'], permissions: [] });
    expect(groups.map((group) => group.id)).toEqual(['dashboard', 'work', 'opportunity', 'collab', 'departments', 'growth', 'leaderboards']);
    expect(groups.find((group) => group.id === 'departments')?.items.map(item => item.id)).toEqual(['ai-center', 'external-collab']);
  });
  it('retains the original Collaboration entries and Department Tasks without adding External Procurement there', () => {
    const collaboration = getNavigationGroups({ roles: ['EMPLOYEE'], permissions: [] }).find((group) => group.id === 'collab');
    expect(collaboration?.items.map(({ href }) => href)).toEqual(['/tasks', '/trainees', '/knowledge', '/circles', '/buffs']);
    expect(collaboration?.items[0]).toEqual({ id: 'team-tasks', label: '部门待办', href: '/tasks', description: '任务派发、甘特进度、艾维利与绩效' });
  });
  it("shows employee work areas without exposing executive or admin areas", () => {
    const items = getNavigationItems({ roles: ["EMPLOYEE"], permissions: ["project:read"] });

    expect(items.map((item) => item.id)).toEqual([
      "dashboard",
      "projects",
      "market",
      "bonuses",
      "profile",
      "capacity",
      "rankings",
      "leaderboards",
    ]);
    expect(items.find((item) => item.id === "dashboard")?.href).toBe("/dashboard");
  });

  it("adds review and executive areas from server-issued permissions", () => {
    const items = getNavigationItems({
      roles: ["OWNER"],
      permissions: ["project:read", "project:business-review", "analytics:executive"],
    });

    expect(items.map((item) => item.id)).toContain("reviews");
    expect(items.map((item) => item.id)).toContain("executive");
    expect(items.map((item) => item.id)).not.toContain("admin");
  });
});
