import { describe, expect, it } from 'vitest';
import { authorizeDeliveryAcceptance } from './delivery-acceptance-policy.js';

const project = {
  publisherId: 'publisher',
  departmentHeadId: 'head',
  ownerId: 'owner',
  ownerManagerId: 'manager',
};

describe('delivery acceptance policy', () => {
  it('allows only the person assigned to each acceptance role', () => {
    expect(
      authorizeDeliveryAcceptance(
        'head',
        'DEPARTMENT_HEAD_BUSINESS',
        project,
      ),
    ).toEqual({ allowed: true });
    expect(
      authorizeDeliveryAcceptance('publisher', 'OWNER_MANAGER_TECHNICAL', project),
    ).toEqual({ allowed: false, reason: 'ACCEPTANCE_REVIEWER_MISMATCH' });
  });

  it('forbids an owner from scoring their own business result', () => {
    expect(
      authorizeDeliveryAcceptance(
        'owner',
        'PUBLISHER_BUSINESS',
        { ...project, publisherId: 'owner' },
      ),
    ).toEqual({ allowed: false, reason: 'OWNER_SELF_BUSINESS_RATING_FORBIDDEN' });
  });
});
