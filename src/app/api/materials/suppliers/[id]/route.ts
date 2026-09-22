import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { updateSupplierSchema } from '@/lib/validations/materials';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const supplierId = params.id;

    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: orgId,
      },
      include: {
        materials: { where: { deletedAt: null } },
        receipts: {
          where: { deletedAt: null },
          include: { material: true, project: true },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const totalSuppliedValue = supplier.receipts.reduce((sum, r) => sum + r.totalCost, 0);

    return NextResponse.json({
      supplier: {
        ...supplier,
        totalSuppliedValue,
      },
    });
  } catch (error: any) {
    console.error('Supplier GET by ID error:', error);
    return NextResponse.json({ error: 'Failed to retrieve supplier' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const supplierId = params.id;

    const body = await req.json();
    const validated = updateSupplierSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid supplier data' },
        { status: 400 }
      );
    }

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: validated.data,
    });

    return NextResponse.json({
      success: true,
      supplier: updated,
      message: 'Supplier updated successfully',
    });
  } catch (error: any) {
    console.error('Supplier PUT error:', error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const supplierId = params.id;

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    await prisma.supplier.delete({
      where: { id: supplierId },
    });

    return NextResponse.json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error: any) {
    console.error('Supplier DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
