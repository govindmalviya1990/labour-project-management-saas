import { cookies } from 'next/headers';
import { verifyJWT, JWTPayload } from './jwt';
import prisma from '../db/prisma';

export const AUTH_COOKIE_NAME = 'auth_token';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  role?: string;
  organizationName?: string;
}

/**
 * Retrieves and validates the current user session from the HTTP-only cookie.
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload || !payload.userId) return null;

  // Retrieve current active organization membership
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { organization: true },
        take: 1,
      },
    },
  });

  if (!user || user.status !== 'ACTIVE') return null;

  const activeMembership = user.memberships[0];

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    organizationId: activeMembership?.organizationId,
    role: activeMembership?.role,
    organizationName: activeMembership?.organization?.name,
  };
}

/**
 * Validates whether a user's role has permission for an operation.
 */
export function hasRole(currentRole: string | undefined, allowedRoles: string[]): boolean {
  if (!currentRole) return false;
  if (currentRole === 'OWNER') return true; // Owner has all permissions
  return allowedRoles.includes(currentRole);
}

/**
 * Enforces authenticated tenant session. Throws or returns 401/403.
 */
export async function requireAuth(): Promise<UserSession> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

/**
 * Enforces authenticated tenant session with an active organization.
 */
export async function requireOrg(): Promise<Required<UserSession>> {
  const session = await requireAuth();
  if (!session.organizationId || !session.role || !session.organizationName) {
    throw new Error('NO_ORGANIZATION');
  }
  return session as Required<UserSession>;
}
