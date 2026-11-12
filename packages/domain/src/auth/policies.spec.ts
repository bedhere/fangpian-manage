import { describe, expect, it } from 'vitest';
import { canReviewResource, hasEveryPermission, hasSomePermission } from './policies.js';

describe('authorization policies', () => {
  it('aggregates required permissions deterministically', () => {
    const granted = new Set(['project:read', 'project:business-review']);
    expect(hasEveryPermission(granted, ['project:read'])).toBe(true);
    expect(hasEveryPermission(granted, ['project:read', 'project:write'])).toBe(false);
    expect(hasSomePermission(granted, ['project:write', 'project:business-review'])).toBe(true);
  });

  it('forbids reviewing your own resource even with review permission', () => {
    expect(canReviewResource({ actorId: 'u1', publisherId: 'u1', permissions: new Set(['project:business-review']) }, 'project:business-review')).toEqual({ allowed: false, reason: 'SELF_REVIEW_FORBIDDEN' });
  });

  it('requires the requested permission for another user resource', () => {
    expect(canReviewResource({ actorId: 'u2', publisherId: 'u1', permissions: new Set() }, 'project:technical-review')).toEqual({ allowed: false, reason: 'PERMISSION_REQUIRED' });
  });
});
