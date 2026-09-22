import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { createMaterialSchema } from '@/lib/validations/materials';
import { calculateMaterialStock } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const lowStockOnly = searchParams.get('lowStock') === 'true';
    const search = searchParams.get('search');
    const projectId = searchParams.get('projectId');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (category && category !== 'ALL') where.category = category;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { materialCode: { contains: q } },
      ];
    }

    const materials = await prisma.material.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, contactPerson: true, mobile: true } },
        receipts: {
          where: {
            organizationId: orgId,
            deletedAt: null,
            ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          },
        },
        usages: {
          where: {
            organizationId: orgId,
            deletedAt: null,
            ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          },
        },
        transfers: {
          where: {
            organizationId: orgId,
            ...(projectId && projectId !== 'ALL'
              ? { OR: [{ sourceProjectId: projectId }, { destinationProjectId: projectId }] }
              : {}),
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    let totalStockValue = 0;
    let lowStockCount = 0;

    const computedMaterials = materials.map((m) => {
      const totalReceived = m.receipts.reduce((sum, r) => sum + r.quantity, 0);
      const totalUsed = m.usages.reduce((sum, u) => sum + u.quantity, 0);

      // Transfers
      let transfersIn = 0;
      let transfersOut = 0;
      if (projectId && projectId !== 'ALL') {
        transfersIn = m.transfers
          .filter((t) => t.destinationProjectId === projectId)
          .reduce((sum, t) => sum + t.quantity, 0);
        transfersOut = m.transfers
          .filter((t) => t.sourceProjectId === projectId)
          .reduce((sum, t) => sum + t.quantity, 0);
      }

      const stock = calculateMaterialStock({
        openingStock: projectId ? 0 : m.openingStock,
        totalReceived,
        totalUsed,
        transfersIn,
        transfersOut,
        minimumStock: m.minimumStock,
        purchaseRate: m.purchaseRate,
      });

      totalStockValue += stock.stockValue;
      if (stock.isLowStock) lowStockCount++;

      return {
        id: m.id,
        materialCode: m.materialCode,
        name: m.name,
        category: m.category,
        unit: m.unit,
        openingStock: m.openingStock,
        totalReceived,
        totalUsed,
        remainingStock: stock.remainingStock,
        minimumStock: m.minimumStock,
        purchaseRate: m.purchaseRate,
        stockValue: stock.stockValue,
        isLowStock: stock.isLowStock,
        supplierName: m.supplier?.name || null,
        notes: m.notes,
      };
    });

    const filtered = lowStockOnly
      ? computedMaterials.filter((m) => m.isLowStock)
      : computedMaterials;

    return NextResponse.json({
      materials: filtered,
      summary: {
        totalMaterials: materials.length,
        totalStockValue,
        lowStockCount,
      },
    });
  } catch (error: any) {
    console.error('Materials GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve materials' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createMaterialSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid material data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Check unique code
    const existing = await prisma.material.findFirst({
      where: {
        organizationId: orgId,
        materialCode: data.materialCode,
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Material code '${data.materialCode}' is already registered.` },
        { status: 409 }
      );
    }

    const material = await prisma.material.create({
      data: {
        organizationId: orgId,
        materialCode: data.materialCode,
        name: data.name,
        category: data.category,
        unit: data.unit,
        openingStock: data.openingStock,
        minimumStock: data.minimumStock,
        purchaseRate: data.purchaseRate,
        supplierId: data.supplierId || null,
        notes: data.notes || null,
      },
      include: {
        supplier: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      material,
      message: 'Material added to catalog successfully',
    });
  } catch (error: any) {
    console.error('Material POST error:', error);
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 });
  }
}
