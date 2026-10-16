import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createAllowanceSchema } from '@/lib/validations/finance';
import { executeWorkerPayment } from '@/lib/finance/executeWorkerPayment';
import { getPartnerWalletBalance, getBankAccountBalance } from '@/lib/finance/partnerWallet';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'PARTNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get('workerId');
    const projectId = searchParams.get('projectId');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (workerId && workerId !== 'ALL') where.workerId = workerId;
    if (projectId && projectId !== 'ALL') where.projectId = projectId;

    const allowances = await prisma.allowance.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true, category: true, workerCode: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalAmount = allowances.reduce((sum, a) => sum + (a.amount || 0), 0);

    return NextResponse.json({
      allowances,
      totalAmount,
      count: allowances.length,
    });
  } catch (error: any) {
    console.error('Allowances GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve allowances' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'PARTNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createAllowanceSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid allowance data' },
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

    const sourceType = (data.sourceType || 'PARTNER') as 'PARTNER' | 'BANK';
    const effectiveSourceId = data.sourceId || (sourceType === 'PARTNER' ? session.userId : null);

    if (data.isPaidNow) {
      if (!effectiveSourceId) {
        return NextResponse.json(
          { error: 'Please select a paying partner wallet or company bank account' },
          { status: 400 }
        );
      }
      if (sourceType === 'PARTNER') {
        const wallet = await getPartnerWalletBalance(prisma, orgId, effectiveSourceId);
        if (wallet.balance < data.amount) {
          const payingPartner = await prisma.user.findFirst({
            where: { id: effectiveSourceId },
            select: { name: true },
          });
          return NextResponse.json(
            {
              error: `Insufficient wallet balance for partner ${payingPartner?.name || 'selected'}. Current balance: ₹${wallet.balance.toLocaleString('en-IN')}, required: ₹${data.amount.toLocaleString('en-IN')}`,
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
    }

    const result = await prisma.$transaction(async (tx) => {
      const allowance = await tx.allowance.create({
        data: {
          organizationId: orgId,
          workerId: data.workerId,
          projectId: data.projectId || null,
          siteId: data.siteId || null,
          date: new Date(data.date),
          type: data.type,
          amount: data.amount,
          description: data.description || null,
        },
      });

      // Credit worker ledger with allowance
      await tx.transaction.create({
        data: {
          organizationId: orgId,
          workerId: data.workerId,
          date: new Date(data.date),
          sourceType: 'ALLOWANCE',
          sourceId: allowance.id,
          description: `Allowance: ${data.type}${data.description ? ` (${data.description})` : ''}`,
          debit: 0,
          credit: data.amount, // Increases worker earnings
        },
      });

      // If marked as paid immediately, debit source wallet or bank account and record payment
      if (data.isPaidNow && effectiveSourceId) {
        await executeWorkerPayment({
          tx,
          organizationId: orgId,
          worker,
          sourceType,
          sourceId: effectiveSourceId,
          category: `ALLOWANCE_${data.type}`,
          amount: data.amount,
          date: new Date(data.date),
          method: data.paymentMethod || 'CASH',
          projectId: data.projectId || null,
          siteId: data.siteId || null,
          reference: null,
          remarks: `Allowance Paid: ${data.type}${data.description ? ` (${data.description})` : ''}`,
          session: {
            userId: session.userId,
            name: session.name,
            email: session.email,
            role: session.role,
          },
        });
      }

      return allowance;
    });

    return NextResponse.json({
      success: true,
      allowance: result,
      message: 'Allowance logged successfully',
    });
  } catch (error: any) {
    console.error('Allowance POST error:', error);
    return NextResponse.json({ error: 'Failed to record allowance' }, { status: 500 });
  }
}
