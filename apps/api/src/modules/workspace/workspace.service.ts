import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { TeamWorkRepository } from '../team-work/team-work.repository.js';
import { TasksService } from '../team-work/modules/tasks/tasks.service.js';
import { publicUser } from '../team-work/domain/types.js';
import { isTraineeOnly } from '../auth/trainee-access.js';

const baseNavigation = [
  { id: 'dashboard', label: '工作台', href: '/dashboard' },
  { id: 'projects', label: '项目', href: '/projects' },
  { id: 'market', label: '机会市场', href: '/market' },
  { id: 'opportunities', label: '内部机会', href: '/opportunities' },
  { id: 'circles', label: '临时圈子', href: '/circles' },
  { id: 'buffs', label: 'AI Buff', href: '/buffs' },
  { id: 'bonuses', label: '价值回报', href: '/bonuses' },
  { id: 'profile', label: '示例公司有限公司画像', href: '/profile' },
  { id: 'capacity', label: '我的产能', href: '/capacity' },
  { id: 'rankings', label: '价值排行', href: '/rankings' },
  { id: 'trainees', label: '管培生入驻', href: '/trainees' },
  { id: 'leaderboards', label: '排行榜', href: '/leaderboards' },
];

@Injectable()
export class WorkspaceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TeamWorkRepository) private readonly teamWork: TeamWorkRepository,
    @Inject(TasksService) private readonly tasksService: TasksService) {}

  async bootstrap(actor: RequestUser) {
    if (isTraineeOnly(actor.roles)) {
      const user = await this.prisma.user.findFirst({ where: { id: actor.id, organizationId: actor.organizationId, status: 'ACTIVE', deletedAt: null }, select: { displayName: true, department: { select: { name: true } }, profile: { select: { capabilityLevel: true, reputationScore: true } } } });
      if (!user) throw new NotFoundException('用户不存在');
      return {
        user: { id: actor.id, email: actor.email, displayName: user.displayName, departmentName: user.department?.name ?? null, capabilityLevel: user.profile?.capabilityLevel ?? null, reputationScore: user.profile?.reputationScore ?? null, roles: actor.roles, permissions: [] as string[] },
        navigation: [{ id: 'trainees', label: '管培生入驻', href: '/trainees' }, { id: 'leaderboards', label: '排行榜', href: '/leaderboards' }],
        counters: { activeProjects: 0, pendingApplications: 0, unreadNotifications: 0, totalBonus: '0' },
        tasks: [], notifications: [],
        workQueues: { myProjects: 0, myApplications: 0, pendingScores: 0, contributionDisputes: 0, riskProjects: 0, supervisedProjects: 0, departmentProjects: 0, departmentTodos: 0, skillVerifications: 0 },
      };
    }
    const projectScope = {
      organizationId: actor.organizationId,
      OR: [
        { publisherId: actor.id },
        { ownerId: actor.id },
        { members: { some: { userId: actor.id, leftAt: null } } },
      ],
    };
    const [user, activeProjects, pendingApplications, unreadNotifications, bonus, projects, notifications, departmentTodos] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: actor.id, organizationId: actor.organizationId, deletedAt: null },
        select: { displayName: true, departmentId: true, department: { select: { name: true } }, profile: { select: { capabilityLevel: true, reputationScore: true } } },
      }),
      this.prisma.project.count({ where: { ...projectScope, status: { in: ['OWNER_ASSIGNED', 'PLANNING', 'IN_PROGRESS', 'AT_RISK', 'DELIVERY_SUBMITTED', 'AI_DELIVERY_REVIEW', 'BUSINESS_ACCEPTANCE', 'FINAL_RATING'] } } }),
      this.prisma.projectApplication.count({ where: { applicantId: actor.id, project: { organizationId: actor.organizationId }, status: { in: ['PENDING', 'SPECIAL_CAPABILITY_REVIEW'] } } }),
      this.prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
      this.prisma.bonusLedger.aggregate({ where: { organizationId: actor.organizationId, userId: actor.id }, _sum: { amount: true } }),
      this.prisma.project.findMany({ where: { organizationId: actor.organizationId, ownerId: actor.id }, orderBy: { updatedAt: 'desc' }, take: 6, select: { id: true, title: true, status: true, deadline: true, updatedAt: true } }),
      this.prisma.notification.findMany({ where: { userId: actor.id, readAt: null }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, title: true, body: true, entityType: true, entityId: true, createdAt: true } }),
      this.teamWork.run(actor, async db => (await this.tasksService.summary(publicUser(db.users.find(u => u.id === actor.id)!))).total),
    ]);
    if (!user) throw new NotFoundException('用户不存在');
    const [pendingScores, contributionDisputes, riskProjects, supervisedProjects, departmentProjects, skillVerifications] = await Promise.all([
      this.prisma.project.count({ where: { organizationId: actor.organizationId, status: { in: ['BUSINESS_ACCEPTANCE', 'FINAL_RATING'] }, OR: [{ publisherId: actor.id }, { owner: { managerId: actor.id } }, { publisherDepartment: { headId: actor.id } }] } }),
      this.prisma.contributionDispute.count({ where: { status: 'OPEN', project: { organizationId: actor.organizationId, OR: [{ ownerId: actor.id }, { members: { some: { userId: actor.id } } }] } } }),
      this.prisma.project.count({ where: { organizationId: actor.organizationId, status: 'AT_RISK', OR: [{ ownerId: actor.id }, { supervisorId: actor.id }] } }),
      this.prisma.project.count({ where: { organizationId: actor.organizationId, supervisorId: actor.id, status: { notIn: ['SETTLED', 'REJECTED', 'CANCELLED', 'FAILED'] } } }),
      user.departmentId ? this.prisma.project.count({ where: { organizationId: actor.organizationId, publisherDepartmentId: user.departmentId, status: { notIn: ['SETTLED', 'REJECTED', 'CANCELLED', 'FAILED'] } } }) : 0,
      actor.permissions.includes('skill:verify') ? this.prisma.projectSkillEvidence.count({ where: { organizationId: actor.organizationId, status: 'PENDING' } }) : 0,
    ]);

    const navigation = [...baseNavigation];
    if (actor.permissions.includes('project:business-review') || actor.permissions.includes('project:technical-review')) {
      navigation.push({ id: 'reviews', label: '审核中心', href: '/reviews' });
    }
    if (actor.permissions.includes('analytics:executive')) {
      navigation.push({ id: 'executive', label: '经营驾驶舱', href: '/executive' });
      navigation.push({ id: 'value-network', label: '价值流网络', href: '/value-network' });
    }
    if (actor.permissions.includes('settlement:manage')) {
      navigation.push({ id: 'settlements', label: '月结管理', href: '/settlements' });
    }

    return {
      user: { id: actor.id, email: actor.email, displayName: user.displayName, departmentName: user.department?.name ?? null, capabilityLevel: user.profile?.capabilityLevel ?? null, reputationScore: user.profile?.reputationScore ?? null, roles: actor.roles, permissions: actor.permissions },
      navigation,
      counters: { activeProjects, pendingApplications, unreadNotifications, totalBonus: String(bonus._sum.amount ?? '0') },
      tasks: projects,
      notifications,
      workQueues: { myProjects: activeProjects, myApplications: pendingApplications, pendingScores, contributionDisputes, riskProjects, supervisedProjects, departmentProjects, departmentTodos, skillVerifications },
    };
  }
}

