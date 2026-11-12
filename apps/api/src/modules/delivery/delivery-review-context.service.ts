import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';

type ContextLimits = { maxProgressLogs: number; maxRisks: number; maxDeliveryVersions: number; maxTextChars: number };

@Injectable()
export class DeliveryReviewContextService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assemble(actor: RequestUser, projectId: string, deliveryId: string) {
    const limits = await this.limits(actor.organizationId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: actor.organizationId },
      include: {
        businessRequest: true,
        plans: { where: { status: 'CONFIRMED' }, orderBy: { version: 'desc' }, take: 1, include: { milestones: { orderBy: { dueAt: 'asc' } } } },
        progressLogs: { orderBy: { createdAt: 'desc' }, take: limits.maxProgressLogs + 1 },
        riskActions: { orderBy: { createdAt: 'desc' }, take: limits.maxRisks + 1 },
        deliveries: { orderBy: { version: 'desc' }, take: limits.maxDeliveryVersions + 1 },
      },
    });
    if (!project) throw new NotFoundException('项目不存在');
    if (!project.deliveries.some((delivery) => delivery.id === deliveryId)) throw new NotFoundException('交付版本不存在');
    const progress = project.progressLogs.slice(0, limits.maxProgressLogs);
    const risks = project.riskActions.slice(0, limits.maxRisks);
    const deliveryVersions = project.deliveries.slice(0, limits.maxDeliveryVersions);
    let deliveryTextTruncated = false;
    const deliveries = deliveryVersions.map((delivery) => {
      const content = delivery.content && delivery.content.length > limits.maxTextChars
        ? (deliveryTextTruncated = true, delivery.content.slice(0, limits.maxTextChars))
        : delivery.content;
      return { id: delivery.id, version: delivery.version, title: delivery.title, changeSummary: delivery.changeSummary, content, url: delivery.url, storageKey: delivery.storageKey };
    });
    const plan = project.plans[0] ?? null;
    return {
      projectId,
      deliveryId,
      request: {
        title: project.businessRequest?.title ?? project.title,
        problem: project.businessRequest?.problem ?? project.businessProblem,
        businessContext: project.businessRequest?.businessContext ?? null,
        expectedOutcome: project.businessRequest?.expectedOutcome ?? project.expectedResult,
        constraints: project.businessRequest?.constraints ?? null,
        acceptanceCriteria: project.acceptanceCriteria,
      },
      execution: {
        objective: plan?.objective ?? project.objective,
        milestones: plan?.milestones.map((item) => ({ title: item.title, description: item.description, expectedDeliverable: item.expectedDeliverable, dueAt: item.dueAt })) ?? [],
        progress: progress.map((item) => ({ summary: item.summary, blockers: item.blockers, nextAction: item.nextAction, progressPercent: item.progressPercent, riskLevel: item.riskLevel, createdAt: item.createdAt })),
        risks: risks.map((item) => ({ reason: item.reason, remediationPlan: item.remediationPlan, resolvedAt: item.resolvedAt })),
      },
      deliveries,
      truncation: {
        progressLogs: project.progressLogs.length > limits.maxProgressLogs,
        risks: project.riskActions.length > limits.maxRisks,
        deliveryVersions: project.deliveries.length > limits.maxDeliveryVersions,
        deliveryText: deliveryTextTruncated,
        limits,
      },
    };
  }

  private async limits(organizationId: string): Promise<ContextLimits> {
    const setting = await this.prisma.systemSetting.findFirst({ where: { organizationId, key: 'ai.deliveryReviewContext' } });
    if (!setting) throw new BadRequestException('MISSING_SETTING:ai.deliveryReviewContext');
    const value = setting.value as Partial<ContextLimits>;
    const limits = {
      maxProgressLogs: value.maxProgressLogs ?? 20,
      maxRisks: value.maxRisks ?? 10,
      maxDeliveryVersions: value.maxDeliveryVersions ?? 5,
      maxTextChars: value.maxTextChars ?? 20_000,
    };
    if (Object.values(limits).some((item) => !Number.isInteger(item) || item < 1)) throw new BadRequestException('INVALID_SETTING:ai.deliveryReviewContext');
    return limits;
  }
}
