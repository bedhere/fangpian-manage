import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@value-flow/db';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';

@Injectable()
export class ReviewsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async queue(actor: RequestUser, stage: 'BUSINESS' | 'TECHNICAL') {
    const permission = stage === 'BUSINESS' ? 'project:business-review' : 'project:technical-review';
    if (!actor.permissions.includes(permission)) throw new ForbiddenException('缺少审核权限');
    const reviewer = await this.prisma.user.findFirst({
      where: { id: actor.id, organizationId: actor.organizationId },
      select: { departmentId: true },
    });
    if (stage === 'BUSINESS' && !reviewer?.departmentId)
      throw new ForbiddenException('审核人未归属部门');
    const where: Prisma.ProjectWhereInput = stage === 'BUSINESS'
      ? {
          organizationId: actor.organizationId,
          ...(actor.roles.includes('OWNER') ? {} : { OR: [{ publisherDepartmentId: reviewer!.departmentId! }, { publisherDepartment: { headId: actor.id } }] }),
          status: { in: ['HUMAN_REQUIRED', 'DEPARTMENT_REVIEW'] },
          publisherId: { not: actor.id },
        }
      : {
          organizationId: actor.organizationId,
          status: 'TECH_REVIEW' as const,
          publisherId: { not: actor.id },
        };
    return this.prisma.project.findMany({
      where,
      include: {
        publisher: { select: { id: true, displayName: true, email: true } },
        publisherDepartment: { select: { id: true, name: true } },
        approvals: { include: { reviewer: { select: { displayName: true } } }, orderBy: { createdAt: 'asc' } },
        aiAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
  }
}
