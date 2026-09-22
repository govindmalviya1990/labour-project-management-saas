import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { updateExpenseSchema } from '@/lib/validations/finance';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const expenseId = params.id;

    const body = await req.json();
    const validated = updateExpenseSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid expense update data' },
        { status: 400 }
      );
    }

    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...validated.data,
        date: validated.data.date ? new Date(validated.data.date) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      expense: updated,
      message: 'Expense updated successfully',
    });
  } catch (error: any) {
    console.error('Expense PUT error:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const expenseId = params.id;

    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await prisma.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Expense archived successfully. Project costs and financial reports have been updated dynamically.',
    });
  } catch (error: any) {
    console.error('Expense DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
