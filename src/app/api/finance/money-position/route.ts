import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import {
  calculateWalletBalance,
  calculateBankBalance,
  calculateOverallMoneyPosition,
} from '@/lib/calculations';

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
    const role = normalizeRole(session.role);
    const isOwnerOrManager = ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(role);

    // 1. Fetch Organization Users (Partners & Supervisors)
    const memberships = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, email: true, mobile: true } },
      },
    });

    const partnerMembers = memberships.filter((m) =>
      ['PARTNER', 'OWNER', 'MANAGER'].includes(normalizeRole(m.role))
    );
    const supervisorMembers = memberships.filter((m) =>
      ['SITE_SUPERVISOR', 'SUPERVISOR'].includes(normalizeRole(m.role))
    );

    // Role Scoping: Partner sees only their own cash, Owner/Manager sees all
    const targetPartners = isOwnerOrManager
      ? partnerMembers
      : partnerMembers.filter((m) => m.userId === session.userId);

    const targetSupervisors = isOwnerOrManager ? supervisorMembers : [];

    // 2. Derive Partner Wallets
    const partnerWallets = await Promise.all(
      targetPartners.map(async (m) => {
        const uId = m.userId;
        const [mIn, tIn, tOut, exp, bWith, bDep] = await Promise.all([
          prisma.projectReceipt.aggregate({
            where: {
              organizationId: orgId,
              receivedById: uId,
              deletedAt: null,
              OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
            },
            _sum: { amount: true },
          }),
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, toUserId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, fromUserId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: { organizationId: orgId, walletOwnerId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { organizationId: orgId, partnerId: uId, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { organizationId: orgId, partnerId: uId, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
            _sum: { amount: true },
          }),
        ]);

        const w = calculateWalletBalance({
          totalMoneyIn: mIn._sum.amount || 0,
          totalTransfersIn: tIn._sum.amount || 0,
          totalTransfersOut: tOut._sum.amount || 0,
          totalExpenses: exp._sum.amount || 0,
          totalBankWithdrawals: bWith._sum.amount || 0,
          totalBankDeposits: bDep._sum.amount || 0,
        });

        return {
          id: uId,
          name: m.user.name,
          balance: w.balance,
        };
      })
    );

    // 3. Derive Supervisor Wallets
    const supervisorWallets = await Promise.all(
      targetSupervisors.map(async (m) => {
        const uId = m.userId;
        const [tIn, tOut, exp] = await Promise.all([
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, toUserId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, fromUserId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: { organizationId: orgId, walletOwnerId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
        ]);

        const w = calculateWalletBalance({
          totalMoneyIn: 0,
          totalTransfersIn: tIn._sum.amount || 0,
          totalTransfersOut: tOut._sum.amount || 0,
          totalExpenses: exp._sum.amount || 0,
        });

        return {
          id: uId,
          name: m.user.name,
          balance: w.balance,
        };
      })
    );

    // 4. Derive Bank Account Balances
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const bankBalances = await Promise.all(
      bankAccounts.map(async (acc) => {
        const [
          depositsAgg,
          receiptsAgg,
          transferFromPartnerAgg,
          withdrawalsAgg,
          paymentsAgg,
          transferToPartnerAgg,
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
          balance: calc.balance,
        };
      })
    );

    // 5. Total Received & Total Expenses (Lifetime / Filtered)
    const [allReceiptsAgg, allExpensesAgg, expensesList] = await Promise.all([
      prisma.projectReceipt.aggregate({
        where: { organizationId: orgId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId: orgId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.expense.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { category: true, amount: true },
      }),
    ]);

    const totalReceived = allReceiptsAgg._sum.amount || 0;
    const totalExpenses = allExpensesAgg._sum.amount || 0;

    // Category-wise expense breakdown
    const categoryTotals: Record<string, number> = {};
    expensesList.forEach((e) => {
      const cat = e.category || 'OTHER';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + e.amount;
    });

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount),
        percentage: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 6. Calculate Single-Source-Of-Truth Overall Money Position
    const overallPosition = calculateOverallMoneyPosition({
      partnerWallets,
      supervisorWallets,
      bankBalances,
      totalReceived,
      totalExpenses,
    });

    return NextResponse.json({
      ...overallPosition,
      categoryExpenses: categoryBreakdown,
      isOwnerOrManager,
    });
  } catch (error: any) {
    console.error('Error calculating overall money position:', error);
    return NextResponse.json({ error: error.message || 'Failed to calculate overall position' }, { status: 500 });
  }
}
