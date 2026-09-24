import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updatePaymentSchema } from '@/lib/validations/finance';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT', 'LABOUR']);
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
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const existing = await prisma.payment.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
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
          ...(data.workerId ? { workerId: data.workerId } : {}),
          ...(data.projectId !== undefined ? { projectId: data.projectId || null } : {}),
          ...(data.siteId !== undefined ? { siteId: data.siteId || null } : {}),
          ...(data.date ? { date: new Date(data.date) } : {}),
          ...(data.transactionType ? { transactionType: data.transactionType } : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
          ...(data.reference !== undefined ? { reference: data.reference || null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        },
      });

      // Also update linked Khata ledger transaction if exists
      const existingTx = await tx.transaction.findFirst({
        where: { sourceId: params.id, organizationId: orgId },
      });

      if (existingTx) {
        await tx.transaction.update({
          where: { id: existingTx.id },
          data: {
            workerId: newWorkerId,
            date: newDate,
            sourceType: newType,
            description: `${newType}: ${newMethod}${newRef ? ` (${newRef})` : ''}`,
            debit: newAmount,
          },
        });
      }

      return updated;
    });

    return NextResponse.json({ success: true, payment: result });
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
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const existing = await prisma.payment.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Soft-delete or hard-delete payment
      await tx.payment.delete({
        where: { id: params.id },
      });

      // Remove corresponding transaction from Khata ledger
      await tx.transaction.deleteMany({
        where: { sourceId: params.id, organizationId: orgId },
      });
    });

    return NextResponse.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error: any) {
    console.error('Payment DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
