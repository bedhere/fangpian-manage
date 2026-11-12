import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  calculateMatchingScore,
  requiresSpecialCapabilityReview,
  type MatchingComponents,
  type MatchingWeights,
} from '@value-flow/domain';
import { PrismaService } from '../../infrastructure/prisma.service.js';

const levelNumber = (level: string | null | undefined): number =>
  Number(level?.slice(1) ?? 0);
@Injectable()
export class MatchingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async calculate(userId: string, projectId: string) {
    const [user, project] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          profile: true,
          skills: true,
          capacities: {
            where: { periodEnd: { gte: new Date() } },
            orderBy: { periodEnd: 'asc' },
            take: 1,
          },
        },
      }),
      this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        include: { requiredSkills: true },
      }),
    ]);
    const requiredIds = new Set(
      project.requiredSkills.map((item) => item.skillId),
    );
    const employeeIds = new Set(user.skills.map((item) => item.skillId));
    const skills =
      requiredIds.size === 0
        ? 100
        : ([...requiredIds].filter((id) => employeeIds.has(id)).length /
            requiredIds.size) *
          100;
    const employeeLevel = levelNumber(user.profile?.capabilityLevel);
    const requiredLevel = levelNumber(project.requiredCapabilityLevel);
    const capability =
      requiredLevel === 0
        ? 100
        : Math.min(100, (employeeLevel / requiredLevel) * 100);
    const capacityRecord = user.capacities[0];
    const available = capacityRecord
      ? Number(capacityRecord.availableHours) -
        Number(capacityRecord.allocatedHours)
      : 0;
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        organizationId: user.organizationId,
        key: { in: ['matching.weights', 'matching.defaults'] },
      },
    });
    const values = new Map(
      settings.map((setting) => [setting.key, setting.value]),
    );
    const defaultsValue = values.get('matching.defaults');
    const weightsValue = values.get('matching.weights');
    if (!defaultsValue || !weightsValue)
      throw new InternalServerErrorException('匹配规则尚未配置完整');
    const defaults = defaultsValue as { successRate: number; similarExperience: number };
    const components: MatchingComponents = {
      skills,
      capability,
      successRate: defaults.successRate,
      similarExperience: defaults.similarExperience,
      capacity: project.estimatedHours
        ? Math.min(100, (available / Number(project.estimatedHours)) * 100)
        : 100,
      reputation: user.profile?.reputationScore ?? 0,
    };
    const weights = weightsValue as unknown as MatchingWeights;
    return {
      score: calculateMatchingScore(components, weights),
      components,
      weights,
      specialReviewRequired: requiresSpecialCapabilityReview(
        employeeLevel,
        requiredLevel,
      ),
      employeeLevel,
      requiredLevel,
    };
  }
}
