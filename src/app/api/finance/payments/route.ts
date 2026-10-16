import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { createPaymentSchema } from '@/lib/validations/finance';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';
import { executeWorkerPayment } from '@/lib/finance/executeWorkerPayment';
import { getPartnerWalletBalance, getBankAccountBalance } from '@/lib/finance/partnerWallet';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Only OWNER, PARTNER, MANAGER, ACCOUNTANT, and LABOUR (for own records) can view payments
    // SUPERVISOR is strictly forbidden
    const auth = await checkRolePermission(['OWNER', 'PARTNER', 'MANAGER', 'ACCOUNTANT', 'LABOUR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const isLabour = normalizeRole(session.role) === 'LABOUR';

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get('workerId');
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (isLabour) {
      if (session.workerId) {
        where.workerId = session.workerId;
      } else {
        where.workerId = '__NONE__';
      }
    } else if (workerId && workerId !== 'ALL') {
      where.workerId = workerId;
    }

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
    // Only OWNER, PARTNER, MANAGER, and ACCOUNTANT can record payments
    // SUPERVISOR and LABOUR are strictly forbidden
    const auth = await checkRolePermission(['OWNER', 'PARTNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
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

    const sourceType = (data.sourceType || (data.bankAccountId ? 'BANK' : 'PARTNER')) as 'PARTNER' | 'BANK';
    const effectiveSourceId =
      data.sourceId ||
      (sourceType === 'BANK' ? data.bankAccountId : (data.walletOwnerId || session.userId));

    if (!effectiveSourceId) {
      return NextResponse.json(
        { error: 'Please select a paying partner wallet or company bank account' },
        { status: 400 }
      );
    }

    // Guardrail: check balance fresh before deducting
    if (sourceType === 'PARTNER') {
      const payingPartner = await prisma.user.findFirst({
        where: { id: effectiveSourceId },
        select: { id: true, name: true },
      });
      if (!payingPartner) {
        return NextResponse.json({ error: 'Paying partner not found' }, { status: 404 });
      }
      const wallet = await getPartnerWalletBalance(prisma, orgId, effectiveSourceId);
      if (wallet.balance < data.amount) {
        return NextResponse.json(
          {
            error: `Insufficient wallet balance for partner ${payingPartner.name}. Current balance: ₹${wallet.balance.toLocaleString('en-IN')}, required: ₹${data.amount.toLocaleString('en-IN')}`,
          },
          { status: 400 }
        );
      }
    } else {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: effectiveSourceId, organizationId: orgId, deletedAt: null },
      });
      if (!bankAccount) {
        return NextResponse.json({ error: 'Paying bank account not found' }, { status: 404 });
      }
      const bank = await getBankAccountBalance(prisma, effectiveSourceId);
      if (bank.balance < data.amount) {
        return NextResponse.json(
          {
            error: `Insufficient balance in ${bankAccount.name}. Current balance: ₹${bank.balance.toLocaleString('en-IN')}, required: ₹${data.amount.toLocaleString('en-IN')}`,
          },
          { status: 400 }
        );
      }
    }

    // Atomic transaction for payment creation & ledger audit entry using unified executeWorkerPayment
    const result = await prisma.$transaction(async (tx) => {
      const execResult = await executeWorkerPayment({
        tx,
        organizationId: orgId,
        worker,
        sourceType,
        sourceId: effectiveSourceId,
        category: data.transactionType,
        amount: data.amount,
        date: new Date(data.date),
        method: data.paymentMethod,
        projectId: data.projectId || null,
        siteId: data.siteId || null,
        reference: data.reference || null,
        remarks: data.notes || null,
        session: {
          userId: session.userId,
          name: session.name,
          email: session.email,
          role: session.role,
        },
      });
      return execResult.payment;
    });

    // Record Audit Surveillance Entry with 48h Undo Window
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userEmail: session.email,
      userRole: session.role,
      entityType: 'Payment',
      entityId: result.id,
      action: 'CREATE',
      newValue: result,
      details: formatAuditDetails('CREATE', 'Payment', {
        name: worker.name,
        amount: result.amount,
        category: result.transactionType,
      }),
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
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
