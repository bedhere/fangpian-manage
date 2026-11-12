import { describe, expect, it, vi } from 'vitest';
import { GovernanceService } from './governance.service.js';

const actor = {
  id: 'admin-1',
  organizationId: 'org-1',
  email: 'admin@example.com',
  roles: ['SUPER_ADMIN'],
  permissions: ['user:manage', 'department:manage', 'role:manage'],
};

describe('GovernanceService', () => {
  it.each([['true', 'https'], ['false', 'http']])('uses the configured MinIO transport (%s) for its health check', async (useSsl, protocol) => {
    const service = new GovernanceService({ $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]) } as never);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubEnv('MINIO_ENDPOINT', 'example.invalid');
    vi.stubEnv('MINIO_PORT', '443');
    vi.stubEnv('MINIO_USE_SSL', useSsl);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(service as unknown as { tcp(host: string, port: number): Promise<void> }, 'tcp').mockResolvedValue();
    try {
      const result = await service.systemHealth({ ...actor, permissions: ['setting:manage'] });
      expect(fetchMock).toHaveBeenCalledWith(`${protocol}://example.invalid:443/minio/health/live`, expect.any(Object));
      expect(result.status).toBe('healthy');
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
  it('prevents HR from assigning a more privileged role through account creation', async () => {
    const prisma = { role: { findMany: vi.fn().mockResolvedValue([{ id: 'owner-role', permissions: [{ permission: { code: 'analytics:executive' } }] }]) } };
    const service = new GovernanceService(prisma as never);
    await expect(service.createUser({ ...actor, roles: ['COMPANY_HR'], permissions: ['user:manage'] }, { email: 'staff@accounts.invalid', displayName: '员工', password: 'Temporary123!', roleIds: ['owner-role'] })).rejects.toMatchObject({ message: 'PERMISSION_ESCALATION' });
  });
  it('refuses to disable the final active super administrator', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'admin-1', status: 'ACTIVE',
          roles: [{ role: { code: 'SUPER_ADMIN' } }],
        }),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const service = new GovernanceService(prisma as never);
    await expect(
      service.updateUser(actor, 'admin-1', { status: 'DISABLED', reason: '离职停用' }),
    ).rejects.toMatchObject({ message: 'LAST_SUPER_ADMIN' });
  });

  it('rejects a cyclic department move before writing', async () => {
    const prisma = {
      department: {
        findFirst: vi.fn().mockResolvedValue({ id: 'sales', parentId: null }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'sales', parentId: null },
          { id: 'east', parentId: 'sales' },
        ]),
        update: vi.fn(),
      },
    };
    const service = new GovernanceService(prisma as never);
    await expect(
      service.updateDepartment(actor, 'sales', { parentId: 'east' }),
    ).rejects.toMatchObject({ message: 'CYCLIC_DEPARTMENT' });
    expect(prisma.department.update).not.toHaveBeenCalled();
  });

  it('rejects permission escalation before changing a role', async () => {
    const service = new GovernanceService({} as never);
    await expect(
      service.updateRolePermissions(actor, 'role-1', {
        permissionCodes: ['role:manage', 'audit:read'],
      }),
    ).rejects.toMatchObject({ message: 'PERMISSION_ESCALATION' });
  });

  it('reports AI secret presence without returning the secret', () => {
    vi.stubEnv('AI_API_KEY', 'never-return-this-secret');
    const result = new GovernanceService({} as never).aiConfiguration({
      ...actor,
      permissions: [...actor.permissions, 'setting:manage'],
    });
    expect(result.apiKeyConfigured).toBe(true);
    expect(JSON.stringify(result)).not.toContain('never-return-this-secret');
  });

  it('rejects cross-organization department references when creating a user', async () => {
    const prisma = {
      department: { findFirst: vi.fn().mockResolvedValue(null) },
      role: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new GovernanceService(prisma as never);
    await expect(service.createUser(actor, {
      email: 'new@example.com', displayName: '新成员', password: 'Temporary123!', departmentId: 'other-org-department', roleIds: [],
    })).rejects.toMatchObject({ message: 'INVALID_DEPARTMENT' });
  });

  it('refuses to disable a system role', async () => {
    const prisma = { role: { findFirst: vi.fn().mockResolvedValue({ id: 'r1', isSystem: true, name: '员工', description: null, status: 'ACTIVE', permissions: [] }) } };
    const service = new GovernanceService(prisma as never);
    await expect(service.updateRole(actor, 'r1', { status: 'INACTIVE', reason: '误操作保护验证' }))
      .rejects.toMatchObject({ message: 'SYSTEM_ROLE_CANNOT_BE_DISABLED' });
  });

  it('rejects permission escalation when creating a role', async () => {
    const service = new GovernanceService({} as never);
    await expect(service.createRole(actor, { code: 'AUDITOR', name: '审计员', permissionCodes: ['audit:read'] }))
      .rejects.toMatchObject({ message: 'PERMISSION_ESCALATION' });
  });
});
