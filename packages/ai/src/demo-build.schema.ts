import { z } from 'zod';

/** A runnable single-file prototype produced by the AI workspace. */
export const demoBuildSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(2000),
  howToUse: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  html: z.string().min(200).max(400_000).refine(
    (html) => /<html[\s>]/i.test(html) && /<\/html>/i.test(html),
    'html 必须是完整的 HTML 文档',
  ),
});

export type DemoBuild = z.infer<typeof demoBuildSchema>;

export interface DemoBuildInput {
  request: {
    title: string;
    problem: string;
    businessContext: string;
    expectedOutcome: string;
    constraints?: string | null;
  };
  /** Earlier conversation, so the demo reflects what the user already asked for. */
  conversation: Array<{ role: 'USER' | 'ASSISTANT'; content: string }>;
  /** Extra direction for this build, e.g. "加一个导出按钮". */
  instruction?: string;
  /** The previous demo's HTML when the user asks for a revision. */
  previousHtml?: string;
}
