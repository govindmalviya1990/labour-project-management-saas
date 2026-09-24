import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyJWT, JWTPayload } from './jwt';
import { normalizeRole, hasRole, AppRole } from './roles';
import prisma from '../db/prisma';

export const AUTH_COOKIE_NAME = 'auth_token';

export type { AppRole };
export { normalizeRole, hasRole };

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  role?: string;
  organizationName?: string;
  workerId?: string;
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
  const role = activeMembership?.role || 'OWNER';

  let workerId: string | undefined;
  if (normalizeRole(role) === 'LABOUR' && activeMembership?.organizationId) {
    // If Labour, find matching worker record in organization
    const worker = await prisma.worker.findFirst({
      where: {
        organizationId: activeMembership.organizationId,
        deletedAt: null,
        OR: [
          ...(user.mobile ? [{ mobile: user.mobile }] : []),
          { name: { contains: user.name } },
        ],
      },
    });

    if (worker) {
      workerId = worker.id;
    } else {
      // Fallback: first active worker in org
      const firstWorker = await prisma.worker.findFirst({
        where: { organizationId: activeMembership.organizationId, deletedAt: null },
      });
      workerId = firstWorker?.id;
    }
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    organizationId: activeMembership?.organizationId,
    role,
    organizationName: activeMembership?.organization?.name,
    workerId,
  };
}

/**
 * Enforces authenticated tenant session. Throws UNAUTHORIZED if not authenticated.
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

/**
 * Enforces role authorization. Throws FORBIDDEN if the role is not allowed.
 */
export async function requireRole(allowedRoles: string[]): Promise<Required<UserSession>> {
  const session = await requireOrg();
  if (!hasRole(session.role, allowedRoles)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}

/**
 * Reusable API route helper that verifies authentication and role permissions.
 * If unauthorized, returns an immediate 401 or 403 NextResponse.
 * If authorized, returns `{ authorized: true, session }`.
 */
export async function checkRolePermission(allowedRoles: string[]) {
  try {
    const session = await requireOrg();
    if (!hasRole(session.role, allowedRoles)) {
      return {
        authorized: false as const,
        response: NextResponse.json(
          {
            error: `Access Denied: Your role '${session.role}' is not authorized for this operation. Permitted roles: ${allowedRoles.join(', ')}`,
            currentRole: session.role,
            allowedRoles,
          },
          { status: 403 }
        ),
      };
    }
    return {
      authorized: true as const,
      session,
    };
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { error: 'Authentication required. Please sign in.' },
          { status: 401 }
        ),
      };
    }
    if (error.message === 'NO_ORGANIZATION') {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { error: 'No active organization found. Please complete setup.' },
          { status: 403 }
        ),
      };
    }
    return {
      authorized: false as const,
      response: NextResponse.json(
        { error: error?.message || 'Access Denied' },
        { status: 403 }
      ),
    };
  }
}
