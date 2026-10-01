import prisma from '@/lib/db/prisma';
import { normalizeRole } from '@/lib/auth/roles';

export interface DayLockCheckResult {
  locked: boolean;
  message?: string;
  isVerifiedDay: boolean;
  closing?: any;
}

/**
 * Normalizes any Date or date string to start of day UTC for consistent DailyClosing lookup.
 */
export function getStartOfDayUTC(dateInput: Date | string): Date {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Checks if the day of a transaction has already been verified in DailyClosing.
 * - If verified and user is NOT OWNER, the transaction cannot be modified or deleted (locked = true).
 * - If verified and user IS OWNER, permits operation (locked = false) and creates an AuditLog record.
 */
export async function verifyDayLock(params: {
  organizationId: string;
  userId: string;          // User whose cash closing governs the record (e.g. walletOwnerId, receivedById, fromUserId)
  date: Date | string;
  actorUserId: string;     // The user performing the edit/delete
  actorRole: string;
  entityType: string;
  entityId: string;
  action: 'UPDATE' | 'DELETE';
  details?: Record<string, any>;
}): Promise<DayLockCheckResult> {
  const startOfDay = getStartOfDayUTC(params.date);

  const closing = await prisma.dailyClosing.findFirst({
    where: {
      organizationId: params.organizationId,
      userId: params.userId,
      date: startOfDay,
      isVerified: true,
    },
  });

  if (!closing) {
    return { locked: false, isVerifiedDay: false };
  }

  const isOwner = normalizeRole(params.actorRole) === 'OWNER';

  if (!isOwner) {
    return {
      locked: true,
      isVerifiedDay: true,
      message: `The daily cash closing for date ${new Date(params.date).toLocaleDateString()} has been verified and locked. Only an OWNER can modify or delete verified records.`,
      closing,
    };
  }

  // If Owner, allow modification and write an AuditLog entry
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.actorUserId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: `${params.action}_VERIFIED_DAY`,
        oldValue: params.details ? JSON.stringify(params.details) : undefined,
        newValue: JSON.stringify({
          warning: 'Record modified on a verified closed day by OWNER',
          verifiedAt: closing.verifiedAt,
          verifiedById: closing.verifiedById,
          date: startOfDay.toISOString(),
        }),
      },
    });
  } catch (err) {
    console.error('Failed to log audit entry for verified day modification:', err);
  }

  return { locked: false, isVerifiedDay: true, closing };
}
