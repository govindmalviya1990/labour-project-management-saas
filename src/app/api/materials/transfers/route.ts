import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { createMaterialTransferSchema } from '@/lib/validations/materials';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const materialId = searchParams.get('materialId');

    const where: any = {
      organizationId: orgId,
    };

    if (materialId && materialId !== 'ALL') where.materialId = materialId;

    if (projectId && projectId !== 'ALL') {
      where.OR = [
        { sourceProjectId: projectId },
        { destinationProjectId: projectId },
      ];
    }

    const transfers = await prisma.materialTransfer.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, unit: true, materialCode: true, category: true } },
        sourceProject: { select: { id: true, name: true, projectCode: true } },
        destinationProject: { select: { id: true, name: true, projectCode: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalQuantity = transfers.reduce((sum, t) => sum + t.quantity, 0);

    return NextResponse.json({
      transfers,
      summary: {
        count: transfers.length,
        totalQuantity,
      },
    });
  } catch (error: any) {
    console.error('Material Transfers GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve material transfers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createMaterialTransferSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid transfer data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    if (data.sourceProjectId === data.destinationProjectId) {
      return NextResponse.json(
        { error: 'Source and destination projects cannot be the same.' },
        { status: 400 }
      );
    }

    // Verify material
    const material = await prisma.material.findFirst({
      where: { id: data.materialId, organizationId: orgId, deletedAt: null },
    });

    if (!material) {
      return NextResponse.json({ error: 'Selected material not found' }, { status: 404 });
    }

    // Verify source project
    const sourceProject = await prisma.project.findFirst({
      where: { id: data.sourceProjectId, organizationId: orgId, deletedAt: null },
    });

    if (!sourceProject) {
      return NextResponse.json({ error: 'Source project not found' }, { status: 404 });
    }

    // Verify destination project
    const destProject = await prisma.project.findFirst({
      where: { id: data.destinationProjectId, organizationId: orgId, deletedAt: null },
    });

    if (!destProject) {
      return NextResponse.json({ error: 'Destination project not found' }, { status: 404 });
    }

    // Check available stock at source project
    const receipts = await prisma.materialReceipt.findMany({
      where: { organizationId: orgId, materialId: data.materialId, projectId: data.sourceProjectId, deletedAt: null },
      select: { quantity: true },
    });
    const totalReceived = receipts.reduce((sum, r) => sum + r.quantity, 0);

    const transfersIn = await prisma.materialTransfer.findMany({
      where: { organizationId: orgId, materialId: data.materialId, destinationProjectId: data.sourceProjectId },
      select: { quantity: true },
    });
    const totalTransferredIn = transfersIn.reduce((sum, t) => sum + t.quantity, 0);

    const transfersOut = await prisma.materialTransfer.findMany({
      where: { organizationId: orgId, materialId: data.materialId, sourceProjectId: data.sourceProjectId },
      select: { quantity: true },
    });
    const totalTransferredOut = transfersOut.reduce((sum, t) => sum + t.quantity, 0);

    const pastUsages = await prisma.materialUsage.findMany({
      where: { organizationId: orgId, materialId: data.materialId, projectId: data.sourceProjectId, deletedAt: null },
      select: { quantity: true },
    });
    const totalUsed = pastUsages.reduce((sum, u) => sum + u.quantity, 0);

    let sourceStock = Math.round((totalReceived + totalTransferredIn - totalTransferredOut - totalUsed) * 1000) / 1000;

    // Opening stock fallback if source has no receipts or transfers
    if (sourceStock <= 0 && material.openingStock > 0 && totalReceived === 0 && totalTransferredIn === 0) {
      const allOrgUsages = await prisma.materialUsage.aggregate({
        where: { organizationId: orgId, materialId: data.materialId, deletedAt: null },
        _sum: { quantity: true },
      });
      const orgUsed = allOrgUsages._sum.quantity || 0;
      sourceStock = Math.round((material.openingStock - orgUsed) * 1000) / 1000;
    }

    if (data.quantity > sourceStock) {
      const currentAvailable = Math.max(0, sourceStock);
      return NextResponse.json(
        {
          error: `Cannot transfer ${data.quantity} ${material.unit}. Only ${currentAvailable} ${material.unit} available at ${sourceProject.name}.`,
          availableStock: currentAvailable,
        },
        { status: 400 }
      );
    }

    // Create the transfer record (decreases source, increases destination, NO purchase expense per Section 26 & 67)
    const transfer = await prisma.materialTransfer.create({
      data: {
        organizationId: orgId,
        materialId: data.materialId,
        sourceProjectId: data.sourceProjectId,
        destinationProjectId: data.destinationProjectId,
        date: new Date(data.date),
        quantity: data.quantity,
        notes: data.notes || null,
      },
      include: {
        material: { select: { name: true, unit: true } },
        sourceProject: { select: { name: true } },
        destinationProject: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      transfer,
      message: `Transferred ${data.quantity} ${material.unit} of ${material.name} from ${sourceProject.name} to ${destProject.name}. No purchase expense created.`,
    });
  } catch (error: any) {
    console.error('Material Transfer POST error:', error);
    return NextResponse.json({ error: 'Failed to record material transfer' }, { status: 500 });
  }
}
