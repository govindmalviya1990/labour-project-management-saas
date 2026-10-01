import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
      'ACCOUNTANT',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;

    const transfer = await prisma.fundTransfer.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } },
        toWorker: { select: { id: true, name: true, workerCode: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Fund transfer not found' }, { status: 404 });
    }

    return NextResponse.json({ transfer });
  } catch (error: any) {
    console.error('Error fetching transfer:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch transfer' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const transfer = await prisma.fundTransfer.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Fund transfer not found' }, { status: 404 });
    }

    const body = await req.json();

    // Check Day Lock on existing transfer date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: transfer.fromUserId,
      date: transfer.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'FundTransfer',
      entityId: transfer.id,
      action: 'UPDATE',
      details: { oldAmount: transfer.amount, type: transfer.transferType },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    const newAmount = body.amount !== undefined ? parseFloat(body.amount) : transfer.amount;
    const newDate = body.date ? new Date(body.date) : transfer.date;

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.fundTransfer.update({
        where: { id: params.id },
        data: {
          amount: newAmount,
          date: newDate,
          purpose: body.purpose || transfer.purpose,
          paymentMethod: body.paymentMethod || transfer.paymentMethod,
          notes: body.notes !== undefined ? body.notes : transfer.notes,
          reference: body.reference !== undefined ? body.reference : transfer.reference,
        },
      });

      // If linked payment exists, update it too
      if (transfer.linkedPaymentId) {
        await tx.payment.update({
          where: { id: transfer.linkedPaymentId },
          data: {
            amount: newAmount,
            date: newDate,
            notes: `Fund Transfer updated: ${body.notes || ''}`.trim(),
          },
        });

        // Also update ledger transaction
        await tx.transaction.updateMany({
          where: { sourceId: transfer.linkedPaymentId },
          data: {
            debit: newAmount,
            date: newDate,
          },
        });
      }

      return up;
    });

    return NextResponse.json({
      transfer: updated,
      warning: lockCheck.isVerifiedDay ? 'Modified entry on a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Error updating transfer:', error);
    return NextResponse.json({ error: error.message || 'Failed to update transfer' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const transfer = await prisma.fundTransfer.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Fund transfer not found' }, { status: 404 });
    }

    // Check Day Lock on transfer date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: transfer.fromUserId,
      date: transfer.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'FundTransfer',
      entityId: transfer.id,
      action: 'DELETE',
      details: { amount: transfer.amount, type: transfer.transferType },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Soft delete fund transfer
      await tx.fundTransfer.update({
        where: { id: params.id },
        data: {
          deletedAt: new Date(),
          deletedById: session.userId,
        },
      });

      // 2. Soft delete linked payment if exists
      if (transfer.linkedPaymentId) {
        await tx.payment.update({
          where: { id: transfer.linkedPaymentId },
          data: {
            deletedAt: new Date(),
            deletedById: session.userId,
          },
        });

        // 3. Soft delete linked worker transaction
        await tx.transaction.updateMany({
          where: { sourceId: transfer.linkedPaymentId },
          data: {
            deletedAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Fund transfer deleted successfully',
      warning: lockCheck.isVerifiedDay ? 'Deleted entry from a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Error deleting transfer:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete transfer' }, { status: 500 });
  }
}
