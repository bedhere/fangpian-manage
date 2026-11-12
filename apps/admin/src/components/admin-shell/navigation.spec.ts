import { describe, expect, it } from "vitest";
import { getAdminNavigationItems } from "./navigation";

describe("admin navigation", () => {
  it("contains every governance area from the approved V1 map", () => {
    expect(getAdminNavigationItems().map((item) => item.id)).toEqual([
      "overview",
      "organization",
      "access",
      "rules",
      "ai",
      "notifications",
      "audit",
      "health",
    ]);
  });
});
