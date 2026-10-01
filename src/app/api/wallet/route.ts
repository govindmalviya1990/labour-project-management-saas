import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { calculateWalletBalance, calculateDailyCashFlow } from '@/lib/calculations';
import { getStartOfDayUTC } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(normalizeRole(session.role));

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId');
    const dateParam = searchParams.get('date');
    const summaryAll = searchParams.get('summary') === 'all';

    // Target user whose wallet is being queried
    const targetUserId = (isOwnerOrManager && requestedUserId) ? requestedUserId : session.userId;

    // Fetch target user info
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, mobile: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1. Overall Lifetime Derived Balance
    const [moneyInAgg, transfersInAgg, transfersOutAgg, expensesAgg] = await Promise.all([
      prisma.projectReceipt.aggregate({
        where: { organizationId: orgId, receivedById: targetUserId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: { organizationId: orgId, toUserId: targetUserId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: { organizationId: orgId, fromUserId: targetUserId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId: orgId, walletOwnerId: targetUserId, deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    const totalMoneyIn = moneyInAgg._sum.amount || 0;
    const totalTransfersIn = transfersInAgg._sum.amount || 0;
    const totalTransfersOut = transfersOutAgg._sum.amount || 0;
    const totalExpenses = expensesAgg._sum.amount || 0;

    const lifetimeWallet = calculateWalletBalance({
      totalMoneyIn,
      totalTransfersIn,
      totalTransfersOut,
      totalExpenses,
    });

    // 2. Day-specific Cash Flow (Din Ka Hisaab)
    const queryDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart = getStartOfDayUTC(queryDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Prior days aggregate for derived opening balance
    const [priorMoneyIn, priorTransfersIn, priorTransfersOut, priorExpenses] = await Promise.all([
      prisma.projectReceipt.aggregate({
        where: { organizationId: orgId, receivedById: targetUserId, date: { lt: dayStart }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: { organizationId: orgId, toUserId: targetUserId, date: { lt: dayStart }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: { organizationId: orgId, fromUserId: targetUserId, date: { lt: dayStart }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId: orgId, walletOwnerId: targetUserId, date: { lt: dayStart }, deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    const priorWallet = calculateWalletBalance({
      totalMoneyIn: priorMoneyIn._sum.amount || 0,
      totalTransfersIn: priorTransfersIn._sum.amount || 0,
      totalTransfersOut: priorTransfersOut._sum.amount || 0,
      totalExpenses: priorExpenses._sum.amount || 0,
    });
    const openingBalance = priorWallet.balance;

    // Today's movements
    const [todayMoneyIn, todayTransfersIn, todayTransfersOut, todayExpenses] = await Promise.all([
      prisma.projectReceipt.aggregate({
        where: {
          organizationId: orgId,
          receivedById: targetUserId,
          date: { gte: dayStart, lte: dayEnd },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: {
          organizationId: orgId,
          toUserId: targetUserId,
          date: { gte: dayStart, lte: dayEnd },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: {
          organizationId: orgId,
          fromUserId: targetUserId,
          date: { gte: dayStart, lte: dayEnd },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          organizationId: orgId,
          walletOwnerId: targetUserId,
          date: { gte: dayStart, lte: dayEnd },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
    ]);

    // Check DailyClosing record for this day
    const dailyClosing = await prisma.dailyClosing.findFirst({
      where: {
        organizationId: orgId,
        userId: targetUserId,
        date: dayStart,
      },
    });

    const dailyCashFlow = calculateDailyCashFlow({
      openingBalance,
      moneyInToday: todayMoneyIn._sum.amount || 0,
      transfersInToday: todayTransfersIn._sum.amount || 0,
      transfersOutToday: todayTransfersOut._sum.amount || 0,
      expensesToday: todayExpenses._sum.amount || 0,
      actualPhysicalCash: dailyClosing?.actualCash ?? null,
    });

    // 3. Transactions for the selected day or recent (limit 50)
    const [receipts, transfersSent, transfersReceived, expenses] = await Promise.all([
      prisma.projectReceipt.findMany({
        where: {
          organizationId: orgId,
          receivedById: targetUserId,
          ...(dateParam ? { date: { gte: dayStart, lte: dayEnd } } : {}),
          deletedAt: null,
        },
        include: {
          project: { select: { id: true, name: true, projectCode: true } },
          site: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      prisma.fundTransfer.findMany({
        where: {
          organizationId: orgId,
          fromUserId: targetUserId,
          ...(dateParam ? { date: { gte: dayStart, lte: dayEnd } } : {}),
          deletedAt: null,
        },
        include: {
          toUser: { select: { id: true, name: true, email: true } },
          toWorker: { select: { id: true, name: true, workerCode: true, category: true } },
          project: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      prisma.fundTransfer.findMany({
        where: {
          organizationId: orgId,
          toUserId: targetUserId,
          ...(dateParam ? { date: { gte: dayStart, lte: dayEnd } } : {}),
          deletedAt: null,
        },
        include: {
          fromUser: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      prisma.expense.findMany({
        where: {
          organizationId: orgId,
          walletOwnerId: targetUserId,
          ...(dateParam ? { date: { gte: dayStart, lte: dayEnd } } : {}),
          deletedAt: null,
        },
        include: {
          project: { select: { id: true, name: true, projectCode: true } },
          site: { select: { id: true, name: true } },
          spentBy: { select: { id: true, name: true } },
          materialReceipt: {
            select: { id: true, material: { select: { name: true, unit: true } }, quantity: true, purchaseRate: true },
          },
        },
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ]);

    // Format into unified ledger
    const ledger = [
      ...receipts.map((r) => ({
        id: r.id,
        type: 'MONEY_IN',
        direction: 'IN' as const,
        amount: r.amount,
        date: r.date,
        description: `Project Payment from ${r.clientName} (${r.purpose})`,
        partyName: r.clientName,
        projectName: r.project?.name,
        siteName: r.site?.name,
        paymentMethod: r.paymentMethod,
        reference: r.reference,
        notes: r.notes,
        raw: r,
      })),
      ...transfersReceived.map((t) => ({
        id: t.id,
        type: 'TRANSFER_IN',
        direction: 'IN' as const,
        amount: t.amount,
        date: t.date,
        description: `Received from ${t.fromUser?.name || 'User'} (${t.purpose})`,
        partyName: t.fromUser?.name,
        projectName: t.project?.name,
        siteName: t.site?.name,
        paymentMethod: t.paymentMethod,
        reference: t.reference,
        notes: t.notes,
        raw: t,
      })),
      ...transfersSent.map((t) => ({
        id: t.id,
        type: 'TRANSFER_OUT',
        direction: 'OUT' as const,
        amount: t.amount,
        date: t.date,
        description: t.toWorker
          ? `Paid to Worker ${t.toWorker.name} (${t.purpose})`
          : `Transferred to ${t.toUser?.name || 'User'} (${t.purpose})`,
        partyName: t.toWorker?.name || t.toUser?.name,
        partyType: t.toWorker ? 'WORKER' : 'USER',
        projectName: t.project?.name,
        siteName: t.site?.name,
        paymentMethod: t.paymentMethod,
        reference: t.reference,
        notes: t.notes,
        raw: t,
      })),
      ...expenses.map((e) => ({
        id: e.id,
        type: 'EXPENSE',
        direction: 'OUT' as const,
        amount: e.amount,
        date: e.date,
        description: e.category === 'GOODS_PURCHASE' && e.materialReceipt
          ? `Goods Purchase: ${e.materialReceipt.material.name} (${e.materialReceipt.quantity} ${e.materialReceipt.material.unit})`
          : `Expense: ${e.description} [${e.category}]`,
        category: e.category,
        partyName: e.vendorName || e.paidBy,
        projectName: e.project?.name,
        siteName: e.site?.name,
        paymentMethod: e.paymentMethod,
        reference: null,
        notes: e.notes,
        raw: e,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // If summaryAll is requested by Owner, compute partner overview comparison
    let allPartnersSummary = null;
    if (summaryAll && isOwnerOrManager) {
      const memberships = await prisma.organizationUser.findMany({
        where: { organizationId: orgId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, email: true, mobile: true } } },
      });

      const partnerUsers = memberships
        .filter((m: any) => ['PARTNER', 'OWNER'].includes(normalizeRole(m.role)))
        .map((m: any) => m.user);

      allPartnersSummary = await Promise.all(
        partnerUsers.map(async (u: any) => {
          const [mIn, tIn, tOut, exp] = await Promise.all([
            prisma.projectReceipt.aggregate({
              where: { organizationId: orgId, receivedById: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.fundTransfer.aggregate({
              where: { organizationId: orgId, toUserId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.fundTransfer.aggregate({
              where: { organizationId: orgId, fromUserId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.expense.aggregate({
              where: { organizationId: orgId, walletOwnerId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
          ]);

          const pWallet = calculateWalletBalance({
            totalMoneyIn: mIn._sum.amount || 0,
            totalTransfersIn: tIn._sum.amount || 0,
            totalTransfersOut: tOut._sum.amount || 0,
            totalExpenses: exp._sum.amount || 0,
          });

          return {
            userId: u.id,
            name: u.name,
            email: u.email,
            balance: pWallet.balance,
            totalCredits: pWallet.totalCredits,
            totalDebits: pWallet.totalDebits,
          };
        })
      );
    }

    return NextResponse.json({
      user: targetUser,
      date: dayStart.toISOString().split('T')[0],
      lifetimeWallet,
      dailyCashFlow,
      dailyClosing: dailyClosing
        ? {
            isVerified: dailyClosing.isVerified,
            actualCash: dailyClosing.actualCash,
            verifiedAt: dailyClosing.verifiedAt,
            notes: dailyClosing.notes,
          }
        : null,
      ledger,
      allPartnersSummary,
    });
  } catch (error: any) {
    console.error('Error fetching wallet balance:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch wallet' }, { status: 500 });
  }
}
