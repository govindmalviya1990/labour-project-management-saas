import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createMaterialUsageSchema } from '@/lib/validations/materials';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
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
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR']);
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

    // Calculate available Company Warehouse Stock
    const allOrgUsages = await prisma.materialUsage.findMany({
      where: { organizationId: orgId, materialId: data.materialId, deletedAt: null },
      select: { quantity: true },
    });
    const totalAlreadyDispatched = allOrgUsages.reduce((sum, u) => sum + u.quantity, 0);
    const availableCompanyStock = Math.round(Math.max(0, material.openingStock - totalAlreadyDispatched) * 1000) / 1000;

    if (data.quantity > availableCompanyStock) {
      return NextResponse.json(
        {
          error: `Company godown me sirf ${availableCompanyStock} ${material.unit} uplabdh hai. Aap ${data.quantity} ${material.unit} nahi bhej sakte.`,
          availableStock: availableCompanyStock,
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
        taskPurpose: data.taskPurpose || 'PENDING',
        notes: data.notes || null,
      },
      include: {
        material: { select: { name: true, unit: true } },
        project: { select: { name: true } },
      },
    });

    const newRemainingStock = Math.round(Math.max(0, availableCompanyStock - data.quantity) * 1000) / 1000;

    return NextResponse.json({
      success: true,
      usage,
      remainingStock: newRemainingStock,
      message: `Dispatched ${data.quantity} ${material.unit} of ${material.name} to ${project.name}. Company godown me bacha: ${newRemainingStock} ${material.unit}.`,
    });
  } catch (error: any) {
    console.error('Material Usage POST error:', error);
    return NextResponse.json({ error: 'Failed to record material usage' }, { status: 500 });
  }
}
