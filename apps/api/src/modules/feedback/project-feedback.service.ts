import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { buildProjectFeedback, type FeedbackCapabilityLevel, type ProjectFeedbackRules } from '@value-flow/domain';
import { Prisma, type ProjectGrade, type SkillEvidenceStatus } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';

@Injectable()
export class ProjectFeedbackService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async applyCompletedProject(projectId: string) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        rating: true,
        requiredSkills: true,
        contributions: {
          where: { supersededAt: null },
          include: { user: { include: { profile: true } } },
        },
      },
    });
    if (!project.rating) throw new BadRequestException('项目尚未形成最终评级');
    const rules = await this.rules(project.organizationId);
    const results = [];
    for (const contribution of project.contributions) {
      const profile = contribution.user.profile;
      if (!profile) continue;
      const percentage = (contribution.finalPercentage ?? contribution.proposedPercentage).toNumber();
      const existingEventTotal = await this.prisma.reputationEvent.aggregate({
        where: { userId: contribution.userId }, _sum: { delta: true },
      });
      const reputationBaseline = profile.reputationScore - (existingEventTotal._sum.delta ?? 0);
      const feedback = buildProjectFeedback({
        projectId,
        userId: contribution.userId,
        grade: project.rating.grade,
        onTime: Boolean(project.deadline && project.deliveredAt && project.deliveredAt <= project.deadline),
        failed: project.rating.grade === 'FAIL',
        maliciousAbandonment: false,
        contributionPercentage: percentage,
        skillIds: project.requiredSkills.map((item) => item.skillId),
        currentReputationScore: profile.reputationScore,
        currentCapabilityLevel: profile.capabilityLevel,
      }, rules);
      await this.prisma.$transaction(async (tx) => {
        let score = profile.reputationScore;
        for (const event of feedback.reputationEvents) {
          await tx.reputationEvent.upsert({
            where: { userId_projectId_type: { userId: contribution.userId, projectId, type: event.type } },
            update: {},
            create: {
              userId: contribution.userId,
              projectId,
              type: event.type,
              delta: event.delta,
              scoreBefore: score,
              scoreAfter: Math.max(0, score + event.delta),
              metadata: { eventKey: event.eventKey, ruleVersion: 'feedback-v1' },
            },
          });
          score = Math.max(0, score + event.delta);
        }
        for (const evidence of feedback.skillEvidence) {
          await tx.projectSkillEvidence.upsert({
            where: { evidenceKey: evidence.evidenceKey },
            update: {},
            create: {
              evidenceKey: evidence.evidenceKey,
              organizationId: project.organizationId,
              projectId,
              userId: contribution.userId,
              skillId: evidence.skillId,
              contributionPercentage: new Prisma.Decimal(evidence.contributionPercentage),
              grade: evidence.grade,
            },
          });
        }
        const priorTransition = await tx.capabilityLevelHistory.findFirst({ where: { userId: contribution.userId, projectId } });
        if (feedback.capabilityDecision && !priorTransition) {
          await tx.capabilityLevelHistory.create({ data: {
            userId: contribution.userId,
            projectId,
            oldLevel: feedback.capabilityDecision.oldLevel,
            newLevel: feedback.capabilityDecision.newLevel,
            reason: feedback.capabilityDecision.reason,
            ruleVersion: feedback.capabilityDecision.ruleVersion,
            evidence: { grade: project.rating!.grade, contributionPercentage: percentage },
          } });
        }
        const persistedEventTotal = await tx.reputationEvent.aggregate({
          where: { userId: contribution.userId }, _sum: { delta: true },
        });
        const persistedScore = Math.max(0, reputationBaseline + (persistedEventTotal._sum.delta ?? 0));
        await tx.employeeProfile.update({
          where: { userId: contribution.userId },
          data: {
            reputationScore: persistedScore,
            ...(feedback.capabilityDecision && !priorTransition ? { capabilityLevel: feedback.capabilityDecision.newLevel } : {}),
          },
        });
        await tx.auditLog.create({ data: {
          organizationId: project.organizationId,
          entityType: 'ProjectFeedback',
          entityId: projectId,
          action: 'PROJECT_FEEDBACK_APPLIED',
          after: { userId: contribution.userId, reputationEvents: feedback.reputationEvents, capabilityDecision: priorTransition ? null : feedback.capabilityDecision },
        } });
      });
      results.push({ userId: contribution.userId, ...feedback });
    }
    return results;
  }

  async applyReputationFact(
    organizationId: string,
    projectId: string,
    userId: string,
    type: 'OWNER_REPLACED' | 'PROJECT_FAILED' | 'MALICIOUS_ABANDON',
    metadata?: Record<string, unknown>,
  ) {
    const [profile, deltas, existingTotal] = await Promise.all([
      this.prisma.employeeProfile.findUniqueOrThrow({ where: { userId } }),
      this.setting<Record<string, number>>(organizationId, 'reputation.eventDeltas'),
      this.prisma.reputationEvent.aggregate({ where: { userId }, _sum: { delta: true } }),
    ]);
    const baseline = profile.reputationScore - (existingTotal._sum.delta ?? 0);
    return this.prisma.$transaction(async (tx) => {
      const delta = deltas[type];
      if (typeof delta !== 'number') throw new BadRequestException(`MISSING_REPUTATION_DELTA:${type}`);
      const event = await tx.reputationEvent.upsert({
        where: { userId_projectId_type: { userId, projectId, type } },
        update: {},
        create: { userId, projectId, type, delta, scoreBefore: profile.reputationScore, scoreAfter: Math.max(0, profile.reputationScore + delta), metadata: { ...metadata, ruleVersion: 'feedback-v1' } },
      });
      const total = await tx.reputationEvent.aggregate({ where: { userId }, _sum: { delta: true } });
      await tx.employeeProfile.update({ where: { userId }, data: { reputationScore: Math.max(0, baseline + (total._sum.delta ?? 0)) } });
      return event;
    });
  }

  async mine(actor: RequestUser) {
    return Promise.all([
      this.prisma.reputationEvent.findMany({ where: { userId: actor.id, user: { organizationId: actor.organizationId } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.projectSkillEvidence.findMany({ where: { userId: actor.id, organizationId: actor.organizationId }, include: { project: { select: { title: true } }, skill: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.capabilityLevelHistory.findMany({ where: { userId: actor.id, user: { organizationId: actor.organizationId } }, orderBy: { createdAt: 'desc' } }),
    ]).then(([reputationEvents, skillEvidence, capabilityHistory]) => ({ reputationEvents, skillEvidence, capabilityHistory }));
  }

  async pendingSkillEvidence(actor: RequestUser) {
    if (!actor.permissions.includes('project:technical-review')) throw new ForbiddenException('缺少技能验证权限');
    return this.prisma.projectSkillEvidence.findMany({
      where: { organizationId: actor.organizationId, status: 'PENDING', userId: { not: actor.id } },
      include: { user: { select: { displayName: true } }, project: { select: { title: true } }, skill: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewSkillEvidence(actor: RequestUser, evidenceId: string, status: SkillEvidenceStatus, reason: string) {
    const evidence = await this.prisma.projectSkillEvidence.findFirst({ where: { id: evidenceId }, include: { project: { select: { organizationId: true } } } });
    if (!evidence || evidence.project.organizationId !== actor.organizationId) throw new NotFoundException('技能证据不存在');
    if (!actor.permissions.includes('project:technical-review')) throw new ForbiddenException('缺少技能验证权限');
    if (evidence.userId === actor.id) throw new ForbiddenException('禁止审核自己的技能证据');
    if (!['VERIFIED', 'REJECTED'].includes(status)) throw new BadRequestException('技能验证状态无效');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectSkillEvidence.update({ where: { id: evidenceId }, data: { status, reviewerId: actor.id, reviewReason: reason, reviewedAt: new Date() } });
      if (status === 'VERIFIED') await tx.employeeSkill.upsert({
        where: { userId_skillId: { userId: evidence.userId, skillId: evidence.skillId } },
        update: { verificationStatus: 'VERIFIED', verifiedById: actor.id, verifiedAt: new Date(), verifiedProjectId: evidence.projectId, evidence: reason },
        create: { userId: evidence.userId, skillId: evidence.skillId, verificationStatus: 'VERIFIED', verifiedById: actor.id, verifiedAt: new Date(), verifiedProjectId: evidence.projectId, evidence: reason },
      });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorId: actor.id, entityType: 'ProjectSkillEvidence', entityId: evidenceId, action: `SKILL_EVIDENCE_${status}`, after: { reason } } });
      return updated;
    });
  }

  private async rules(organizationId: string): Promise<ProjectFeedbackRules> {
    const [deltas, skill, progression] = await Promise.all([
      this.setting<Record<string, number>>(organizationId, 'reputation.eventDeltas'),
      this.setting<{ minimumContributionPercentage: number; acceptedGrades: ProjectGrade[] }>(organizationId, 'feedback.skillVerification'),
      this.setting<Record<FeedbackCapabilityLevel, number> & { allowAutomaticDemotion: boolean }>(organizationId, 'feedback.capabilityProgression'),
    ]);
    return {
      reputationDeltas: deltas as ProjectFeedbackRules['reputationDeltas'],
      skillVerification: skill,
      capabilityProgression: { thresholds: { L0: progression.L0, L1: progression.L1, L2: progression.L2, L3: progression.L3, L4: progression.L4 }, allowAutomaticDemotion: progression.allowAutomaticDemotion },
    };
  }

  private async setting<T>(organizationId: string, key: string) {
    const row = await this.prisma.systemSetting.findFirst({ where: { organizationId, key } });
    if (!row) throw new BadRequestException(`MISSING_SETTING:${key}`);
    return row.value as T;
  }
}
