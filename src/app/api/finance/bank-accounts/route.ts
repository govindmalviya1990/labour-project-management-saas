import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { calculateBankBalance } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'ACCOUNTANT',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Derive runtime balance for every bank account
    const accountsWithBalance = await Promise.all(
      bankAccounts.map(async (acc) => {
        const [
          depositsAgg,
          receiptsAgg,
          transferFromPartnerAgg,
          withdrawalsAgg,
          paymentsAgg,
          transferToPartnerAgg,
          txCount,
        ] = await Promise.all([
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'DEPOSIT', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'RECEIPT', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'WITHDRAWAL', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'PAYMENT', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.count({
            where: { bankAccountId: acc.id, deletedAt: null },
          }),
        ]);

        const calc = calculateBankBalance({
          openingBalance: acc.openingBalance,
          totalDeposits: depositsAgg._sum.amount || 0,
          totalReceipts: receiptsAgg._sum.amount || 0,
          totalTransfersFromPartner: transferFromPartnerAgg._sum.amount || 0,
          totalWithdrawals: withdrawalsAgg._sum.amount || 0,
          totalPayments: paymentsAgg._sum.amount || 0,
          totalTransfersToPartner: transferToPartnerAgg._sum.amount || 0,
        });

        return {
          id: acc.id,
          name: acc.name,
          bankName: acc.bankName,
          accountLast4: acc.accountLast4,
          openingBalance: acc.openingBalance,
          isActive: acc.isActive,
          createdAt: acc.createdAt,
          totalInflow: calc.totalInflow,
          totalOutflow: calc.totalOutflow,
          balance: calc.balance,
          transactionCount: txCount,
        };
      })
    );

    const totalBankBalance = accountsWithBalance.reduce(
      (sum, acc) => sum + acc.balance,
      0
    );

    return NextResponse.json({
      bankAccounts: accountsWithBalance,
      totalBankBalance,
    });
  } catch (error: any) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch bank accounts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const { name, bankName, accountLast4, openingBalance = 0 } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Account nickname must be at least 2 characters' }, { status: 400 });
    }
    if (!bankName || bankName.trim().length < 2) {
      return NextResponse.json({ error: 'Bank name must be at least 2 characters' }, { status: 400 });
    }

    const parsedOpening = Math.max(0, parseFloat(openingBalance) || 0);

    const newAccount = await prisma.bankAccount.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        bankName: bankName.trim(),
        accountLast4: accountLast4 ? accountLast4.trim().slice(-4) : null,
        openingBalance: parsedOpening,
        isActive: true,
        createdById: session.userId,
      },
    });

    return NextResponse.json(
      {
        bankAccount: newAccount,
        message: 'Bank account added successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: error.message || 'Failed to create bank account' }, { status: 500 });
  }
}
