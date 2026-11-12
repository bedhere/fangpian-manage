export function assertCanDeactivateAdministrator(
  targetIsSuperAdministrator: boolean,
  activeSuperAdministratorCount: number,
) {
  if (targetIsSuperAdministrator && activeSuperAdministratorCount <= 1) {
    throw new Error('LAST_SUPER_ADMIN');
  }
}

export function assertDepartmentParentIsAcyclic(
  departmentId: string,
  nextParentId: string | null,
  currentParents: ReadonlyMap<string, string | null>,
) {
  const visited = new Set<string>();
  let cursor = nextParentId;
  while (cursor) {
    if (cursor === departmentId || visited.has(cursor)) {
      throw new Error('CYCLIC_DEPARTMENT');
    }
    visited.add(cursor);
    cursor = currentParents.get(cursor) ?? null;
  }
}

export function assertPermissionGrantIsBounded(
  actorPermissions: readonly string[],
  requestedPermissions: readonly string[],
) {
  const allowed = new Set(actorPermissions);
  if (requestedPermissions.some((permission) => !allowed.has(permission))) {
    throw new Error('PERMISSION_ESCALATION');
  }
}
