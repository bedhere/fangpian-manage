export type DeliveryAcceptanceRole =
  | 'PUBLISHER_BUSINESS'
  | 'DEPARTMENT_HEAD_BUSINESS'
  | 'OWNER_MANAGER_TECHNICAL';

export type DeliveryAcceptanceContext = {
  publisherId: string;
  departmentHeadId: string | null;
  ownerId: string | null;
  ownerManagerId: string | null;
};

export function authorizeDeliveryAcceptance(
  actorId: string,
  role: DeliveryAcceptanceRole,
  project: DeliveryAcceptanceContext,
): { allowed: true } | { allowed: false; reason: string } {
  const assigned =
    (role === 'PUBLISHER_BUSINESS' && actorId === project.publisherId) ||
    (role === 'DEPARTMENT_HEAD_BUSINESS' &&
      actorId === project.departmentHeadId) ||
    (role === 'OWNER_MANAGER_TECHNICAL' &&
      actorId === project.ownerManagerId);
  if (!assigned)
    return { allowed: false, reason: 'ACCEPTANCE_REVIEWER_MISMATCH' };
  if (
    actorId === project.ownerId &&
    (role === 'PUBLISHER_BUSINESS' || role === 'DEPARTMENT_HEAD_BUSINESS')
  )
    return {
      allowed: false,
      reason: 'OWNER_SELF_BUSINESS_RATING_FORBIDDEN',
    };
  return { allowed: true };
}
