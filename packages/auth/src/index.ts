export interface AuthenticatedUser { id: string; organizationId: string; email: string; roles: string[]; permissions: string[] }
export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number }
