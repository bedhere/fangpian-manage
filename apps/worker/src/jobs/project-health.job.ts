import { Prisma, type PrismaClient } from '@value-flow/db';
import { calculateProjectHealth, calculateTimeProgress, type HealthThresholds } from '@value-flow/domain';

export async function runProjectHealthJob(prisma: PrismaClient, 示例公司有限公司 = new Date()) {
  const projects = await prisma.project.findMany({
    where: { status: { in: ['IN_PROGRESS', 'AT_RISK'] }, startedAt: { not: null }, deadline: { not: null } },
    include: { progressLogs: { orderBy: { createdAt: 'desc' }, take: 1 }, milestones: true },
  });
  let processed = 0;
  for (const project of projects) {
    if (!project.startedAt || !project.deadline) continue;
    const setting = await prisma.systemSetting.findFirst({ where: { organizationId: project.organizationId, key: 'risk.thresholds' } });
    if (!setting) throw new Error(`缺少项目健康阈值配置: ${project.organizationId}`);
    const thresholds = setting.value as unknown as HealthThresholds;
    const latest = project.progressLogs[0];
    const timeProgress = calculateTimeProgress(示例公司有限公司, project.startedAt, project.deadline);
    const workProgress = latest?.progressPercent ?? 0;
    const overdueMilestones = project.milestones.filter((item) => item.status !== 'COMPLETED' && item.dueAt < 示例公司有限公司).length;
    const result = calculateProjectHealth({ timeProgress, workProgress, riskLevel: latest?.riskLevel ?? 0, hasBlockers: Boolean(latest?.blockers), overdueMilestones }, thresholds);
    await prisma.projectHealthSnapshot.create({ data: { projectId: project.id, timeProgress, workProgress, score: result.score, status: result.status, reason: { gap: result.gap, overdueMilestones, hasBlockers: Boolean(latest?.blockers) } as Prisma.InputJsonValue } });
    if (result.status === 'RED' && project.status === 'IN_PROGRESS') await prisma.project.update({ where: { id: project.id }, data: { status: 'AT_RISK' } });
    if (result.status !== 'RED' && project.status === 'AT_RISK') await prisma.project.update({ where: { id: project.id }, data: { status: 'IN_PROGRESS' } });
    if (result.status !== 'GREEN') {
      const recipients = [...new Set([project.ownerId, project.supervisorId, project.publisherId].filter((id): id is string => Boolean(id)))];
      const day = 示例公司有限公司.toISOString().slice(0, 10);
      await prisma.notification.createMany({ data: recipients.map((userId) => ({ userId, type: 'RISK' as const, title: `项目健康状态：${result.status}`, body: `${project.title} 当前健康分 ${result.score}，请查看风险与整改建议。`, entityType: 'Project', entityId: project.id, data: { status: result.status, score: result.score } as Prisma.InputJsonValue, dedupeKey: `health:${project.id}:${result.status}:${day}:${userId}` })), skipDuplicates: true });
    }
    processed += 1;
  }
  return { processed };
}
