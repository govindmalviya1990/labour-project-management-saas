import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updateMaterialReceiptSchema } from '@/lib/validations/materials';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const receipt = await prisma.materialReceipt.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
      include: {
        material: true,
        project: true,
        site: true,
        supplier: true,
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Material receipt not found' }, { status: 404 });
    }

    return NextResponse.json({ receipt });
  } catch (error: any) {
    console.error('Material receipt GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve material receipt' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const existing = await prisma.materialReceipt.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material receipt not found' }, { status: 404 });
    }

    // Check Day Lock
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: existing.purchasedById || session.userId,
      date: existing.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'MaterialReceipt',
      entityId: existing.id,
      action: 'UPDATE',
      details: { oldTotalCost: existing.totalCost },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateMaterialReceiptSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid receipt data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const quantity = data.quantity !== undefined ? data.quantity : existing.quantity;
    const purchaseRate = data.purchaseRate !== undefined ? data.purchaseRate : existing.purchaseRate;
    const totalCost = Math.round(quantity * purchaseRate * 100) / 100;

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.materialReceipt.update({
        where: { id: params.id },
        data: {
          ...(data.materialId ? { materialId: data.materialId } : {}),
          ...(data.projectId ? { projectId: data.projectId } : {}),
          ...(data.siteId !== undefined ? { siteId: data.siteId || null } : {}),
          ...(data.supplierId !== undefined ? { supplierId: data.supplierId || null } : {}),
          ...(data.date ? { date: new Date(data.date) } : {}),
          ...(data.quantity !== undefined ? { quantity } : {}),
          ...(data.purchaseRate !== undefined ? { purchaseRate } : {}),
          ...(data.invoiceNumber !== undefined ? { invoiceNumber: data.invoiceNumber || null } : {}),
          ...(data.attachmentUrl !== undefined ? { attachmentUrl: data.attachmentUrl || null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
          totalCost,
        },
        include: {
          material: true,
          project: true,
          site: true,
          supplier: true,
        },
      });

      // If linked expenses exist for this material receipt, update their amount too
      await tx.expense.updateMany({
        where: { receiptId: params.id, deletedAt: null },
        data: {
          amount: totalCost,
          date: data.date ? new Date(data.date) : existing.date,
        },
      });

      return up;
    });

    return NextResponse.json({
      success: true,
      receipt: updated,
      warning: lockCheck.isVerifiedDay ? 'Modified entry on a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Material receipt PUT error:', error);
    return NextResponse.json({ error: 'Failed to update material receipt' }, { status: 500 });
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

    const existing = await prisma.materialReceipt.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material receipt not found' }, { status: 404 });
    }

    // Check Day Lock
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: existing.purchasedById || session.userId,
      date: existing.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'MaterialReceipt',
      entityId: existing.id,
      action: 'DELETE',
      details: { totalCost: existing.totalCost },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    // Soft delete receipt and any linked expenses
    await prisma.$transaction(async (tx) => {
      await tx.materialReceipt.update({
        where: { id: params.id },
        data: {
          deletedAt: new Date(),
          deletedById: session.userId,
        },
      });

      await tx.expense.updateMany({
        where: { receiptId: params.id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          deletedById: session.userId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Material receipt deleted successfully',
      warning: lockCheck.isVerifiedDay ? 'Deleted entry from a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Material receipt DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete material receipt' }, { status: 500 });
  }
}
