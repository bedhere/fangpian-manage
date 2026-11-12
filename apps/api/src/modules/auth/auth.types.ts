export interface AccessPayload {
  sub: string;
  organizationId: string;
  email: string;
  type: 'access';
  tokenVersion?: number;
}
export interface RefreshPayload {
  tokenVersion?: number;
  sub: string;
  tokenId: string;
  familyId: string;
  type: 'refresh';
}
export interface RequestUser {
  username?: string | null;
  mustChangePassword?: boolean;
  tokenVersion?: number;
  id: string;
  organizationId: string;
  email: string;
  roles: string[];
  permissions: string[];
}
