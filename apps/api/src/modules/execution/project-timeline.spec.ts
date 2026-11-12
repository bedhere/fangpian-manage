import { describe, expect, it, vi } from 'vitest';
import { ExecutionService } from './execution.service.js';

const owner = { id: 'owner', organizationId: 'org', email: 'a@example.com', roles: [], permissions: [] };
function fixture() {
  const tx = {
    project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', ownerId: 'owner' }) },
    projectTimelineNode: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => ({ id: 'n1', ...data })), update: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (fn) => fn(tx)) };
  return { tx, service: new ExecutionService(prisma as never) };
}
const input = { title: '需求评审', description: '确认范围', date: '2026-10-20', status: 'PENDING' as const };

describe('Project timeline ownership and dates', () => {
  it('creates custom dated nodes with an audit record', async () => {
    const { service, tx } = fixture();
    await service.saveTimelineNode(owner, 'p1', null, input);
    expect(tx.projectTimelineNode.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ projectId: 'p1', title: '需求评审', scheduledAt: new Date('2026-10-20T00:00:00+08:00') }) }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
  it('does not let a reviewer edit another owner’s timeline', async () => {
    const { service, tx } = fixture();
    await expect(service.saveTimelineNode({ ...owner, id: 'reviewer', permissions: ['project:technical-review'] }, 'p1', null, input)).rejects.toThrow('仅当前项目负责人可编辑时间节点');
    expect(tx.projectTimelineNode.create).not.toHaveBeenCalled();
  });
  it('protects all four default nodes from deletion', async () => {
    const { service } = fixture();
    for (const key of ['START', 'BETA_START', 'BETA_END', 'END']) await expect(service.deleteTimelineNode(owner, 'p1', key)).rejects.toThrow('默认节点不可删除');
  });
  it('rejects nonexistent calendar dates', async () => {
    const { service } = fixture();
    await expect(service.saveTimelineNode(owner, 'p1', null, { ...input, date: '2026-02-30' })).rejects.toThrow('节点日期无效');
  });
  it('does not update a node belonging to another project', async () => {
    const { service, tx } = fixture();
    await expect(service.saveTimelineNode(owner, 'p1', 'foreign-node', input)).rejects.toThrow();
    expect(tx.projectTimelineNode.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-node', projectId: 'p1' } });
    expect(tx.projectTimelineNode.update).not.toHaveBeenCalled();
  });
  it('rejects reversed default milestone dates', async () => {
    const { service, tx } = fixture();
    tx.projectTimelineNode.findMany.mockResolvedValue([{ defaultKey: 'START', scheduledAt: new Date('2026-10-21T00:00:00+08:00') }] as never);
    await expect(service.saveTimelineNode(owner, 'p1', 'BETA_START', input)).rejects.toThrow('默认节点日期必须按项目阶段先后排列');
  });
  it('edits a default date while preserving its fixed title and unique key', async () => {
    const { service, tx } = fixture();
    tx.projectTimelineNode.upsert.mockResolvedValue({ id: 'saved-default' });
    await service.saveTimelineNode(owner, 'p1', 'BETA_START', { ...input, title: '不能重命名默认节点' });
    expect(tx.projectTimelineNode.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_defaultKey: { projectId: 'p1', defaultKey: 'BETA_START' } },
      update: expect.objectContaining({ title: '上线一轮内测' }),
    }));
  });
  it('deletes only a custom node scoped to the project and audits the deletion', async () => {
    const { service, tx } = fixture();
    tx.projectTimelineNode.findFirst.mockResolvedValue({ id: 'n1', defaultKey: null, title: '评审' } as never);
    await expect(service.deleteTimelineNode(owner, 'p1', 'n1')).resolves.toEqual({ deleted: true });
    expect(tx.projectTimelineNode.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'PROJECT_TIMELINE_NODE_DELETED' }) }));
  });
  it('protects a saved default even when addressed by its database UUID', async () => {
    const { service, tx } = fixture();
    tx.projectTimelineNode.findFirst.mockResolvedValue({ id: 'n1', defaultKey: 'START' } as never);
    await expect(service.deleteTimelineNode(owner, 'p1', 'n1')).rejects.toThrow('默认节点不可删除');
    expect(tx.projectTimelineNode.delete).not.toHaveBeenCalled();
  });
  it('preserves default-node rules when updating by database UUID', async () => {
    const { service, tx } = fixture();
    tx.projectTimelineNode.findFirst.mockResolvedValue({ id: 'saved-default', defaultKey: 'BETA_START' } as never);
    tx.projectTimelineNode.findMany.mockResolvedValue([{ defaultKey: 'START', scheduledAt: new Date('2026-10-21T00:00:00+08:00') }] as never);
    await expect(service.saveTimelineNode(owner, 'p1', 'saved-default', { ...input, title: '不应替换默认标题' })).rejects.toThrow('默认节点日期必须按项目阶段先后排列');
    expect(tx.projectTimelineNode.update).not.toHaveBeenCalled();
  });
  it('checks the organization before changing a timeline', async () => {
    const { service, tx } = fixture();
    tx.project.findFirst.mockResolvedValue(null);
    await expect(service.saveTimelineNode(owner, 'p1', null, input)).rejects.toThrow('项目不存在');
    expect(tx.project.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', organizationId: 'org' } });
  });
  it('allows same-day stages when the real start contains a time of day', async () => {
    const { service, tx } = fixture();
    tx.project.findFirst.mockResolvedValue({ id: 'p1', ownerId: 'owner', startedAt: new Date('2026-10-20T10:00:00+08:00') } as never);
    tx.projectTimelineNode.upsert.mockResolvedValue({ id: 'default-beta' });
    await expect(service.saveTimelineNode(owner, 'p1', 'BETA_START', input)).resolves.toEqual({ id: 'default-beta' });
  });
});
