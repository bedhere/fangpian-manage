import { describe, expect, it } from 'vitest';
import { assertContributionTotal, canAssignProjectOwner } from './team-policy.js';
describe('project team policy', () => {
  it('prevents assigning a second active owner', () => expect(canAssignProjectOwner('existing-owner', 'new-owner')).toEqual({ allowed: false, reason: 'PROJECT_OWNER_ALREADY_ASSIGNED' }));
  it('allows idempotent assignment to the same owner', () => expect(canAssignProjectOwner('same-owner', 'same-owner')).toEqual({ allowed: true }));
  it('requires contribution allocations to total exactly 100', () => { expect(assertContributionTotal([70,30])).toBe(true); expect(() => assertContributionTotal([80,30])).toThrow('CONTRIBUTION_TOTAL_MUST_EQUAL_100'); });
});
