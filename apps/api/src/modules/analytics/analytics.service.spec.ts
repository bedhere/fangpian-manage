import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service.js';

const actor = { id: 'user-1', organizationId: 'org-1', email: 'user@example.com', roles: [], permissions: [] };

describe('AnalyticsService', () => {
  it('excludes demo and deleted accounts from employee and department rankings while returning real names', async () => {
    const person = { id: 'employee-real', displayName: '示例员工1106', departmentId: 'real-dept', department: { name: '总经理' }, profile: { capabilityLevel: 'L4', reputationScore: 100 }, skills: [], capacities: [], contributions: [], bonusLedgers: [] };
    const prisma = { systemSetting: { findFirst: vi.fn().mockResolvedValue({ value: {} }) }, user: { findMany: vi.fn().mockResolvedValue([person]) } };
    const service = new AnalyticsService(prisma as never);
    expect((await service.rankings(actor, 'contribution'))[0].name).toBe('示例员工1106');
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1', status: 'ACTIVE', deletedAt: null, isDemoAccount: false } }));
    const departments = await service.rankings(actor, 'departmentActivity');
    expect(departments[0]).toMatchObject({ name: '总经理', capabilityLevel: '1 人' });
  });
  it('rejects unknown ranking types instead of silently changing semantics', async () => {
    const service = new AnalyticsService({} as never);
    await expect(service.rankings(actor, 'unknown')).rejects.toMatchObject({ message: '不支持的排行类型' });
  });

  it('returns zero available percent when recorded available hours are zero', async () => {
    const service = new AnalyticsService({} as never);
    vi.spyOn(service as unknown as { people: () => Promise<unknown[]> }, 'people').mockResolvedValue([{ id: 'u1', name: '员工', department: '产品部', capacity: { availableHours: 0, allocatedHours: 0 } }]);
    const result = await service.capacity(actor);
    expect(result[0]?.availablePercent).toBe(0);
  });
});
