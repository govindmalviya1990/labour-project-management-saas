import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { createMaterialReceiptSchema } from '@/lib/validations/materials';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const materialId = searchParams.get('materialId');
    const supplierId = searchParams.get('supplierId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (projectId && projectId !== 'ALL') where.projectId = projectId;
    if (materialId && materialId !== 'ALL') where.materialId = materialId;
    if (supplierId && supplierId !== 'ALL') where.supplierId = supplierId;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    const receipts = await prisma.materialReceipt.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, unit: true, materialCode: true, category: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalQuantity = receipts.reduce((sum, r) => sum + r.quantity, 0);
    const totalAmount = receipts.reduce((sum, r) => sum + r.totalCost, 0);

    return NextResponse.json({
      receipts,
      summary: {
        count: receipts.length,
        totalQuantity,
        totalAmount,
      },
    });
  } catch (error: any) {
    console.error('Material Receipts GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve material receipts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createMaterialReceiptSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid receipt data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Verify material exists
    const material = await prisma.material.findFirst({
      where: { id: data.materialId, organizationId: orgId, deletedAt: null },
    });

    if (!material) {
      return NextResponse.json({ error: 'Selected material not found' }, { status: 404 });
    }

    // Verify project exists
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, organizationId: orgId, deletedAt: null },
    });

    if (!project) {
      return NextResponse.json({ error: 'Selected project not found' }, { status: 404 });
    }

    const totalCost = Math.round(data.quantity * data.purchaseRate * 100) / 100;

    const receipt = await prisma.materialReceipt.create({
      data: {
        organizationId: orgId,
        materialId: data.materialId,
        projectId: data.projectId,
        siteId: data.siteId || null,
        supplierId: data.supplierId || null,
        date: new Date(data.date),
        quantity: data.quantity,
        purchaseRate: data.purchaseRate,
        totalCost,
        invoiceNumber: data.invoiceNumber || null,
        attachmentUrl: data.attachmentUrl || null,
        notes: data.notes || null,
      },
      include: {
        material: { select: { name: true, unit: true } },
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

    // Update material latest purchase rate if rate provided
    if (data.purchaseRate > 0) {
      await prisma.material.update({
        where: { id: data.materialId },
        data: { purchaseRate: data.purchaseRate },
      });
    }

    return NextResponse.json({
      success: true,
      receipt,
      message: `Received ${data.quantity} ${material.unit} of ${material.name} at ${project.name}`,
    });
  } catch (error: any) {
    console.error('Material Receipt POST error:', error);
    return NextResponse.json({ error: 'Failed to record material receipt' }, { status: 500 });
  }
}
