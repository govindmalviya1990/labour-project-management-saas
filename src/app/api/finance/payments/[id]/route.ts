import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updatePaymentSchema } from '@/lib/validations/finance';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT', 'LABOUR']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const payment = await prisma.payment.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
      include: {
        worker: { select: { id: true, name: true, category: true, workerCode: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error('Payment GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve payment' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const existing = await prisma.payment.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Check Day Lock on existing payment date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: existing.deletedById || session.userId,
      date: existing.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'Payment',
      entityId: existing.id,
      action: 'UPDATE',
      details: { oldAmount: existing.amount, workerId: existing.workerId },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    const body = await req.json();
    const validated = updatePaymentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid payment data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const newWorkerId = data.workerId || existing.workerId;
    const newDate = data.date ? new Date(data.date) : existing.date;
    const newAmount = data.amount !== undefined ? data.amount : existing.amount;
    const newType = data.transactionType || existing.transactionType;
    const newMethod = data.paymentMethod || existing.paymentMethod;
    const newRef = data.reference !== undefined ? data.reference : existing.reference;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: params.id },
        data: {
          workerId: newWorkerId,
          projectId: data.projectId !== undefined ? data.projectId : existing.projectId,
          siteId: data.siteId !== undefined ? data.siteId : existing.siteId,
          date: newDate,
          transactionType: newType,
          amount: newAmount,
          paymentMethod: newMethod,
          reference: newRef,
          notes: data.notes !== undefined ? data.notes : existing.notes,
        },
      });

      // If linked to fund transfer, update transfer too
      if (existing.fundTransferId) {
        await tx.fundTransfer.update({
          where: { id: existing.fundTransferId },
          data: {
            amount: newAmount,
            date: newDate,
            paymentMethod: newMethod,
          },
        });
      }

      // Update corresponding transaction in Khata ledger
      await tx.transaction.updateMany({
        where: { sourceId: params.id, organizationId: orgId },
        data: {
          workerId: newWorkerId,
          date: newDate,
          sourceType: newType,
          description: `${newType}: ${newMethod}${newRef ? ` (${newRef})` : ''}`,
          debit: newAmount,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      payment: result,
      warning: lockCheck.isVerifiedDay ? 'Modified entry on a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Payment PUT error:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const existing = await prisma.payment.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Check Day Lock on payment date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: session.userId,
      date: existing.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'Payment',
      entityId: existing.id,
      action: 'DELETE',
      details: { amount: existing.amount, workerId: existing.workerId },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // Soft-delete payment
      await tx.payment.update({
        where: { id: params.id },
        data: {
          deletedAt: new Date(),
          deletedById: session.userId,
        },
      });

      // If linked to fund transfer, soft-delete it too
      if (existing.fundTransferId) {
        await tx.fundTransfer.update({
          where: { id: existing.fundTransferId },
          data: {
            deletedAt: new Date(),
            deletedById: session.userId,
          },
        });
      }

      // Soft delete corresponding transaction in Khata ledger
      await tx.transaction.updateMany({
        where: { sourceId: params.id, organizationId: orgId },
        data: {
          deletedAt: new Date(),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Payment deleted successfully',
      warning: lockCheck.isVerifiedDay ? 'Deleted entry from a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Payment DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
