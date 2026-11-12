/** Read access to a group never implies write access to another person's goals. */
export function canEditDashboardTargets(identity: { employeeName: string; canViewAll: boolean }, employeeName: string): boolean {
  return identity.canViewAll || identity.employeeName === employeeName
}
