import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const receiptId = params.id;

    const existing = await prisma.projectReceipt.findFirst({
      where: { id: receiptId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      clientName,
      amount,
      date,
      paymentMethod,
      purpose,
      reference,
      notes,
      siteId,
    } = body;

    const parsedAmount = amount !== undefined ? Math.max(0, parseFloat(amount)) : existing.amount;
    const receiptDate = date ? new Date(date) : existing.date;

    // Check Day Lock on existing receipt date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: existing.receivedById,
      date: receiptDate,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'ProjectReceipt',
      entityId: existing.id,
      action: 'UPDATE',
      details: { oldAmount: existing.amount, newAmount: parsedAmount },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.projectReceipt.update({
        where: { id: receiptId },
        data: {
          clientName: clientName !== undefined ? clientName.trim() : existing.clientName,
          amount: parsedAmount,
          date: receiptDate,
          paymentMethod: paymentMethod || existing.paymentMethod,
          purpose: purpose || existing.purpose,
          reference: reference !== undefined ? reference?.trim() || null : existing.reference,
          notes: notes !== undefined ? notes?.trim() || null : existing.notes,
          siteId: siteId !== undefined ? (siteId || null) : existing.siteId,
        },
        include: {
          project: { select: { id: true, name: true, projectCode: true } },
          site: { select: { id: true, name: true } },
          receivedBy: { select: { id: true, name: true } },
        },
      });

      return rec;
    });

    return NextResponse.json({
      success: true,
      receipt: updated,
      message: 'Receipt updated successfully',
    });
  } catch (error: any) {
    console.error('Receipt PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update receipt' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const receiptId = params.id;

    const existing = await prisma.projectReceipt.findFirst({
      where: { id: receiptId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Check Day Lock on receipt date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: existing.receivedById,
      date: existing.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'ProjectReceipt',
      entityId: existing.id,
      action: 'DELETE',
      details: { amount: existing.amount },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    // Soft delete
    await prisma.projectReceipt.update({
      where: { id: receiptId },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (error: any) {
    console.error('Receipt DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete receipt' }, { status: 500 });
  }
}
