import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type { AddMemberDto } from './market.dto.js';
@Injectable()
export class ProjectTeamService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async add(actor: RequestUser, projectId: string, input: AddMemberDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: actor.organizationId },
    });
    if (!project) throw new NotFoundException();
    if (
      project.ownerId !== actor.id &&
      !actor.permissions.includes('project:technical-review')
    )
      throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: input.userId } },
        update: { role: input.role, leftAt: null },
        create: {
          projectId,
          userId: input.userId,
          role: input.role,
          createdBy: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.id,
          entityType: 'ProjectMember',
          entityId: member.id,
          action: 'PROJECT_MEMBER_ADDED',
          after: { projectId, userId: input.userId, role: input.role },
        },
      });
      return member;
    });
  }
}
