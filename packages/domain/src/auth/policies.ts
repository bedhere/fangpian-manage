export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: 'SELF_REVIEW_FORBIDDEN' | 'PERMISSION_REQUIRED' | 'WRONG_DEPARTMENT' | 'DUAL_REVIEW_FORBIDDEN' };

export interface ReviewContext {
  actorId: string;
  publisherId: string;
  actorDepartmentId?: string | null;
  publisherDepartmentId?: string;
  priorBusinessReviewerId?: string;
  permissions: ReadonlySet<string>;
}

export const hasEveryPermission = (granted: ReadonlySet<string>, required: readonly string[]): boolean =>
  required.every((permission) => granted.has(permission));

export const hasSomePermission = (granted: ReadonlySet<string>, required: readonly string[]): boolean =>
  required.some((permission) => granted.has(permission));

export const canReviewResource = (context: ReviewContext, permission: string): AuthorizationDecision => {
  if (context.actorId === context.publisherId) return { allowed: false, reason: 'SELF_REVIEW_FORBIDDEN' };
  if (!context.permissions.has(permission)) return { allowed: false, reason: 'PERMISSION_REQUIRED' };
  return { allowed: true };
};
