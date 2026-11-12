import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIGateway } from './ai-gateway.service.js';

const validAssessment = {
  aiCanCompleteAlone: true,
  shouldCreateProject: false,
  confidence: 0.9,
  businessValueScore: 70,
  technicalComplexityScore: 20,
  urgencyScore: 50,
  recommendedProjectLevel: 'P4',
  requiredCapabilityLevel: 1,
  estimatedHours: 2,
  requiredSkills: ['信息整理'],
  reason: 'AI 可独立完成',
};

describe('AIGateway retry contract', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('sends the full triage schema and requests fast JSON output from DeepSeek Flash', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(validAssessment) } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await new AIGateway({ baseUrl: 'https://api.deepseek.com', apiKey: 'test', model: 'deepseek-flash' }).triage({ title: '需求', description: '背景', businessProblem: '问题', expectedResult: '结果', acceptanceCriteria: '标准' });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe('deepseek-flash');
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.messages[0].content).toContain('recommendedProjectLevel');
    expect(body.messages[0].content).toContain('requiredCapabilityLevel');
  });

  it('retries invalid structured output up to the configured attempt count', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '{invalid' } }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify(validAssessment) } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new AIGateway({ baseUrl: 'https://ai.test', apiKey: 'test', model: 'test', maxAttempts: 2 });

    await expect(gateway.triage({ title: 't', description: 'd', businessProblem: 'p', expectedResult: 'r', acceptanceCriteria: 'a' })).resolves.toMatchObject({ aiCanCompleteAlone: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces the final validation failure after all configured attempts', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: '{}' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new AIGateway({ baseUrl: 'https://ai.test', apiKey: 'test', model: 'test', maxAttempts: 2 });

    await expect(gateway.triage({ title: 't', description: 'd', businessProblem: 'p', expectedResult: 'r', acceptanceCriteria: 'a' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid structured delivery review output', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ technicalQuality: 200 }) } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new AIGateway({ baseUrl: 'https://ai.test', apiKey: 'test', model: 'test' });
    await expect(gateway.reviewDelivery({ title: '成果', changeSummary: '首版', content: '内容' })).rejects.toThrow();
  });

  it('sends the request, diagnosis and ordered conversation to the workspace model', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({
      message: '我已经完成分析。', result: { summary: '分析结果' }, isComplete: true, confidence: 0.91,
    }) } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new AIGateway({ baseUrl: 'https://ai.test', apiKey: 'test', model: 'workspace-model' });

    await expect(gateway.respondToWorkspace({
      request: { title: '分析竞品', problem: '不了解竞争格局', businessContext: '准备进入新市场', expectedOutcome: '形成建议', constraints: '一周内' },
      diagnosis: { aiCanCompleteAlone: true },
      messages: [{ role: 'USER', content: '先比较主要产品' }, { role: 'ASSISTANT', content: '请补充目标地区' }, { role: 'USER', content: '华东' }],
    })).resolves.toMatchObject({ isComplete: true, confidence: 0.91 });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { model: string; messages: Array<{ role: string; content: string }> };
    expect(request.model).toBe('workspace-model');
    expect(request.messages[1]?.content).toContain('分析竞品');
    expect(request.messages[1]?.content).toContain('aiCanCompleteAlone');
    expect(request.messages.slice(2).map((item) => item.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('retries malformed workspace output and rejects the final failure', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ message: '', isComplete: false, confidence: 2 }) } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new AIGateway({ baseUrl: 'https://ai.test', apiKey: 'test', model: 'test', maxAttempts: 2 });

    await expect(gateway.respondToWorkspace({
      request: { title: '需求', problem: '问题', businessContext: '背景', expectedOutcome: '结果' },
      messages: [{ role: 'USER', content: '开始' }],
    })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
