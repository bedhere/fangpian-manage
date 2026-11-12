import { z } from 'zod';

export const workspaceResponseSchema = z.object({
  message: z.string().trim().min(1).max(20_000),
  result: z.record(z.string(), z.unknown()).optional(),
  isComplete: z.boolean(),
  confidence: z.number().min(0).max(1),
}).strict();

export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;

export interface WorkspaceConversationMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface WorkspaceConversationInput {
  request: {
    title: string;
    problem: string;
    businessContext: string;
    expectedOutcome: string;
    constraints?: string | null;
  };
  diagnosis?: Record<string, unknown> | null;
  messages: WorkspaceConversationMessage[];
}
