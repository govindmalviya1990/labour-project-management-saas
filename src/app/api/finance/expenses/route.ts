import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { createExpenseSchema } from '@/lib/validations/finance';
import { verifyDayLock } from '@/lib/auth/day-lock';

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
    const role = normalizeRole(session.role);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const siteId = searchParams.get('siteId');
    const category = searchParams.get('category');
    const walletOwnerId = searchParams.get('walletOwnerId');
    const search = searchParams.get('search');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    // If Partner or Supervisor, filter to their wallet or their assigned sites
    if (role === 'PARTNER' || role === 'SITE_SUPERVISOR') {
      where.OR = [
        { walletOwnerId: session.userId },
        { spentById: session.userId },
        { project: { partnerId: session.userId } },
        { site: { partnerId: session.userId } },
      ];
    }

    if (projectId && projectId !== 'ALL') where.projectId = projectId;
    if (siteId && siteId !== 'ALL') where.siteId = siteId;
    if (category && category !== 'ALL') where.category = category;
    if (walletOwnerId && walletOwnerId !== 'ALL') where.walletOwnerId = walletOwnerId;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        ...(where.OR || []),
        { description: { contains: q } },
        { vendorName: { contains: q } },
        { paidBy: { contains: q } },
      ];
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
        walletOwner: { select: { id: true, name: true, email: true } },
        spentBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    return NextResponse.json({
      expenses,
      summary: {
        totalRecords: expenses.length,
        totalAmount,
        categoryTotals,
      },
    });
  } catch (error: any) {
    console.error('Expenses GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve expenses' }, { status: 500 });
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
    const validated = createExpenseSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid expense data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const expenseDate = new Date(data.date);
    const walletOwnerId = (isOwnerOrManager && data.walletOwnerId) ? data.walletOwnerId : session.userId;
    const spentById = data.spentById || session.userId;

    // Check Day Lock on date for wallet owner
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: walletOwnerId,
      date: expenseDate,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'Expense',
      entityId: 'NEW',
      action: 'UPDATE',
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    const expense = await prisma.expense.create({
      data: {
        organizationId: orgId,
        projectId: data.projectId || null,
        siteId: data.siteId || null,
        date: expenseDate,
        category: data.category,
        amount: data.amount,
        description: data.description,
        vendorName: data.vendorName || null,
        paymentMethod: data.paymentMethod || 'CASH',
        paidBy: data.paidBy || session.name,
        walletOwnerId,
        spentById,
        receiptId: data.receiptId || null,
        receiptUrl: data.receiptUrl || null,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      expense,
      message: 'Expense recorded successfully',
    });
  } catch (error: any) {
    console.error('Expense POST error:', error);
    return NextResponse.json({ error: 'Failed to record expense' }, { status: 500 });
  }
}
