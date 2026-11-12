import { projectTriageSchema, type ProjectTriage } from './project-triage.schema.js';
import { z } from 'zod';
import { deliveryReviewSchema, type DeliveryReview } from './delivery-review.schema.js';
import {
  workspaceResponseSchema,
  type WorkspaceConversationInput,
  type WorkspaceResponse,
} from './workspace-response.schema.js';
import { demoBuildSchema, type DemoBuild, type DemoBuildInput } from './demo-build.schema.js';

const WORKSPACE_SYSTEM_PROMPT = [
  '你是方片内部的 AI 工作区助手，帮助员工直接完成需求。',
  '只输出严格 JSON，字段为 message、result（可选）、isComplete、confidence，不要 Markdown 代码块或额外字段。',
  'message：给用户的简短中文回复（300 字以内），说明你做了什么、接下来可以怎么调整。',
  'result：只要你产出了成果（文档、方案、文案、表格、代码等），就必须放在 result 中，格式为 {"title": "成果标题", "content": "完整 Markdown 正文"}。',
  'content 必须是完整可直接使用的正文，绝不能省略、截断或只写“已生成”。用户追问成果在哪里时，重新在 result.content 中给出完整正文。',
  '信息不足时先给出合理的完整初稿并在 message 中说明假设，而不是只提问。',
  'isComplete：成果可交付时为 true；confidence：0 到 1 之间的数字。',
].join('\n');

const DEMO_SYSTEM_PROMPT = [
  '你是方片内部的前端原型工程师。根据需求和对话，产出一个可以直接在浏览器里使用的单文件 Demo。',
  '硬性要求：',
  '1. html 是完整 HTML 文档（<!doctype html> 开头，</html> 结尾），所有 CSS 与 JavaScript 内联。',
  '2. 不引用任何外部资源：不用 CDN、字体、外链图片，不发起任何网络请求。图标用内联 SVG 或文字。',
  '3. 必须是真正可交互、能完成需求核心流程的功能原型（例如录入、增删改查、筛选、计算、生成、导出等），而不是静态说明页或海报。内置几条贴近业务的中文示例数据。',
  '4. 数据保存用 localStorage，所有读写都包在 try/catch 中；不可用时退回内存，页面照常工作。',
  '5. 中文界面，简洁现代，主色 #ffd85f、文字 #303030，适配手机与电脑宽度，无横向滚动。',
  '6. 代码健壮：不依赖未定义变量，不使用 alert 阻塞流程，控制台无报错。',
  '只输出严格 JSON：{"title": "Demo 名称", "summary": "一句话说明", "howToUse": ["使用步骤"...], "html": "完整 HTML"}，不要 Markdown 代码块或额外字段。',
].join('\n');
export interface AIProviderConfig { baseUrl: string; apiKey: string; model: string; timeoutMs?: number; maxAttempts?: number }
export interface TriageInput { title: string; description: string; businessProblem: string; expectedResult: string; acceptanceCriteria: string }
export interface DeliveryReviewInput { [key: string]: unknown }
export class AIGateway {
  constructor(private readonly config: AIProviderConfig) {}
  async triage(input: TriageInput): Promise<ProjectTriage> {
    const maxAttempts = Math.max(1, this.config.maxAttempts ?? 1);
    let finalError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.requestTriage(input);
      } catch (error) {
        finalError = error;
      }
    }
    throw finalError;
  }
  async reviewDelivery(input: DeliveryReviewInput): Promise<DeliveryReview> {
    const maxAttempts = Math.max(1, this.config.maxAttempts ?? 1);
    let finalError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(this.config.timeoutMs ?? 20_000), body: JSON.stringify({ model: this.config.model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Return only JSON matching the ValueFlow delivery review schema.' }, { role: 'user', content: JSON.stringify(input) }] }) });
        if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = body.choices?.[0]?.message?.content;
        if (!content) throw new Error('AI provider returned no content');
        return deliveryReviewSchema.parse(JSON.parse(content));
      } catch (error) { finalError = error; }
    }
    throw finalError;
  }
  async respondToWorkspace(input: WorkspaceConversationInput): Promise<WorkspaceResponse> {
    const maxAttempts = Math.max(1, this.config.maxAttempts ?? 1);
    let finalError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
          signal: AbortSignal.timeout(Math.max(this.config.timeoutMs ?? 20_000, 90_000)),
          body: JSON.stringify({
            model: this.config.model,
            temperature: 0.3,
            response_format: { type: 'json_object' },
            ...this.longOutputOptions(),
            messages: [
              { role: 'system', content: WORKSPACE_SYSTEM_PROMPT },
              { role: 'system', content: JSON.stringify({ request: input.request, diagnosis: input.diagnosis ?? null }) },
              ...input.messages.map((message) => ({
                role: message.role === 'USER' ? 'user' : 'assistant',
                content: message.content,
              })),
            ],
          }),
        });
        if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = body.choices?.[0]?.message?.content;
        if (!content) throw new Error('AI provider returned no content');
        return workspaceResponseSchema.parse(JSON.parse(content));
      } catch (error) {
        finalError = error;
      }
    }
    throw finalError;
  }
  /** Builds a runnable single-file prototype for the request. Long outputs get a generous timeout. */
  async buildDemo(input: DemoBuildInput): Promise<DemoBuild> {
    const maxAttempts = Math.max(1, this.config.maxAttempts ?? 1);
    let finalError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
          signal: AbortSignal.timeout(Math.max(this.config.timeoutMs ?? 20_000, 240_000)),
          body: JSON.stringify({
            model: this.config.model,
            temperature: 0.4,
            response_format: { type: 'json_object' },
            ...this.longOutputOptions(),
            messages: [
              { role: 'system', content: DEMO_SYSTEM_PROMPT },
              { role: 'user', content: JSON.stringify({
                request: input.request,
                conversation: input.conversation.slice(-12),
                instruction: input.instruction ?? null,
                previousHtml: input.previousHtml ? input.previousHtml.slice(0, 60_000) : null,
              }) },
            ],
          }),
        });
        if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
        const body = await response.json() as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
        const choice = body.choices?.[0];
        const content = choice?.message?.content;
        if (!content) throw new Error('AI provider returned no content');
        if (choice?.finish_reason === 'length') throw new Error('Demo 超出单次生成长度，请简化需求后重试');
        return demoBuildSchema.parse(JSON.parse(content));
      } catch (error) {
        finalError = error;
      }
    }
    throw finalError;
  }

  /** DeepSeek defaults to short completions; documents and demos need room. */
  private longOutputOptions(): Record<string, unknown> {
    return this.config.model.startsWith('deepseek-') ? { thinking: { type: 'disabled' }, max_tokens: 8192 } : { max_tokens: 8192 };
  }

  private async requestTriage(input: TriageInput): Promise<ProjectTriage> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', headers: { authorization: `Bearer ${this.config.apiKey}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
      body: JSON.stringify({
        model: this.config.model, temperature: 0, response_format: { type: 'json_object' },
        ...(this.config.model.startsWith('deepseek-') ? { thinking: { type: 'disabled' }, max_tokens: 4096 } : {}),
        messages: [
          { role: 'system', content: '你是方片内部需求诊断助手。判断需求是否可由 AI 独立完成或需要人工项目协作。信息不足时在 reason 中明确说明，不编造业务事实。reason 和 requiredSkills 使用中文。仅输出严格 JSON，必须满足以下 JSON Schema，不要 Markdown 或额外字段：' + JSON.stringify(z.toJSONSchema(projectTriageSchema)) },
          { role: 'user', content: JSON.stringify(input) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content; if (!content) throw new Error('AI provider returned no content');
    return projectTriageSchema.parse(JSON.parse(content));
  }
}
export const manualTriageFallback = (input: Omit<ProjectTriage, 'confidence'>): ProjectTriage => projectTriageSchema.parse({ ...input, confidence: 0 });
