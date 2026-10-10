import prisma from '@/lib/db/prisma';

export interface RecordLoginParams {
  organizationId?: string | null;
  userId?: string | null;
  userEmail: string;
  userName?: string | null;
  role?: string | null;
  portal?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: 'SUCCESS' | 'FAILED';
}

export interface RecordAuditParams {
  organizationId: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  entityType: string; // Expense, Attendance, Payment, Worker, Project, MaterialReceipt, etc.
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  oldValue?: any;
  newValue?: any;
  details?: string | null;
  ipAddress?: string | null;
}

/**
 * 1. Logs user authentication and portal logins (Owner, Supervisor, Worker, Accountant)
 */
export async function recordLogin(params: RecordLoginParams) {
  try {
    return await prisma.loginHistory.create({
      data: {
        organizationId: params.organizationId || null,
        userId: params.userId || null,
        userEmail: params.userEmail,
        userName: params.userName || null,
        role: params.role || null,
        portal: params.portal || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent ? params.userAgent.substring(0, 500) : null,
        status: params.status || 'SUCCESS',
      },
    });
  } catch (error) {
    console.error('Failed to record login history:', error);
    return null;
  }
}

/**
 * 2. Records an audit entry with a 48-hour undo window
 */
export async function recordAudit(params: RecordAuditParams) {
  try {
    const now = new Date();
    // 48 hours window from creation
    const canUndoUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const oldStr = params.oldValue !== undefined ? JSON.stringify(params.oldValue) : null;
    const newStr = params.newValue !== undefined ? JSON.stringify(params.newValue) : null;

    return await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId || null,
        userName: params.userName || null,
        userEmail: params.userEmail || null,
        userRole: params.role || params.userRole || null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValue: oldStr,
        newValue: newStr,
        details: params.details || null,
        ipAddress: params.ipAddress || null,
        canUndoUntil,
        status: 'ACTIVE',
      },
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
    return null;
  }
}

/**
 * Helper to generate human-friendly bilingual descriptions
 */
export function formatAuditDetails(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  meta?: { name?: string; amount?: number; category?: string; date?: string | Date }
): string {
  const entityLabels: Record<string, string> = {
    Expense: 'खर्चा (Expense)',
    Attendance: 'हाजिरी (Attendance)',
    Payment: 'भुगतान (Payment/Salary)',
    Worker: 'मजदूर (Worker)',
    Project: 'प्रोजेक्ट (Project)',
    ProjectSite: 'साइट (Site)',
    MaterialReceipt: 'सामग्री रसीद (Material Receipt)',
    FundTransfer: 'फंड ट्रांसफर (Fund Transfer)',
    Quotation: 'कोटेशन (Quotation)',
    BankAccount: 'बैंक खाता (Bank Account)',
  };

  const label = entityLabels[entityType] || entityType;
  const amountStr = meta?.amount !== undefined ? `₹${meta.amount.toLocaleString('en-IN')}` : '';
  const nameStr = meta?.name ? `"${meta.name}"` : '';

  if (action === 'CREATE') {
    return `नया ${label} जोड़ा गया: ${[nameStr, amountStr, meta?.category].filter(Boolean).join(' - ')}`;
  }
  if (action === 'UPDATE') {
    return `${label} अपडेट किया गया: ${[nameStr, amountStr].filter(Boolean).join(' ')}`;
  }
  if (action === 'DELETE') {
    return `${label} हटाया गया: ${[nameStr, amountStr, meta?.category].filter(Boolean).join(' - ')}`;
  }
  return `${label} पर कार्रवाई (${action})`;
}

/**
 * 3. Reverts/Undoes any change or deletion within 48 hours
 */
export async function undoAuditAction(params: {
  auditId: string;
  organizationId: string;
  ownerUserId: string;
  ownerName: string;
}) {
  const audit = await prisma.auditLog.findUnique({
    where: { id: params.auditId },
  });

  if (!audit || audit.organizationId !== params.organizationId) {
    throw new Error('ऑडिट रिकॉर्ड नहीं मिला (Audit record not found)');
  }

  if (audit.isReverted) {
    throw new Error('यह कार्रवाई पहले ही पूर्ववत (Undo) की जा चुकी है');
  }

  // 48-hour expiration check
  const now = new Date();
  if (audit.canUndoUntil && now > new Date(audit.canUndoUntil)) {
    // Mark as permanently expired
    await prisma.auditLog.update({
      where: { id: audit.id },
      data: { status: 'PERMANENT_EXPIRED' },
    });
    throw new Error('48 घंटे की समय सीमा समाप्त हो चुकी है। अब इसे पूर्ववत (Undo) नहीं किया जा सकता।');
  }

  const { entityType, entityId, action, oldValue, newValue } = audit;
  const oldData = oldValue ? JSON.parse(oldValue) : null;
  const newData = newValue ? JSON.parse(newValue) : null;

  // Perform reverse action according to entity type
  if (action === 'DELETE') {
    // RESTORE DELETED RECORD
    await restoreDeletedEntity(entityType, entityId, oldData, params.organizationId);
  } else if (action === 'UPDATE') {
    // REVERT MODIFIED FIELDS BACK TO OLD VALUE
    if (!oldData) {
      throw new Error('पूर्ववत करने के लिए पुराना डेटा उपलब्ध नहीं है');
    }
    await revertUpdatedEntity(entityType, entityId, oldData);
  } else if (action === 'CREATE') {
    // UNDO CREATION: Soft delete or remove newly added record
    await undoCreatedEntity(entityType, entityId);
  }

  // Update audit log record
  const updatedAudit = await prisma.auditLog.update({
    where: { id: audit.id },
    data: {
      isReverted: true,
      revertedAt: now,
      revertedById: params.ownerUserId,
      revertedByName: params.ownerName,
      status: 'REVERTED',
    },
  });

  // Record a RESTORE event
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.ownerUserId,
      userName: params.ownerName,
      userRole: 'OWNER',
      entityType,
      entityId,
      action: 'RESTORE',
      oldValue: newValue,
      newValue: oldValue,
      details: `कार्रवाई [${action}] को स्वामी द्वारा पूर्ववत (Undo) किया गया: ${audit.details || entityType}`,
      canUndoUntil: null,
      status: 'REVERTED',
    },
  });

  return updatedAudit;
}

/**
 * Entity Restore Handler for DELETED records
 */
async function restoreDeletedEntity(entityType: string, entityId: string, oldData: any, organizationId: string) {
  switch (entityType) {
    case 'Expense':
      await prisma.expense.update({
        where: { id: entityId },
        data: { deletedAt: null, deletedById: null },
      });
      break;

    case 'Attendance':
      await prisma.attendance.update({
        where: { id: entityId },
        data: { deletedAt: null, deletedById: null },
      });
      break;

    case 'Payment':
      await prisma.payment.update({
        where: { id: entityId },
        data: { deletedAt: null, deletedById: null },
      });
      break;

    case 'Worker':
      await prisma.worker.update({
        where: { id: entityId },
        data: { deletedAt: null, status: 'ACTIVE' },
      });
      break;

    case 'Project':
      await prisma.project.update({
        where: { id: entityId },
        data: { deletedAt: null, deletedById: null },
      });
      break;

    case 'ProjectSite':
      await prisma.projectSite.update({
        where: { id: entityId },
        data: { deletedAt: null, deletedById: null },
      });
      break;

    case 'MaterialReceipt':
      await prisma.materialReceipt.update({
        where: { id: entityId },
        data: { deletedAt: null, deletedById: null },
      });
      break;

    case 'FundTransfer':
      await prisma.fundTransfer.update({
        where: { id: entityId },
        data: { deletedAt: null, deletedById: null },
      });
      break;

    case 'Allowance':
      await prisma.allowance.update({
        where: { id: entityId },
        data: { deletedAt: null },
      });
      break;

    case 'BankAccount':
      await prisma.bankAccount.update({
        where: { id: entityId },
        data: { deletedAt: null, isActive: true },
      });
      break;

    default:
      throw new Error(`Restore is not supported for entity ${entityType}`);
  }
}

/**
 * Entity Revert Handler for UPDATED records
 */
async function revertUpdatedEntity(entityType: string, entityId: string, oldData: any) {
  // Strip non-updatable relational/timestamp fields
  const { id, createdAt, updatedAt, organizationId, organization, user, ...updatable } = oldData;

  // Convert date strings back to Date objects if present
  if (updatable.date) updatable.date = new Date(updatable.date);
  if (updatable.joiningDate) updatable.joiningDate = new Date(updatable.joiningDate);
  if (updatable.startDate) updatable.startDate = new Date(updatable.startDate);

  switch (entityType) {
    case 'Expense':
      await prisma.expense.update({ where: { id: entityId }, data: updatable });
      break;
    case 'Attendance':
      await prisma.attendance.update({ where: { id: entityId }, data: updatable });
      break;
    case 'Payment':
      await prisma.payment.update({ where: { id: entityId }, data: updatable });
      break;
    case 'Worker':
      await prisma.worker.update({ where: { id: entityId }, data: updatable });
      break;
    case 'Project':
      await prisma.project.update({ where: { id: entityId }, data: updatable });
      break;
    case 'ProjectSite':
      await prisma.projectSite.update({ where: { id: entityId }, data: updatable });
      break;
    case 'MaterialReceipt':
      await prisma.materialReceipt.update({ where: { id: entityId }, data: updatable });
      break;
    case 'FundTransfer':
      await prisma.fundTransfer.update({ where: { id: entityId }, data: updatable });
      break;
    default:
      throw new Error(`Revert is not supported for entity ${entityType}`);
  }
}

/**
 * Entity Undo Handler for CREATED records (Soft-delete or purge newly created entity)
 */
async function undoCreatedEntity(entityType: string, entityId: string) {
  const now = new Date();
  switch (entityType) {
    case 'Expense':
      await prisma.expense.update({ where: { id: entityId }, data: { deletedAt: now } });
      break;
    case 'Attendance':
      await prisma.attendance.update({ where: { id: entityId }, data: { deletedAt: now } });
      break;
    case 'Payment':
      await prisma.payment.update({ where: { id: entityId }, data: { deletedAt: now } });
      break;
    case 'Worker':
      await prisma.worker.update({ where: { id: entityId }, data: { deletedAt: now, status: 'INACTIVE' } });
      break;
    case 'Project':
      await prisma.project.update({ where: { id: entityId }, data: { deletedAt: now } });
      break;
    case 'ProjectSite':
      await prisma.projectSite.update({ where: { id: entityId }, data: { deletedAt: now } });
      break;
    case 'MaterialReceipt':
      await prisma.materialReceipt.update({ where: { id: entityId }, data: { deletedAt: now } });
      break;
    case 'FundTransfer':
      await prisma.fundTransfer.update({ where: { id: entityId }, data: { deletedAt: now } });
      break;
    default:
      throw new Error(`Undo create is not supported for entity ${entityType}`);
  }
}

/**
 * 4. Permanently deletes records that were deleted over 48 hours ago
 */
export async function purgePermanentExpired(organizationId: string) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Mark audit logs as PERMANENT_EXPIRED if past 48h
  await prisma.auditLog.updateMany({
    where: {
      organizationId,
      canUndoUntil: { lte: new Date() },
      status: 'ACTIVE',
    },
    data: { status: 'PERMANENT_EXPIRED' },
  });

  // Permanently delete soft-deleted records older than 48 hours
  const [expenses, attendances, payments] = await Promise.all([
    prisma.expense.deleteMany({
      where: { organizationId, deletedAt: { lte: cutoff } },
    }),
    prisma.attendance.deleteMany({
      where: { organizationId, deletedAt: { lte: cutoff } },
    }),
    prisma.payment.deleteMany({
      where: { organizationId, deletedAt: { lte: cutoff } },
    }),
  ]);

  return {
    purgedExpenses: expenses.count,
    purgedAttendances: attendances.count,
    purgedPayments: payments.count,
    cutoffTime: cutoff.toISOString(),
  };
}
