import { describe, expect, it } from "vitest";
import {
  projectShareUrl,
  safeProjectReturn,
  projectLoginUrl,
  loginDestination,
  safeLoginReturn,
} from "./project-links";
describe("project links and login return", () => {
  it("shares the detail path without credentials, query filters or the owner management route", () => {
    expect(projectShareUrl("https://example.invalid", "p-123")).toBe(
      "https://example.invalid/projects/p-123",
    );
    expect(() => projectShareUrl("https://example.invalid", "../admin")).toThrow();
    expect(projectLoginUrl("/projects/p-123")).toBe(
      "/?next=%2Fprojects%2Fp-123",
    );
  });
  it("only accepts a local project detail path as a return target", () => {
    expect(safeProjectReturn("/projects/p-123")).toBe("/projects/p-123");
    for (const value of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/projects/%2f%2fevil.test",
      "/projects/p1/../../admin",
      "/projects/p1?next=https://evil.test",
      "/projects/p1\n",
      "/projects/p1/manage",
      null,
    ])
      expect(safeProjectReturn(value)).toBeNull();
  });
  it("retains the shared project through login and mandatory password change, with a safe normal fallback", () => {
    expect(loginDestination("?next=%2Fprojects%2Fp1", false)).toBe(
      "/projects/p1",
    );
    expect(loginDestination("?next=%2Fprojects%2Fp1", true)).toBe(
      "/change-password?next=%2Fprojects%2Fp1",
    );
    expect(loginDestination("?next=https://evil.test", false)).toBe(
      "/dashboard",
    );
    expect(loginDestination("", true)).toBe("/change-password");
  });
  it('allows only the exact collaboration entry as an additional login destination', () => {
    expect(safeProjectReturn('/external-collab')).toBeNull();
    expect(safeLoginReturn('/external-collab')).toBe('/external-collab');
    expect(loginDestination('?next=%2Fexternal-collab', false)).toBe('/external-collab');
    expect(loginDestination('?next=%2Fexternal-collab', true)).toBe('/change-password?next=%2Fexternal-collab');
    for (const path of ['/external-collab/', '/external-collab?next=https://evil.test', '/external-collab/../admin', '//external-collab', '/external-collab#x']) expect(safeLoginReturn(path)).toBeNull();
  });
});
