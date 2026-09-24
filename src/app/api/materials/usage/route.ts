import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createMaterialUsageSchema } from '@/lib/validations/materials';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const materialId = searchParams.get('materialId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (projectId && projectId !== 'ALL') where.projectId = projectId;
    if (materialId && materialId !== 'ALL') where.materialId = materialId;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    const usages = await prisma.materialUsage.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, unit: true, materialCode: true, category: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalQuantity = usages.reduce((sum, u) => sum + u.quantity, 0);

    return NextResponse.json({
      usages,
      summary: {
        count: usages.length,
        totalQuantity,
      },
    });
  } catch (error: any) {
    console.error('Material Usage GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve material usage' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createMaterialUsageSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid material usage data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Verify material
    const material = await prisma.material.findFirst({
      where: { id: data.materialId, organizationId: orgId, deletedAt: null },
    });

    if (!material) {
      return NextResponse.json({ error: 'Selected material not found' }, { status: 404 });
    }

    // Verify project
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, organizationId: orgId, deletedAt: null },
    });

    if (!project) {
      return NextResponse.json({ error: 'Selected project not found' }, { status: 404 });
    }

    // Calculate available stock at this project to enforce Negative Stock Prevention
    const receipts = await prisma.materialReceipt.findMany({
      where: { organizationId: orgId, materialId: data.materialId, projectId: data.projectId, deletedAt: null },
      select: { quantity: true },
    });
    const totalReceived = receipts.reduce((sum, r) => sum + r.quantity, 0);

    const transfersIn = await prisma.materialTransfer.findMany({
      where: { organizationId: orgId, materialId: data.materialId, destinationProjectId: data.projectId },
      select: { quantity: true },
    });
    const totalTransferredIn = transfersIn.reduce((sum, t) => sum + t.quantity, 0);

    const transfersOut = await prisma.materialTransfer.findMany({
      where: { organizationId: orgId, materialId: data.materialId, sourceProjectId: data.projectId },
      select: { quantity: true },
    });
    const totalTransferredOut = transfersOut.reduce((sum, t) => sum + t.quantity, 0);

    const pastUsages = await prisma.materialUsage.findMany({
      where: { organizationId: orgId, materialId: data.materialId, projectId: data.projectId, deletedAt: null },
      select: { quantity: true },
    });
    const totalUsed = pastUsages.reduce((sum, u) => sum + u.quantity, 0);

    let availableStock = Math.round((totalReceived + totalTransferredIn - totalTransferredOut - totalUsed) * 1000) / 1000;

    // If opening stock exists on the material and project has no receipts or transfers, allow from opening stock
    if (availableStock <= 0 && material.openingStock > 0 && totalReceived === 0 && totalTransferredIn === 0) {
      const allOrgUsages = await prisma.materialUsage.aggregate({
        where: { organizationId: orgId, materialId: data.materialId, deletedAt: null },
        _sum: { quantity: true },
      });
      const orgUsed = allOrgUsages._sum.quantity || 0;
      availableStock = Math.round((material.openingStock - orgUsed) * 1000) / 1000;
    }

    if (data.quantity > availableStock) {
      const currentAvailable = Math.max(0, availableStock);
      return NextResponse.json(
        {
          error: `Cannot use ${data.quantity} ${material.unit}. Only ${currentAvailable} ${material.unit} available at ${project.name}.`,
          availableStock: currentAvailable,
        },
        { status: 400 }
      );
    }

    const usage = await prisma.materialUsage.create({
      data: {
        organizationId: orgId,
        materialId: data.materialId,
        projectId: data.projectId,
        siteId: data.siteId || null,
        date: new Date(data.date),
        quantity: data.quantity,
        taskPurpose: data.taskPurpose,
        notes: data.notes || null,
      },
      include: {
        material: { select: { name: true, unit: true } },
        project: { select: { name: true } },
      },
    });

    const newRemainingStock = Math.round((availableStock - data.quantity) * 1000) / 1000;

    return NextResponse.json({
      success: true,
      usage,
      remainingStock: newRemainingStock,
      message: `Used ${data.quantity} ${material.unit} of ${material.name} for ${data.taskPurpose}. Remaining at ${project.name}: ${newRemainingStock} ${material.unit}.`,
    });
  } catch (error: any) {
    console.error('Material Usage POST error:', error);
    return NextResponse.json({ error: 'Failed to record material usage' }, { status: 500 });
  }
}
