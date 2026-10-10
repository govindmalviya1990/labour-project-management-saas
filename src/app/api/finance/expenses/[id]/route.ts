import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updateExpenseSchema } from '@/lib/validations/finance';
import { verifyDayLock } from '@/lib/auth/day-lock';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
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

    // Check Day Lock on existing expense date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: existing.walletOwnerId || session.userId,
      date: existing.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'Expense',
      entityId: existing.id,
      action: 'UPDATE',
      details: { oldAmount: existing.amount, category: existing.category },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...validated.data,
        date: validated.data.date ? new Date(validated.data.date) : undefined,
      },
    });

    // Record Audit Surveillance Entry
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userEmail: session.email,
      userRole: session.role,
      entityType: 'Expense',
      entityId: existing.id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
      details: formatAuditDetails('UPDATE', 'Expense', {
        name: updated.description,
        amount: updated.amount,
        category: updated.category,
      }),
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      expense: updated,
      message: 'Expense updated successfully',
      warning: lockCheck.isVerifiedDay ? 'Modified entry on a verified closed day (Audit logged)' : undefined,
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
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const expenseId = params.id;

    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check Day Lock on expense date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: existing.walletOwnerId || session.userId,
      date: existing.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'Expense',
      entityId: existing.id,
      action: 'DELETE',
      details: { amount: existing.amount, category: existing.category },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    // Soft delete
    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
      },
    });

    // Record Audit Surveillance Entry with 48h Undo Window
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userEmail: session.email,
      userRole: session.role,
      entityType: 'Expense',
      entityId: existing.id,
      action: 'DELETE',
      oldValue: existing,
      details: formatAuditDetails('DELETE', 'Expense', {
        name: existing.description,
        amount: existing.amount,
        category: existing.category,
      }),
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully',
      warning: lockCheck.isVerifiedDay ? 'Deleted entry from a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Expense DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
