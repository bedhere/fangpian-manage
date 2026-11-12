import { describe, expect, it } from 'vitest';
import { authorizeProjectReview } from './review-policy.js';
describe('project review policy', () => {
  it('denies publisher self review regardless of role', () => expect(authorizeProjectReview({ actorId: 'u1', publisherId: 'u1', permissions: new Set(['project:business-review']) }, 'BUSINESS')).toEqual({ allowed: false, reason: 'SELF_REVIEW_FORBIDDEN' }));
  it('allows an independent reviewer with the stage permission', () => expect(authorizeProjectReview({ actorId: 'u2', publisherId: 'u1', permissions: new Set(['project:technical-review']) }, 'TECHNICAL')).toEqual({ allowed: true }));
  it('denies business review from a different department', () => expect(authorizeProjectReview({
    actorId: 'u2', publisherId: 'u1', actorDepartmentId: 'sales', publisherDepartmentId: 'marketing',
    permissions: new Set(['project:business-review']),
  }, 'BUSINESS')).toEqual({ allowed: false, reason: 'WRONG_DEPARTMENT' }));
  it('allows the same person to perform both review stages when authorized', () => expect(authorizeProjectReview({
    actorId: 'u2', publisherId: 'u1', priorBusinessReviewerId: 'u2',
    permissions: new Set(['project:technical-review']),
  }, 'TECHNICAL')).toEqual({ allowed: true }));
  it('still requires technical permission after business approval', () => expect(authorizeProjectReview({ actorId: 'u2', publisherId: 'u1', priorBusinessReviewerId: 'u2', permissions: new Set(['project:business-review']) }, 'TECHNICAL')).toEqual({ allowed: false, reason: 'PERMISSION_REQUIRED' }));
  it('still forbids the publisher from performing technical review', () => expect(authorizeProjectReview({ actorId: 'u1', publisherId: 'u1', priorBusinessReviewerId: 'u1', permissions: new Set(['project:technical-review']) }, 'TECHNICAL')).toEqual({ allowed: false, reason: 'SELF_REVIEW_FORBIDDEN' }));
});
