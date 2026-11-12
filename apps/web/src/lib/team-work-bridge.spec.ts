import { describe, expect, it } from "vitest";
import { isTeamWorkRequest, trustedTeamWorkMessage, teamAdminUrl } from "./team-work-bridge";
describe("team workspace bridge", () => {
  it("uses the cloud admin domain while retaining local development ports", () => {
    expect(teamAdminUrl('https://example.invalid')).toBe('https://example.invalid/');
    expect(teamAdminUrl('http://localhost:3100')).toBe('http://localhost:3102/');
    expect(teamAdminUrl('http://127.0.0.1:3100')).toBe('http://127.0.0.1:3102/');
  });
  it("accepts only the embedded frame on the same origin", () => {
    const frame = {} as Window;
    expect(trustedTeamWorkMessage({ origin: "https://work.test", source: frame }, frame, "https://work.test")).toBe(true);
    expect(trustedTeamWorkMessage({ origin: "https://evil.test", source: frame }, frame, "https://work.test")).toBe(false);
    expect(trustedTeamWorkMessage({ origin: "https://work.test", source: {} }, frame, "https://work.test")).toBe(false);
  });
  it("rejects outside routes, traversal, malformed and unsupported requests", () => {
    expect(isTeamWorkRequest({ type: "team-work:request", id: "1", method: "GET", path: "/api/team-work/tasks?scope=mine" })).toBe(true);
    for (const path of ["/api/team-work/settings", "/api/team-work/groups/dept-1/tags"]) expect(isTeamWorkRequest({ type: "team-work:request", id: "2", method: "PATCH", path })).toBe(true);
    for (const path of ["/api/auth/me", "/api/team-work/../admin", "/api/team-work/%2e%2e/admin", "//evil.test/api/team-work/tasks", "/api/team-work/tasks#x", "/api/team-work/"]) {
      expect(isTeamWorkRequest({ type: "team-work:request", id: "1", method: "GET", path })).toBe(false);
    }
    expect(isTeamWorkRequest({ type: "team-work:request", id: "1", method: "TRACE", path: "/api/team-work/tasks" })).toBe(false);
  });
});

