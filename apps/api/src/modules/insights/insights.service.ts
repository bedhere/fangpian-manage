import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { mergeTimelineNodes } from '../execution/project-timeline.js';

@Injectable()
export class InsightsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}
  private executive(actor: RequestUser) { return actor.permissions.includes('analytics:executive'); }
  async projectGantt(actor: RequestUser) {
    if (!this.executive(actor)) throw new ForbiddenException('缺少经营洞察权限');
    const projects = await this.prisma.project.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, title: true, status: true, projectLevel: true, startedAt: true, completedAt: true, deadline: true,
        publisherDepartment: { select: { name: true } }, owner: { select: { displayName: true } },
        timelineNodes: { orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }] },
        progressLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { progressPercent: true } },
      }, orderBy: { createdAt: 'desc' },
    });
    return { projects: projects.map((project) => ({ id: project.id, title: project.title, status: project.status, projectLevel: project.projectLevel,
      department: project.publisherDepartment?.name ?? '未分配部门', owner: project.owner?.displayName ?? null,
      progressPercent: project.progressLogs[0]?.progressPercent ?? 0, timelineNodes: mergeTimelineNodes(project, project.timelineNodes),
    })) };
  }
  async company(actor: RequestUser) {
    if (!this.executive(actor)) throw new ForbiddenException('缺少经营洞察权限');
    const 示例公司有限公司 = new Date();
    const [dashboard, projects, departments] = await Promise.all([
      this.analytics.dashboard(actor),
      this.prisma.project.findMany({ where: { organizationId: actor.organizationId }, select: { id: true, title: true, projectLevel: true, status: true, deadline: true, deliveredAt: true, finalBonus: true, aiExecutionRatio: true, publisherDepartment: { select: { id: true, name: true } }, deliveries: { select: { acceptances: { select: { decision: true } } } } } }),
      this.analytics.departments(actor),
    ]);
    const completed = projects.filter((project) => project.deliveries.some((delivery) => delivery.acceptances.length));
    const accepted = completed.filter((project) => project.deliveries.some((delivery) => delivery.acceptances.some((acceptance) => acceptance.decision === 'APPROVED')));
    return { ...dashboard, overdueProjects: projects.filter((project) => project.deadline && project.deadline < 示例公司有限公司 && !['SETTLED', 'CLOSED'].includes(project.status)).map((project) => ({ id: project.id, title: project.title, deadline: project.deadline })), acceptanceRate: completed.length ? Math.round(accepted.length / completed.length * 100) : 0, highPriority: { p0: projects.filter((project) => project.projectLevel === 'P0').length, p1: projects.filter((project) => project.projectLevel === 'P1').length }, bonusPool: projects.reduce((sum, project) => sum + Number(project.finalBonus ?? 0), 0), departmentCapacity: departments, aiEfficiency: projects.length ? Math.round(projects.reduce((sum, project) => sum + project.aiExecutionRatio, 0) / projects.length) : 0, hiddenTalent: dashboard.topTalents.filter((person) => person.contributionScore > 0 && person.totalBonus === 0).slice(0, 10) };
  }
  async department(actor: RequestUser, id: string) {
    const current = await this.prisma.user.findFirst({ where: { id: actor.id, organizationId: actor.organizationId }, select: { departmentId: true } });
    if (!this.executive(actor) && (!actor.roles.includes('DEPARTMENT_HEAD') || current?.departmentId !== id)) throw new ForbiddenException('无权查看该部门洞察');
    const department = await this.prisma.department.findFirst({ where: { id, organizationId: actor.organizationId, deletedAt: null }, select: { id: true, name: true } });
    if (!department) throw new NotFoundException('部门不存在');
    const people = (await this.analytics.rankings(actor, 'contribution')).filter((person) => person.departmentId === id);
    const projects = await this.prisma.project.findMany({ where: { organizationId: actor.organizationId, OR: [{ publisherDepartmentId: id }, { members: { some: { user: { departmentId: id } } } }] }, select: { id: true, title: true, status: true, publisherDepartmentId: true, publisherDepartment: { select: { name: true } }, members: { select: { user: { select: { departmentId: true } } } } } });
    return { department, people, projects, summary: { memberCount: people.length, contributionScore: people.reduce((sum, person) => sum + person.contributionScore, 0), availableHours: people.reduce((sum, person) => sum + Number(person.capacity?.availableHours ?? 0), 0), allocatedHours: people.reduce((sum, person) => sum + Number(person.capacity?.allocatedHours ?? 0), 0) }, valueFlow: { nodes: [{ id, label: department.name }, ...people.map((person) => ({ id: person.id, label: person.name }))], edges: people.map((person) => ({ from: id, to: person.id, value: person.contributionScore })) } };
  }
  async employee(actor: RequestUser, id: string) {
    if (actor.id !== id && !this.executive(actor)) {
      if (!actor.roles.includes('DEPARTMENT_HEAD')) throw new ForbiddenException('无权查看该员工洞察');
      const [viewer, target] = await Promise.all([this.prisma.user.findFirst({ where: { id: actor.id, organizationId: actor.organizationId }, select: { departmentId: true } }), this.prisma.user.findFirst({ where: { id, organizationId: actor.organizationId }, select: { departmentId: true } })]);
      if (!viewer?.departmentId || viewer.departmentId !== target?.departmentId) throw new ForbiddenException('无权查看该员工洞察');
    }
    return this.analytics.profile(actor, id);
  }
  async valueNetwork(actor: RequestUser, query: { from?: string; to?: string; types?: string; departmentId?: string }) {
    if (!this.executive(actor)) throw new ForbiddenException('缺少经营洞察权限');
    const setting = await this.prisma.systemSetting.findFirst({ where: { organizationId: actor.organizationId, key: 'network.rules' } });
    const rules = (setting?.value ?? { maxRangeDays: 365, maxNodes: 1000 }) as { maxRangeDays: number; maxNodes: number };
    const to = query.to ? new Date(query.to) : new Date(); const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86400000);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to || to.getTime() - from.getTime() > rules.maxRangeDays * 86400000) throw new BadRequestException('价值网络时间范围无效或过大');
    const createdAt = { gte: from, lte: to }; const org = actor.organizationId; const departmentId = query.departmentId;
    const [departments, users, opportunities, requests, projects, assets, buffs, conversions] = await Promise.all([
      this.prisma.department.findMany({ where: { organizationId: org, deletedAt: null, ...(departmentId ? { id: departmentId } : {}) }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { organizationId: org, deletedAt: null, ...(departmentId ? { departmentId } : {}) }, select: { id: true, displayName: true, departmentId: true } }),
      this.prisma.opportunity.findMany({ where: { organizationId: org, createdAt, ...(departmentId ? { publisherDepartmentId: departmentId } : {}) }, select: { id: true, title: true, publisherId: true } }),
      this.prisma.businessRequest.findMany({ where: { organizationId: org, createdAt, ...(departmentId ? { requester: { departmentId } } : {}) }, select: { id: true, title: true, requesterId: true, linkedProjectId: true } }),
      this.prisma.project.findMany({ where: { organizationId: org, createdAt, ...(departmentId ? { OR: [{ publisherDepartmentId: departmentId }, { members: { some: { user: { departmentId } } } }] } : {}) }, select: { id: true, title: true, publisherId: true, members: { select: { userId: true } } } }),
      this.prisma.knowledgeAsset.findMany({ where: { organizationId: org, createdAt }, select: { id: true, title: true, authorId: true } }),
      this.prisma.aIBuff.findMany({ where: { organizationId: org, createdAt }, select: { id: true, name: true, authorId: true, knowledgeAssetId: true } }),
      this.prisma.opportunityConversion.findMany({ where: { opportunity: { organizationId: org }, createdAt }, select: { opportunityId: true, businessRequestId: true } }),
    ]);
    const nodes = [
      ...departments.map(x => ({ id: `department:${x.id}`, entityId: x.id, type: 'DEPARTMENT', label: x.name })), ...users.map(x => ({ id: `employee:${x.id}`, entityId: x.id, type: 'EMPLOYEE', label: x.displayName })),
      ...opportunities.map(x => ({ id: `opportunity:${x.id}`, entityId: x.id, type: 'OPPORTUNITY', label: x.title })), ...requests.map(x => ({ id: `request:${x.id}`, entityId: x.id, type: 'REQUEST', label: x.title })),
      ...projects.map(x => ({ id: `project:${x.id}`, entityId: x.id, type: 'PROJECT', label: x.title })), ...assets.map(x => ({ id: `knowledge:${x.id}`, entityId: x.id, type: 'KNOWLEDGE', label: x.title })), ...buffs.map(x => ({ id: `buff:${x.id}`, entityId: x.id, type: 'BUFF', label: x.name })),
    ];
    const requestedTypes = new Set((query.types ?? '').split(',').filter(Boolean)); const filtered = (requestedTypes.size ? nodes.filter(n => requestedTypes.has(n.type)) : nodes).slice(0, rules.maxNodes); const allowed = new Set(filtered.map(n => n.id));
    const edges = [
      ...users.filter(x => x.departmentId).map(x => ({ from: `department:${x.departmentId}`, to: `employee:${x.id}`, type: 'MEMBER_OF' })), ...opportunities.map(x => ({ from: `employee:${x.publisherId}`, to: `opportunity:${x.id}`, type: 'PUBLISHED' })),
      ...conversions.map(x => ({ from: `opportunity:${x.opportunityId}`, to: `request:${x.businessRequestId}`, type: 'CONVERTED_TO' })), ...requests.map(x => ({ from: `employee:${x.requesterId}`, to: `request:${x.id}`, type: 'REQUESTED' })),
      ...requests.filter(x => x.linkedProjectId).map(x => ({ from: `request:${x.id}`, to: `project:${x.linkedProjectId}`, type: 'BECAME_PROJECT' })), ...projects.flatMap(x => x.members.map(m => ({ from: `employee:${m.userId}`, to: `project:${x.id}`, type: 'PARTICIPATED' }))),
      ...assets.map(x => ({ from: `employee:${x.authorId}`, to: `knowledge:${x.id}`, type: 'AUTHORED' })), ...buffs.map(x => ({ from: `knowledge:${x.knowledgeAssetId}`, to: `buff:${x.id}`, type: 'POWERS' })),
    ].filter(e => allowed.has(e.from) && allowed.has(e.to));
    return { range: { from, to }, nodes: filtered, edges, metrics: { nodeCount: filtered.length, edgeCount: edges.length, crossDepartmentProjects: projects.filter(p => p.members.length > 1).length } };
  }
}
