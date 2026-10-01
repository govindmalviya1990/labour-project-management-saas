import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { calculateWalletBalance, calculateDailyCashFlow } from '@/lib/calculations';
import { getStartOfDayUTC } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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
    const orgId = session.organizationId;
    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(normalizeRole(session.role));

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get('userId');
    const targetUserId = (isOwnerOrManager && requestedUserId) ? requestedUserId : session.userId;

    const dateParam = searchParams.get('date');
    const queryDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart = getStartOfDayUTC(queryDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Derived prior opening
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

    const closing = await prisma.dailyClosing.findFirst({
      where: {
        organizationId: orgId,
        userId: targetUserId,
        date: dayStart,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const cashFlow = calculateDailyCashFlow({
      openingBalance,
      moneyInToday: todayMoneyIn._sum.amount || 0,
      transfersInToday: todayTransfersIn._sum.amount || 0,
      transfersOutToday: todayTransfersOut._sum.amount || 0,
      expensesToday: todayExpenses._sum.amount || 0,
      actualPhysicalCash: closing?.actualCash ?? null,
    });

    return NextResponse.json({
      date: dayStart.toISOString().split('T')[0],
      userId: targetUserId,
      cashFlow,
      closing,
    });
  } catch (error: any) {
    console.error('Error fetching daily closing:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch closing' }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
    const orgId = session.organizationId;
    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(normalizeRole(session.role));

    const body = await req.json();
    const { userId: inputUserId, date, actualCash, notes, isVerified = true } = body;

    if (!date) {
      return NextResponse.json({ error: 'Date is required for daily closing' }, { status: 400 });
    }

    const targetUserId = (isOwnerOrManager && inputUserId) ? inputUserId : session.userId;
    const dayStart = getStartOfDayUTC(new Date(date));

    // Upsert verification record (DOES NOT store static system balances)
    const existing = await prisma.dailyClosing.findFirst({
      where: {
        organizationId: orgId,
        userId: targetUserId,
        date: dayStart,
      },
    });

    let closing;
    if (existing) {
      closing = await prisma.dailyClosing.update({
        where: { id: existing.id },
        data: {
          actualCash: actualCash !== undefined && actualCash !== null ? parseFloat(actualCash) : existing.actualCash,
          isVerified: Boolean(isVerified),
          verifiedAt: isVerified ? new Date() : null,
          verifiedById: isVerified ? session.userId : null,
          notes: notes !== undefined ? notes : existing.notes,
        },
      });
    } else {
      closing = await prisma.dailyClosing.create({
        data: {
          organizationId: orgId,
          userId: targetUserId,
          date: dayStart,
          actualCash: actualCash !== undefined && actualCash !== null ? parseFloat(actualCash) : null,
          isVerified: Boolean(isVerified),
          verifiedAt: isVerified ? new Date() : null,
          verifiedById: isVerified ? session.userId : null,
          notes: notes?.trim() || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      closing,
      message: isVerified
        ? 'Din ka hisaab verified and locked successfully. Past entries locked from accidental changes.'
        : 'Physical cash count saved successfully.',
    });
  } catch (error: any) {
    console.error('Error saving daily closing:', error);
    return NextResponse.json({ error: error.message || 'Failed to save closing' }, { status: 500 });
  }
}
