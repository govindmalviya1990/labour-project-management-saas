import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const tx = await prisma.bankTransaction.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    let warning: string | undefined = undefined;
    if (tx.partnerId) {
      const lockCheck = await verifyDayLock({
        organizationId: orgId,
        userId: tx.partnerId,
        date: tx.date,
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'BankTransaction',
        entityId: tx.id,
        action: 'DELETE',
        details: { amount: tx.amount, type: tx.type },
      });

      if (lockCheck.locked) {
        return NextResponse.json({ error: lockCheck.message }, { status: 403 });
      }
      if (lockCheck.isVerifiedDay) {
        warning = 'Deleted entry from a verified closed day (Audit logged)';
      }
    }

    // Soft delete
    await prisma.bankTransaction.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Bank transaction deleted successfully',
      warning,
    });
  } catch (error: any) {
    console.error('Error deleting bank transaction:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete bank transaction' }, { status: 500 });
  }
}
