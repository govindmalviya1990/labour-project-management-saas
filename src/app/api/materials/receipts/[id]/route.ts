import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updateMaterialReceiptSchema } from '@/lib/validations/materials';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
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
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const existing = await prisma.materialReceipt.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material receipt not found' }, { status: 404 });
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
    const totalCost = quantity * purchaseRate;

    const updated = await prisma.materialReceipt.update({
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

    return NextResponse.json({ success: true, receipt: updated });
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
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const existing = await prisma.materialReceipt.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material receipt not found' }, { status: 404 });
    }

    await prisma.materialReceipt.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Material receipt deleted successfully' });
  } catch (error: any) {
    console.error('Material receipt DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete material receipt' }, { status: 500 });
  }
}
