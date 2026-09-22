import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { updateMaterialSchema } from '@/lib/validations/materials';
import { calculateMaterialStock } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const materialId = params.id;

    const material = await prisma.material.findFirst({
      where: {
        id: materialId,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        supplier: true,
        receipts: {
          where: { organizationId: orgId, deletedAt: null },
          include: { project: { select: { id: true, name: true } }, supplier: { select: { name: true } } },
          orderBy: { date: 'desc' },
        },
        usages: {
          where: { organizationId: orgId, deletedAt: null },
          include: { project: { select: { id: true, name: true } } },
          orderBy: { date: 'desc' },
        },
        transfers: {
          where: { organizationId: orgId },
          include: {
            sourceProject: { select: { id: true, name: true } },
            destinationProject: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const totalReceived = material.receipts.reduce((sum, r) => sum + r.quantity, 0);
    const totalUsed = material.usages.reduce((sum, u) => sum + u.quantity, 0);

    const stock = calculateMaterialStock({
      openingStock: material.openingStock,
      totalReceived,
      totalUsed,
      minimumStock: material.minimumStock,
      purchaseRate: material.purchaseRate,
    });

    return NextResponse.json({
      material: {
        ...material,
        totalReceived,
        totalUsed,
        remainingStock: stock.remainingStock,
        stockValue: stock.stockValue,
        isLowStock: stock.isLowStock,
      },
    });
  } catch (error: any) {
    console.error('Material GET by ID error:', error);
    return NextResponse.json({ error: 'Failed to retrieve material details' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const materialId = params.id;

    const body = await req.json();
    const validated = updateMaterialSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid material update data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Check material exists
    const existing = await prisma.material.findFirst({
      where: { id: materialId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Check code collision if code updated
    if (data.materialCode && data.materialCode !== existing.materialCode) {
      const codeTaken = await prisma.material.findFirst({
        where: {
          organizationId: orgId,
          materialCode: data.materialCode,
          id: { not: materialId },
          deletedAt: null,
        },
      });
      if (codeTaken) {
        return NextResponse.json(
          { error: `Material code '${data.materialCode}' is already in use.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.material.update({
      where: { id: materialId },
      data: {
        ...(data.materialCode ? { materialCode: data.materialCode } : {}),
        ...(data.name ? { name: data.name } : {}),
        ...(data.category ? { category: data.category } : {}),
        ...(data.unit ? { unit: data.unit } : {}),
        ...(data.openingStock !== undefined ? { openingStock: data.openingStock } : {}),
        ...(data.minimumStock !== undefined ? { minimumStock: data.minimumStock } : {}),
        ...(data.purchaseRate !== undefined ? { purchaseRate: data.purchaseRate } : {}),
        ...(data.supplierId !== undefined ? { supplierId: data.supplierId || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      material: updated,
      message: 'Material updated successfully',
    });
  } catch (error: any) {
    console.error('Material PUT error:', error);
    return NextResponse.json({ error: 'Failed to update material' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const materialId = params.id;

    const existing = await prisma.material.findFirst({
      where: { id: materialId, organizationId: orgId, deletedAt: null },
      include: {
        _count: {
          select: {
            receipts: true,
            usages: true,
            transfers: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Soft delete
    await prisma.material.update({
      where: { id: materialId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Material soft-deleted from inventory successfully',
    });
  } catch (error: any) {
    console.error('Material DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete material' }, { status: 500 });
  }
}
