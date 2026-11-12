import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { SetCapacityDto, SetSkillsDto } from './market.dto.js';
@Injectable()
export class CapacityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  get(userId: string) {
    return this.prisma.employeeCapacity.findMany({
      where: { userId },
      orderBy: { periodStart: 'desc' },
    });
  }
  async set(userId: string, input: SetCapacityDto) {
    const periodStart = new Date(input.periodStart),
      periodEnd = new Date(input.periodEnd);
    if (
      Number.isNaN(periodStart.valueOf()) ||
      Number.isNaN(periodEnd.valueOf()) ||
      periodEnd <= periodStart
    )
      throw new BadRequestException('产能周期无效');
    const overlap = await this.prisma.employeeCapacity.findFirst({
      where: {
        userId,
        periodStart: { lt: periodEnd },
        periodEnd: { gt: periodStart },
        NOT: { periodStart, periodEnd },
      },
      select: { id: true },
    });
    if (overlap) throw new BadRequestException('产能周期与现有记录重叠');
    return this.prisma.employeeCapacity.upsert({
      where: {
        userId_periodStart_periodEnd: { userId, periodStart, periodEnd },
      },
      update: { availableHours: input.availableHours, note: input.note },
      create: {
        userId,
        periodStart,
        periodEnd,
        availableHours: input.availableHours,
        note: input.note,
      },
    });
  }
  async skills(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException();
    return this.prisma.employeeSkill.findMany({
      where: { userId },
      include: { skill: true },
    });
  }
  async setSkills(userId: string, input: SetSkillsDto) {
    if (
      input.skills.some(
        (item) => !item.skillId || item.proficiency < 1 || item.proficiency > 5,
      )
    )
      throw new BadRequestException('技能等级必须为 1-5');
    return this.prisma.$transaction(
      input.skills.map((item) =>
        this.prisma.employeeSkill.upsert({
          where: { userId_skillId: { userId, skillId: item.skillId } },
          update: { proficiency: item.proficiency, evidence: item.evidence },
          create: {
            userId,
            skillId: item.skillId,
            proficiency: item.proficiency,
            evidence: item.evidence,
          },
        }),
      ),
    );
  }
  skillCatalog(organizationId: string) {
    return this.prisma.skill.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
  }
  updateMyProfile(userId: string, input: { bio?: string; timezone?: string }) {
    return this.prisma.employeeProfile.update({ where: { userId }, data: input });
  }
}
