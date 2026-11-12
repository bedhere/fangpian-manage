import { describe, expect, it } from "vitest";
import { parseTaskTags } from "../../../team-work/src/domain/tags";
describe("task department tags", () => {
  it("splits newlines and commas, trims and deduplicates without splitting the letter n", () => {
    expect(parseTaskTags(" planning\n运营，planning, finance\r\n\n ")).toEqual(["planning", "运营", "finance"]);
  });
});
