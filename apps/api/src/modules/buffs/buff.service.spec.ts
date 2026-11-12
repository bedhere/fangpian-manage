import { describe, expect, it, vi } from 'vitest';
import { BuffService } from './buff.service.js';
const actor = {
  id: 'u1',
  organizationId: 'o1',
  email: 'u1@example.com',
  roles: [],
  permissions: ['project:read'],
};
describe('BuffService', () => {
  it('requires a published knowledge asset before creation', async () => {
    const p = {
      knowledgeAsset: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    await expect(
      new BuffService(p as never, {} as never).create(actor, {
        knowledgeAssetId: 'k1',
        name: '助手',
        description: '用于项目总结',
        type: 'PROMPT',
        permissionCodes: [],
        instructions: '请总结输入',
        inputSchema: { type: 'object' },
      }),
    ).rejects.toMatchObject({ message: 'Buff 必须关联已完成双审的知识资产' });
  });
  it('queues only the persisted run identifier and is idempotent', async () => {
    const run = { id: 'run1', status: 'QUEUED' };
    const p = {
      aIBuff: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'b1',
            status: 'PUBLISHED',
            permissionCodes: [],
            versions: [{ id: 'v1', inputSchema: { required: ['text'] } }],
          }),
      },
      aIBuffRun: {
        findUnique: vi.fn().mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue(run),
      },
    };
    const q = { enqueueBuff: vi.fn() };
    const result = await new BuffService(p as never, q as never).run(
      actor,
      'b1',
      { input: { text: '内容' }, idempotencyKey: 'buff-run-once' },
    );
    expect(result).toEqual(run);
    expect(q.enqueueBuff).toHaveBeenCalledWith('o1', 'run1');
  });
});
