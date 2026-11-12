import { describe, expect, it } from 'vitest';
import { workspaceResponseSchema } from './workspace-response.schema.js';

describe('workspaceResponseSchema', () => {
  it('accepts a structured assistant response', () => {
    expect(workspaceResponseSchema.parse({
      message: '已完成竞品分析，并整理了三个可执行建议。',
      result: { summary: '竞品分析', recommendations: ['聚焦中型客户'] },
      isComplete: true,
      confidence: 0.86,
    })).toEqual({
      message: '已完成竞品分析，并整理了三个可执行建议。',
      result: { summary: '竞品分析', recommendations: ['聚焦中型客户'] },
      isComplete: true,
      confidence: 0.86,
    });
  });

  it('rejects a blank assistant message', () => {
    expect(() => workspaceResponseSchema.parse({
      message: '   ',
      isComplete: false,
      confidence: 0.5,
    })).toThrow();
  });

  it('rejects confidence outside zero to one', () => {
    expect(() => workspaceResponseSchema.parse({
      message: '结果',
      isComplete: false,
      confidence: 1.1,
    })).toThrow();
  });

  it('rejects unknown response fields', () => {
    expect(() => workspaceResponseSchema.parse({
      message: '结果',
      isComplete: false,
      confidence: 0.5,
      forgedRole: 'SYSTEM',
    })).toThrow();
  });
});
