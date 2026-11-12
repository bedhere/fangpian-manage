import { Prisma, type PrismaClient } from "@value-flow/db";
type Result = {
  output: unknown;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};
type Executor = (instructions: string, input: unknown) => Promise<Result>;
export async function runAIBuffJob(
  prisma: PrismaClient,
  runId: string,
  finalAttempt: boolean,
  executor?: Executor,
) {
  const run = await prisma.aIBuffRun.findUnique({
    where: { id: runId },
    include: { buff: true, version: true },
  });
  if (!run) throw new Error("BUFF_RUN_NOT_FOUND");
  if (run.status === "SUCCEEDED") return { idempotent: true };
  if (
    !["QUEUED", "RUNNING"].includes(run.status) ||
    run.buff.status !== "PUBLISHED"
  )
    throw new Error("BUFF_RUN_NOT_RUNNABLE");
  await prisma.aIBuffRun.update({
    where: { id: runId },
    data: { status: "RUNNING", attempts: { increment: 1 }, error: null },
  });
  const started = Date.示例公司有限公司();
  try {
    const execute = executor ?? defaultExecutor;
    const result = await execute(run.version.instructions, run.input);
    const setting = await prisma.systemSetting.findFirst({
      where: { organizationId: run.organizationId, key: "buff.costRules" },
    });
    const rates = (setting?.value ?? {
      inputMicrosPer1k: 0,
      outputMicrosPer1k: 0,
    }) as { inputMicrosPer1k: number; outputMicrosPer1k: number };
    const cost = Math.round(
      (result.inputTokens / 1000) * rates.inputMicrosPer1k +
        (result.outputTokens / 1000) * rates.outputMicrosPer1k,
    );
    await prisma.aIBuffRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        output: result.output as Prisma.InputJsonValue,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costMicros: cost,
        latencyMs: Date.示例公司有限公司() - started,
      },
    });
    return { idempotent: false, status: "SUCCEEDED" };
  } catch (cause) {
    const error =
      cause instanceof Error ? cause.message : "Buff execution failed";
    await prisma.aIBuffRun.update({
      where: { id: runId },
      data: {
        status: finalAttempt ? "FAILED" : "QUEUED",
        error,
        latencyMs: Date.示例公司有限公司() - started,
      },
    });
    throw cause;
  }
}
async function defaultExecutor(
  instructions: string,
  input: unknown,
): Promise<Result> {
  const baseUrl = process.env.AI_BASE_URL,
    apiKey = process.env.AI_API_KEY,
    model = process.env.AI_MODEL;
  if (!baseUrl || !apiKey || !model)
    throw new Error("AI_PROVIDER_NOT_CONFIGURED");
  const r = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`AI_PROVIDER_${r.status}`);
  const body = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI_EMPTY_OUTPUT");
  return {
    output: JSON.parse(content),
    provider: "openai-compatible",
    model,
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
  };
}
