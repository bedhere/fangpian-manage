import { AIGateway, deliveryReviewSchema } from '@value-flow/ai';
import { Prisma, type PrismaClient } from '@value-flow/db';

type Reviewer = (input: Record<string, unknown>) => Promise<unknown>;
export async function runAIEvaluationJob(prisma: PrismaClient, assessmentId: string, finalAttempt: boolean, reviewer?: Reviewer) {
  const assessment = await prisma.aIAssessment.findUnique({ where: { id: assessmentId }, include: { project: { include: { deliveries: { orderBy: { version: 'desc' }, take: 1 } } } } });
  if (!assessment) throw new Error('AI_ASSESSMENT_NOT_FOUND');
  if (assessment.status === 'SUCCEEDED') return { idempotent: true };
  if (assessment.type !== 'DELIVERY_REVIEW' || !['QUEUED', 'RUNNING'].includes(assessment.status)) throw new Error('AI_ASSESSMENT_NOT_RUNNABLE');
  if (assessment.project.status !== 'DELIVERY_SUBMITTED') throw new Error('PROJECT_STATE_CHANGED');
  const snapshot = assessment.inputSnapshot as Record<string, unknown>;
  if (snapshot.deliveryId !== assessment.project.deliveries[0]?.id) throw new Error('DELIVERY_VERSION_CHANGED');
  await prisma.aIAssessment.update({ where: { id: assessmentId }, data: { status: 'RUNNING', attempts: { increment: 1 }, lastAttemptAt: new Date(), error: null } });
  try {
    const execute = reviewer ?? ((input) => {
      const baseUrl = process.env.AI_BASE_URL; const apiKey = process.env.AI_API_KEY; const model = process.env.AI_MODEL;
      if (!baseUrl || !apiKey || !model) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
      return new AIGateway({ baseUrl, apiKey, model, maxAttempts: 1, timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 20_000) }).reviewDelivery(input);
    });
    const output = deliveryReviewSchema.parse(await execute(snapshot));
    await prisma.$transaction(async (tx) => {
      const advanced = await tx.project.updateMany({ where: { id: assessment.projectId, status: 'DELIVERY_SUBMITTED' }, data: { status: 'BUSINESS_ACCEPTANCE' } });
      if (advanced.count !== 1) throw new Error('PROJECT_STATE_CHANGED');
      await tx.aIAssessment.update({ where: { id: assessmentId }, data: { status: 'SUCCEEDED', output: output as Prisma.InputJsonValue, confidence: new Prisma.Decimal(1), error: null } });
      await tx.auditLog.create({ data: { organizationId: assessment.project.organizationId, entityType: 'AIAssessment', entityId: assessmentId, action: 'DELIVERY_AI_REVIEW_SUCCEEDED', after: { projectId: assessment.projectId } } });
    });
    return { idempotent: false, status: 'SUCCEEDED' };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'AI evaluation failed';
    await prisma.aIAssessment.update({ where: { id: assessmentId }, data: { status: finalAttempt ? 'FAILED' : 'QUEUED', error } });
    throw cause;
  }
}
