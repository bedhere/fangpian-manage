import { describe, expect, it, vi } from 'vitest';
import { InsightsService } from './insights.service.js';
const actor = { id: 'u1', organizationId: 'org1', email: 'u1@example.com', roles: ['EMPLOYEE'], permissions: [] };
describe('InsightsService authorization', () => {
  it('keeps all-project Gantt data executive-only', async () => {
    await expect(new InsightsService({} as never, {} as never).projectGantt(actor)).rejects.toThrow('缺少经营洞察权限');
  });
  it('returns every tenant project without a silent limit and merges default milestones', async () => {
    const prisma = { project: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', startedAt: null, deadline: null, completedAt: null, timelineNodes: [], progressLogs: [{ progressPercent: 35 }] }]) } };
    const result = await new InsightsService(prisma as never, {} as never).projectGantt({ ...actor, permissions: ['analytics:executive'] });
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org1' } }));
    expect(prisma.project.findMany.mock.calls[0][0]).not.toHaveProperty('take');
    expect(result.projects[0].timelineNodes).toHaveLength(4);
    expect(result.projects[0].progressPercent).toBe(35);
  });
  it('keeps company insight executive-only', async () => {
    await expect(new InsightsService({} as never, {} as never).company(actor)).rejects.toMatchObject({ message: '缺少经营洞察权限' });
  });
  it('allows an employee to inspect only their own employee insight', async () => {
    await expect(new InsightsService({} as never, {} as never).employee(actor, 'u2')).rejects.toMatchObject({ message: '无权查看该员工洞察' });
  });
  it('prevents a department head from crossing department boundaries', async () => {
    const prisma = { user: { findFirst: vi.fn().mockResolvedValue({ departmentId: 'd1' }) }, department: { findFirst: vi.fn().mockResolvedValue(null) } };
    const head = { ...actor, roles: ['DEPARTMENT_HEAD'] };
    await expect(new InsightsService(prisma as never, {} as never).department(head, 'd2')).rejects.toMatchObject({ message: '无权查看该部门洞察' });
  });
  it('keeps the enterprise value network executive-only', async () => {
    await expect(new InsightsService({} as never, {} as never).valueNetwork(actor, {})).rejects.toMatchObject({ message: '缺少经营洞察权限' });
  });
});
