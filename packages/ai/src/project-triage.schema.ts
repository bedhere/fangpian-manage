import { z } from 'zod';
export const projectTriageSchema = z.object({
  aiCanCompleteAlone: z.boolean(), shouldCreateProject: z.boolean(), confidence: z.number().min(0).max(1),
  businessValueScore: z.number().int().min(0).max(100), technicalComplexityScore: z.number().int().min(0).max(100), urgencyScore: z.number().int().min(0).max(100),
  recommendedProjectLevel: z.enum(['P0','P1','P2','P3','P4']), requiredCapabilityLevel: z.number().int().min(0).max(4), estimatedHours: z.number().positive().max(10_000),
  requiredSkills: z.array(z.string().min(1)).max(20), reason: z.string().min(1).max(4000),
}).strict();
export type ProjectTriage = z.infer<typeof projectTriageSchema>;
