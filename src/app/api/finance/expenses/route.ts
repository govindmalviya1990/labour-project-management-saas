import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createExpenseSchema } from '@/lib/validations/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Only OWNER, MANAGER, and ACCOUNTANT can view expenses
    // SUPERVISOR and LABOUR are strictly forbidden
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const siteId = searchParams.get('siteId');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (projectId && projectId !== 'ALL') where.projectId = projectId;
    if (siteId && siteId !== 'ALL') where.siteId = siteId;
    if (category && category !== 'ALL') where.category = category;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
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
    // Only OWNER, MANAGER, and ACCOUNTANT can record expenses
    // SUPERVISOR and LABOUR are forbidden
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const body = await req.json();
    const validated = createExpenseSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid expense data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    const expense = await prisma.expense.create({
      data: {
        organizationId: orgId,
        projectId: data.projectId || null,
        siteId: data.siteId || null,
        date: new Date(data.date),
        category: data.category,
        amount: data.amount,
        description: data.description,
        vendorName: data.vendorName || null,
        paymentMethod: data.paymentMethod || 'CASH',
        paidBy: data.paidBy || null,
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
