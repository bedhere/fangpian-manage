import { z } from 'zod';

const score = z.number().min(0).max(100);

export const deliveryReviewSchema = z.object({
  businessFit: score,
  technicalQuality: score,
  completeness: score,
  risk: score,
  suggestedGrade: z.enum(['S', 'A', 'B', 'C', 'FAIL']),
  reasoningSummary: z.string().min(1),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type DeliveryReview = z.infer<typeof deliveryReviewSchema>;
