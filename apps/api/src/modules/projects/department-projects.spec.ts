import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ProjectsService } from './projects.service.js';
import { ListProjectsDto } from './project.dto.js';

const actor = { id: 'employee', organizationId: 'org', email: 'employee@example.com', roles: ['EMPLOYEE'], permissions: ['project:read'] };
function fixture(departmentId: string | null) {
  const prisma = { user: { findFirst: vi.fn().mockResolvedValue({ departmentId }) },
    project: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } };
  return { prisma, service: new ProjectsService(prisma as never) };
}
describe('department project list', () => {
  it('accepts the department view through the real request validator', async () => {
    expect(await validate(plainToInstance(ListProjectsDto, { view: 'DEPARTMENT' }))).toEqual([]);
  });
  it('uses canonical employee membership and matches the active department queue without executive permission', async () => {
    const { prisma, service } = fixture('dept-a');
    await service.list(actor, { view: 'DEPARTMENT', page: 2, pageSize: 20 } as never);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { id: actor.id, organizationId: actor.organizationId, deletedAt: null }, select: { departmentId: true } });
    const where = prisma.project.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ organizationId: 'org', publisherDepartmentId: 'dept-a', NOT: { status: { in: ['SETTLED', 'REJECTED', 'CANCELLED', 'FAILED'] } } });
    expect(prisma.project.count).toHaveBeenCalledWith({ where });
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
  });
  it('returns no department projects when the user is not assigned to a department', async () => {
    const { prisma, service } = fixture(null);
    await service.list(actor, { view: 'DEPARTMENT', page: 1, pageSize: 20 } as never);
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org', id: { in: [] } } }));
  });
  it('does not accept a client-selected department to widen the query', async () => {
    const { prisma, service } = fixture('dept-a');
    await service.list(actor, { view: 'DEPARTMENT', page: 1, pageSize: 20, departmentId: 'other-org-dept' } as never);
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org', publisherDepartmentId: 'dept-a' }) }));
  });
});
