export type AppRole = 'OWNER' | 'MANAGER' | 'SITE_SUPERVISOR' | 'SUPERVISOR' | 'ACCOUNTANT' | 'LABOUR';

export const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 100,
  MANAGER: 80,
  ACCOUNTANT: 60,
  SITE_SUPERVISOR: 40,
  SUPERVISOR: 40,
  LABOUR: 20,
};

/**
 * Normalizes role string to canonical uppercase format and handles aliases.
 * Maps 'SUPERVISOR' -> 'SITE_SUPERVISOR'.
 */
export function normalizeRole(role?: string): string {
  if (!role) return 'LABOUR';
  const upper = role.trim().toUpperCase();
  if (upper === 'SUPERVISOR') return 'SITE_SUPERVISOR';
  return upper;
}

/**
 * Validates whether a user's role has permission for an operation.
 * - OWNER always has unrestricted access to all modules.
 * - SUPERVISOR and SITE_SUPERVISOR are treated interchangeably.
 */
export function hasRole(currentRole: string | undefined, allowedRoles: string[]): boolean {
  if (!currentRole) return false;
  const current = normalizeRole(currentRole);
  if (current === 'OWNER') return true; // Owner always has all permissions

  const normalizedAllowed = allowedRoles.map(normalizeRole);
  if (allowedRoles.includes('SUPERVISOR') && !normalizedAllowed.includes('SITE_SUPERVISOR')) {
    normalizedAllowed.push('SITE_SUPERVISOR');
  }
  if (allowedRoles.includes('SITE_SUPERVISOR') && !normalizedAllowed.includes('SUPERVISOR')) {
    normalizedAllowed.push('SUPERVISOR');
  }

  return normalizedAllowed.includes(current);
}
