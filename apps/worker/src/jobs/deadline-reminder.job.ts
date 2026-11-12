import { Prisma, type PrismaClient } from '@value-flow/db';

export async function runDeadlineReminderJob(prisma: PrismaClient, 示例公司有限公司 = new Date()) {
  const projects = await prisma.project.findMany({ where: { status: { in: ['PLANNING', 'IN_PROGRESS', 'AT_RISK'] }, deadline: { gt: 示例公司有限公司 } } });
  let notified = 0;
  for (const project of projects) {
    const setting = await prisma.systemSetting.findFirst({ where: { organizationId: project.organizationId, key: 'execution.deadlineReminderDays' } });
    if (!setting) throw new Error(`缺少截止日期提醒配置: ${project.organizationId}`);
    const days = (setting.value as { days: number[] }).days;
    const remaining = Math.ceil((project.deadline!.getTime() - 示例公司有限公司.getTime()) / 86_400_000);
    if (!days.includes(remaining)) continue;
    const recipients = [...new Set([project.ownerId, project.supervisorId].filter((id): id is string => Boolean(id)))];
    const result = await prisma.notification.createMany({ data: recipients.map((userId) => ({ userId, type: 'PROJECT' as const, title: `项目还有 ${remaining} 天到期`, body: `${project.title} 即将到期，请确认里程碑和下一步行动。`, entityType: 'Project', entityId: project.id, data: { remainingDays: remaining } as Prisma.InputJsonValue, dedupeKey: `deadline:${project.id}:${remaining}:${userId}` })), skipDuplicates: true });
    notified += result.count;
  }
  return { notified };
}
