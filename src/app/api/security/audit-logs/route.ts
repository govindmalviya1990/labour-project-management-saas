import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Only OWNER and MANAGER can view full audit logs
    const auth = await checkRolePermission(['OWNER', 'MANAGER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const entityType = searchParams.get('entityType');
    const action = searchParams.get('action');
    const undoStatus = searchParams.get('undoStatus'); // CAN_UNDO, REVERTED, EXPIRED, ALL
    const search = searchParams.get('search');

    const now = new Date();
    const where: any = {
      organizationId: orgId,
    };

    if (entityType && entityType !== 'ALL') {
      where.entityType = entityType;
    }

    if (action && action !== 'ALL') {
      where.action = action;
    }

    if (undoStatus === 'CAN_UNDO') {
      where.isReverted = false;
      where.canUndoUntil = { gt: now };
    } else if (undoStatus === 'REVERTED') {
      where.isReverted = true;
    } else if (undoStatus === 'EXPIRED') {
      where.isReverted = false;
      where.canUndoUntil = { lte: now };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { details: { contains: q, mode: 'insensitive' } },
        { userName: { contains: q, mode: 'insensitive' } },
        { userEmail: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Compute undo availability countdown for each item
    const formattedLogs = logs.map((log) => {
      let canUndo = false;
      let remainingMs = 0;

      if (!log.isReverted && log.canUndoUntil) {
        remainingMs = new Date(log.canUndoUntil).getTime() - now.getTime();
        canUndo = remainingMs > 0;
      }

      return {
        ...log,
        canUndo,
        remainingMs: Math.max(0, remainingMs),
        remainingHours: Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60))),
        remainingMinutes: Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))),
      };
    });

    // Counts
    const [totalCount, activeUndoCount, revertedCount] = await Promise.all([
      prisma.auditLog.count({ where: { organizationId: orgId } }),
      prisma.auditLog.count({
        where: {
          organizationId: orgId,
          isReverted: false,
          canUndoUntil: { gt: now },
        },
      }),
      prisma.auditLog.count({
        where: {
          organizationId: orgId,
          isReverted: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      summary: {
        total: totalCount,
        activeUndoAvailable: activeUndoCount,
        revertedCount,
      },
    });
  } catch (error: any) {
    console.error('Audit logs GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve audit logs' },
      { status: 500 }
    );
  }
}
