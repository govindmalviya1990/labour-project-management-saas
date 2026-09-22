import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { createPaymentSchema } from '@/lib/validations/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get('workerId');
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (workerId && workerId !== 'ALL') where.workerId = workerId;
    if (projectId && projectId !== 'ALL') where.projectId = projectId;
    if (type && type !== 'ALL') where.transactionType = type;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true, category: true, workerCode: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalPaid = payments
      .filter((p) => p.transactionType !== 'ADVANCE')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAdvances = payments
      .filter((p) => p.transactionType === 'ADVANCE')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return NextResponse.json({
      payments,
      summary: {
        totalRecords: payments.length,
        totalPaid,
        totalAdvances,
        grandTotal: totalPaid + totalAdvances,
      },
    });
  } catch (error: any) {
    console.error('Payments GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve payments' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createPaymentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid payment data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Verify worker exists in tenant
    const worker = await prisma.worker.findFirst({
      where: { id: data.workerId, organizationId: orgId, deletedAt: null },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Atomic transaction for payment creation & ledger audit entry
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId: orgId,
          workerId: data.workerId,
          projectId: data.projectId || null,
          siteId: data.siteId || null,
          date: new Date(data.date),
          transactionType: data.transactionType,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          reference: data.reference || null,
          notes: data.notes || null,
        },
      });

      // Record transaction in Khata ledger table
      await tx.transaction.create({
        data: {
          organizationId: orgId,
          workerId: data.workerId,
          date: new Date(data.date),
          sourceType: data.transactionType,
          sourceId: payment.id,
          description: `${data.transactionType}: ${data.paymentMethod}${data.reference ? ` (${data.reference})` : ''}`,
          debit: data.amount, // Payment reduces contractor liability to worker
          credit: 0,
        },
      });

      return payment;
    });

    return NextResponse.json({
      success: true,
      payment: result,
      message: `${data.transactionType} recorded successfully`,
    });
  } catch (error: any) {
    console.error('Payment POST error:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
