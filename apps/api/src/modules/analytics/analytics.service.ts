import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  calculateContributionScore,
  type ContributionScoreWeights,
} from '@value-flow/domain';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
type AnalyticsRankingRow = { rank: number; id: string; name: string; department: string; capabilityLevel: string; rankingValue: number; contributionScore: number; totalBonus: number; departmentId?: string | null; capacity?: { availableHours: unknown; allocatedHours: unknown } | null; [key: string]: unknown };

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async weights(organizationId: string) {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { organizationId, key: 'analytics.contributionWeights' },
    });
    if (!setting)
      throw new NotFoundException(
        'MISSING_SETTING:analytics.contributionWeights',
      );
    return setting.value as unknown as ContributionScoreWeights;
  }
  private async people(organizationId: string, includeDemoAccounts = false) {
    const 示例公司有限公司 = new Date();
    const weights = await this.weights(organizationId);
    const users = await this.prisma.user.findMany({
      where: { organizationId, status: 'ACTIVE', deletedAt: null, ...(includeDemoAccounts ? {} : { isDemoAccount: false }) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        department: true,
        profile: true,
        skills: { include: { skill: true } },
        capacities: { where: { periodStart: { lte: 示例公司有限公司 }, periodEnd: { gte: 示例公司有限公司 } }, orderBy: { periodEnd: 'desc' }, take: 1 },
        contributions: {
          where: { supersededAt: null },
          include: {
            project: { include: { rating: true, publisherDepartment: true } },
          },
        },
        bonusLedgers: true,
      },
    });
    return users.map((user) => {
      const completed = user.contributions.filter(
        (item) => item.project.rating,
      );
      const scores = completed.map((item) =>
        calculateContributionScore(
          {
            projectValue: item.project.businessValueScore ?? 0,
            grade: item.project.rating!.grade,
            projectLevel: item.project.projectLevel ?? 'P4',
            contributionPercent: Number(
              item.finalPercentage ?? item.proposedPercentage,
            ),
            crossDepartment:
              user.departmentId !== item.project.publisherDepartmentId,
            onTime: Boolean(
              item.project.deadline &&
              item.project.deliveredAt &&
              item.project.deliveredAt <= item.project.deadline,
            ),
            aiExecutionRatio: item.project.aiExecutionRatio,
          },
          weights,
        ),
      );
      const totalBonus = user.bonusLedgers.reduce(
        (sum, item) => sum + Number(item.amount),
        0,
      );
      return {
        id: user.id,
        name: user.displayName,
        department: user.department?.name ?? '未分配',
        departmentId: user.departmentId,
        capabilityLevel: user.profile?.capabilityLevel ?? 'L0',
        reputationScore: user.profile?.reputationScore ?? 0,
        bio: user.profile?.bio ?? null,
        timezone: user.profile?.timezone ?? 'Asia/Shanghai',
        skills: user.skills.map((item) => ({
          name: item.skill.name,
          proficiency: item.proficiency,
          verificationStatus: item.verificationStatus,
        })),
        capacity: user.capacities[0] ?? null,
        projectCount: user.contributions.length,
        completedCount: completed.length,
        completionRate: user.contributions.length
          ? Math.round((completed.length / user.contributions.length) * 100)
          : 0,
        sCount: completed.filter((item) => item.project.rating?.grade === 'S')
          .length,
        aCount: completed.filter((item) => item.project.rating?.grade === 'A')
          .length,
        totalBonus,
        highValueCount: completed.filter((item) =>
          ['P0', 'P1'].includes(item.project.projectLevel ?? ''),
        ).length,
        aiEfficiency: completed.length
          ? Math.round(
              completed.reduce(
                (sum, item) => sum + item.project.aiExecutionRatio,
                0,
              ) / completed.length,
            )
          : 0,
        crossDepartmentCount: completed.filter(
          (item) => user.departmentId !== item.project.publisherDepartmentId,
        ).length,
        contributionScore: scores.reduce((sum, value) => sum + value, 0),
      };
    });
  }
  async profile(actor: RequestUser, id: string) {
    const people = await this.people(actor.organizationId, actor.id === id);
    const profile = people.find((item) => item.id === id);
    if (!profile) throw new NotFoundException();
    const history = await this.prisma.capabilityLevelHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });
    const reputationEvents = await this.prisma.reputationEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const skillEvidence = await this.prisma.projectSkillEvidence.findMany({
      where: { userId: id, organizationId: actor.organizationId, ...(actor.id === id ? {} : { status: 'VERIFIED' }) },
      include: { project: { select: { title: true } }, skill: true },
      orderBy: { createdAt: 'desc' },
    });
    return { ...profile, isSelf: actor.id === id, capabilityHistory: history, reputationEvents, skillEvidence };
  }
  async rankings(actor: RequestUser, type: string): Promise<AnalyticsRankingRow[]> {
    const supported = ['contribution', 'bonus', 's', 'crossDepartment', 'growth', 'highValue', 'aiEfficiency', 'departmentActivity'];
    if (!supported.includes(type)) throw new BadRequestException('不支持的排行类型');
    if (type === 'departmentActivity') {
      return (await this.departments(actor)).map((item) => ({ rank: item.rank, id: `department-${item.department}`, name: item.department, department: '部门活跃', capabilityLevel: `${item.memberCount} 人`, rankingValue: item.contributionScore, contributionScore: item.contributionScore, totalBonus: item.totalBonus }));
    }
    const people = await this.people(actor.organizationId);
    const selector: Record<string, (item: (typeof people)[number]) => number> =
      {
        contribution: (item) => item.contributionScore,
        bonus: (item) => item.totalBonus,
        s: (item) => item.sCount,
        crossDepartment: (item) => item.crossDepartmentCount,
        growth: (item) => item.reputationScore,
        highValue: (item) => item.highValueCount,
        aiEfficiency: (item) => item.aiEfficiency,
      };
    const score = selector[type];
    if (!score) throw new BadRequestException('不支持的排行类型');
    return people
      .sort((a, b) => score(b) - score(a))
      .map((item, index) => ({
        rank: index + 1,
        ...item,
        rankingValue: score(item),
      }));
  }
  async capacity(actor: RequestUser) {
    const people = await this.people(actor.organizationId);
    return people.map((item) => ({
      ...item.capacity,
      userId: item.id,
      name: item.name,
      department: item.department,
      availablePercent: item.capacity && Number(item.capacity.availableHours) > 0
        ? Math.max(
            0,
            Math.round(
              ((Number(item.capacity.availableHours) -
                Number(item.capacity.allocatedHours)) /
                Number(item.capacity.availableHours)) *
                100,
            ),
          )
        : 0,
    }));
  }
  async departments(actor: RequestUser) {
    const people = await this.people(actor.organizationId);
    const groups = new Map<
      string,
      {
        department: string;
        contributionScore: number;
        totalBonus: number;
        completedProjects: number;
        memberCount: number;
      }
    >();
    for (const person of people) {
      const current = groups.get(person.department) ?? {
        department: person.department,
        contributionScore: 0,
        totalBonus: 0,
        completedProjects: 0,
        memberCount: 0,
      };
      current.contributionScore += person.contributionScore;
      current.totalBonus += person.totalBonus;
      current.completedProjects += person.completedCount;
      current.memberCount += 1;
      groups.set(person.department, current);
    }
    return [...groups.values()]
      .sort((a, b) => b.contributionScore - a.contributionScore)
      .map((item, index) => ({ rank: index + 1, ...item }));
  }
  async dashboard(actor: RequestUser) {
    const [people, projects, ledgers] = await Promise.all([
      this.people(actor.organizationId),
      this.prisma.project.findMany({
        where: { organizationId: actor.organizationId },
        include: {
          members: { include: { user: { select: { departmentId: true } } } },
          publisherDepartment: true,
          rating: true,
        },
      }),
      this.prisma.bonusLedger.findMany({
        where: { organizationId: actor.organizationId },
      }),
    ]);
    const statusCounts = Object.entries(
      projects.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([status, count]) => ({ status, count }));
    const flows = new Map<string, number>();
    for (const project of projects)
      for (const member of project.members) {
        if (
          member.user.departmentId &&
          member.user.departmentId !== project.publisherDepartmentId
        ) {
          const key = `${project.publisherDepartment.name} → ${people.find((person) => person.departmentId === member.user.departmentId)?.department ?? '未知部门'}`;
          flows.set(key, (flows.get(key) ?? 0) + 1);
        }
      }
    return {
      projects: {
        total: projects.length,
        statusCounts,
        completed: projects.filter((item) => item.status === 'SETTLED').length,
        atRisk: projects.filter((item) => item.status === 'AT_RISK').length,
      },
      bonuses: {
        total: ledgers.reduce((sum, item) => sum + Number(item.amount), 0),
        paid: ledgers
          .filter((item) => item.status === 'PAID')
          .reduce((sum, item) => sum + Number(item.amount), 0),
      },
      capacity: {
        availableHours: people.reduce(
          (sum, item) => sum + Number(item.capacity?.availableHours ?? 0),
          0,
        ),
        allocatedHours: people.reduce(
          (sum, item) => sum + Number(item.capacity?.allocatedHours ?? 0),
          0,
        ),
      },
      topTalents: [...people]
        .sort((a, b) => b.contributionScore - a.contributionScore)
        .slice(0, 10),
      valueFlows: [...flows].map(([route, count]) => ({ route, count })),
      gradeDistribution: ['S', 'A', 'B', 'C', 'FAIL'].map((grade) => ({
        grade,
        count: projects.filter((item) => item.rating?.grade === grade).length,
      })),
    };
  }
}
