import { describe, expect, it } from 'vitest';
import { diagnosisFeedback } from './diagnosis-feedback';
describe('Diagnosis feedback', () => {
  it('surfaces manual-required responses even when the HTTP request succeeds', () => {
    expect(diagnosisFeedback({ route: 'MANUAL_REQUIRED', reason: 'DeepSeek 密钥未配置' })).toEqual({ error: 'DeepSeek 密钥未配置', notice: '' });
  });
  it('confirms the successful AI route', () => {
    expect(diagnosisFeedback({ route: 'AI_WORKSPACE' }).notice).toContain('AI 工作区');
  });
});
