import { describe, expect, it } from "vitest";
import { notificationHref } from "./notification-bell";
describe("notification destinations", () => {
  it("makes assignment and reminder notifications open the shared team workspace", () => {
    expect(notificationHref({ entityType: "TEAM_TASK", entityId: "assignment-1" })).toBe("/tasks");
    expect(notificationHref({ entityType: "TEAM_TASK", entityId: "reminder-2" })).toBe("/tasks");
  });
  it("preserves existing project destinations and ignores unsupported entities", () => {
    expect(notificationHref({ entityType: "Project", entityId: "project-1" })).toBe("/projects/project-1");
    expect(notificationHref({ entityType: "unknown", entityId: "1" })).toBeNull();
    expect(notificationHref({ entityType: "TEAM_TASK", entityId: null })).toBeNull();
  });
});
