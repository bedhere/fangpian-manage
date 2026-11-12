import { canReviewResource, type AuthorizationDecision, type ReviewContext } from '../auth/policies.js';
export type ReviewStage = 'BUSINESS' | 'TECHNICAL';
export const authorizeProjectReview = (context: ReviewContext, stage: ReviewStage): AuthorizationDecision => {
  const base = canReviewResource(context, stage === 'BUSINESS' ? 'project:business-review' : 'project:technical-review');
  if (!base.allowed) return base;
  if (stage === 'BUSINESS' && context.actorDepartmentId !== undefined && context.publisherDepartmentId !== undefined && context.actorDepartmentId !== context.publisherDepartmentId) {
    return { allowed: false, reason: 'WRONG_DEPARTMENT' };
  }
  return { allowed: true };
};
