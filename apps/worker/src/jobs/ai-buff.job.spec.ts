import { describe, expect, it, vi } from "vitest";
import { runAIBuffJob } from "./ai-buff.job.js";
function fx(status = "QUEUED") {
  return {
    aIBuffRun: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: "r1",
          organizationId: "o1",
          status,
          buff: { status: "PUBLISHED" },
          version: { instructions: "执行" },
          input: { text: "x" },
        }),
      update: vi.fn(),
    },
    systemSetting: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          value: { inputMicrosPer1k: 1000, outputMicrosPer1k: 2000 },
        }),
    },
  };
}
describe("AI Buff worker", () => {
  it("is idempotent after success", async () => {
    await expect(
      runAIBuffJob(fx("SUCCEEDED") as never, "r1", true, vi.fn()),
    ).resolves.toEqual({ idempotent: true });
  });
  it("records cost and succeeds only after executor output", async () => {
    const p = fx();
    await runAIBuffJob(p as never, "r1", true, async () => ({
      output: { answer: "ok" },
      provider: "test",
      model: "m",
      inputTokens: 1000,
      outputTokens: 500,
    }));
    expect(p.aIBuffRun.update).toHaveBeenLastCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({
        status: "SUCCEEDED",
        costMicros: 2000,
        output: { answer: "ok" },
      }),
    });
  });
  it("marks final failure without touching other business state", async () => {
    const p = fx();
    await expect(
      runAIBuffJob(p as never, "r1", true, async () => {
        throw new Error("bad");
      }),
    ).rejects.toThrow("bad");
    expect(p.aIBuffRun.update).toHaveBeenLastCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({ status: "FAILED" }),
    });
  });
});
