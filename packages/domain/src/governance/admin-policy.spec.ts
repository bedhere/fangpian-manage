import { describe, expect, it } from 'vitest';
import {
  assertCanDeactivateAdministrator,
  assertDepartmentParentIsAcyclic,
  assertPermissionGrantIsBounded,
} from './admin-policy.js';

describe('admin governance policy', () => {
  it('protects the final active super administrator', () => {
    expect(() => assertCanDeactivateAdministrator(true, 1)).toThrow(
      'LAST_SUPER_ADMIN',
    );
    expect(() => assertCanDeactivateAdministrator(true, 2)).not.toThrow();
  });

  it('rejects a department parent that is itself or one of its descendants', () => {
    const parents = new Map([
      ['sales', null],
      ['east', 'sales'],
      ['retail', 'east'],
    ]);
    expect(() =>
      assertDepartmentParentIsAcyclic('sales', 'retail', parents),
    ).toThrow('CYCLIC_DEPARTMENT');
    expect(() =>
      assertDepartmentParentIsAcyclic('retail', 'sales', parents),
    ).not.toThrow();
  });

  it('does not let an administrator grant permissions they do not hold', () => {
    expect(() =>
      assertPermissionGrantIsBounded(
        ['user:manage'],
        ['user:manage', 'role:manage'],
      ),
    ).toThrow('PERMISSION_ESCALATION');
    expect(() =>
      assertPermissionGrantIsBounded(
        ['user:manage', 'role:manage'],
        ['user:manage'],
      ),
    ).not.toThrow();
  });
});
