import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'ACCOUNTANT',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const role = normalizeRole(session.role);

    const { searchParams } = new URL(req.url);
    const bankAccountId = searchParams.get('bankAccountId');
    const partnerId = searchParams.get('partnerId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (role === 'PARTNER') {
      where.OR = [
        { partnerId: session.userId },
        { createdById: session.userId },
      ];
    } else if (partnerId && partnerId !== 'ALL') {
      where.partnerId = partnerId;
    }

    if (bankAccountId && bankAccountId !== 'ALL') {
      where.bankAccountId = bankAccountId;
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await prisma.bankTransaction.findMany({
      where,
      include: {
        bankAccount: { select: { id: true, name: true, bankName: true, accountLast4: true } },
        partner: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, projectCode: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error('Error fetching bank transactions:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch bank transactions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const role = normalizeRole(session.role);
    const isOwnerOrManager = ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(role);

    const body = await req.json();
    const {
      bankAccountId,
      type, // 'TRANSFER_TO_PARTNER' (Bank se Nikala), 'TRANSFER_FROM_PARTNER' (Cash Bank mein Jama), 'DEPOSIT', 'WITHDRAWAL'
      amount,
      date,
      partnerId: inputPartnerId,
      projectId,
      reference,
      notes,
    } = body;

    if (!bankAccountId || !type || !amount || amount <= 0 || !date) {
      return NextResponse.json(
        { error: 'Bank account, transaction type, valid amount, and date are required' },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'DEPOSIT',
      'WITHDRAWAL',
      'RECEIPT',
      'PAYMENT',
      'TRANSFER_TO_PARTNER',
      'TRANSFER_FROM_PARTNER',
    ];
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid transaction type: ${type}` }, { status: 400 });
    }

    // Verify bank account exists in organization
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: orgId, deletedAt: null },
    });
    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const txDate = new Date(date);
    const partnerId = (isOwnerOrManager && inputPartnerId) ? inputPartnerId : session.userId;

    // Check Day Lock on partner if partner transfer
    let warning: string | undefined = undefined;
    if (type === 'TRANSFER_TO_PARTNER' || type === 'TRANSFER_FROM_PARTNER') {
      const lockCheck = await verifyDayLock({
        organizationId: orgId,
        userId: partnerId,
        date: txDate,
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'BankTransaction',
        entityId: 'NEW',
        action: 'UPDATE',
      });
      if (lockCheck.locked) {
        return NextResponse.json({ error: lockCheck.message }, { status: 403 });
      }
      if (lockCheck.isVerifiedDay) {
        warning = 'Entry recorded on a verified closed day (Audit logged)';
      }
    }

    const parsedAmount = Math.max(0, parseFloat(amount));

    const transaction = await prisma.bankTransaction.create({
      data: {
        organizationId: orgId,
        bankAccountId,
        type,
        amount: parsedAmount,
        date: txDate,
        partnerId: (type === 'TRANSFER_TO_PARTNER' || type === 'TRANSFER_FROM_PARTNER') ? partnerId : (inputPartnerId || null),
        projectId: projectId || null,
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        createdById: session.userId,
      },
      include: {
        bankAccount: { select: { id: true, name: true, bankName: true } },
        partner: { select: { id: true, name: true } },
      },
    });

    const actionLabel =
      type === 'TRANSFER_TO_PARTNER'
        ? `₹${parsedAmount.toLocaleString('en-IN')} withdrawn from bank to partner cash wallet ("Bank se Cash Nikala")`
        : type === 'TRANSFER_FROM_PARTNER'
        ? `₹${parsedAmount.toLocaleString('en-IN')} deposited from partner cash wallet into bank ("Cash Bank mein Jama")`
        : `Bank transaction of ₹${parsedAmount.toLocaleString('en-IN')} recorded successfully`;

    return NextResponse.json(
      {
        transaction,
        message: actionLabel,
        warning,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating bank transaction:', error);
    return NextResponse.json({ error: error.message || 'Failed to record bank transaction' }, { status: 500 });
  }
}
