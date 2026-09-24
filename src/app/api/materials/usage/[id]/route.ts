import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updateMaterialUsageSchema } from '@/lib/validations/materials';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const usage = await prisma.materialUsage.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
      include: {
        material: true,
        project: true,
        site: true,
      },
    });

    if (!usage) {
      return NextResponse.json({ error: 'Material usage not found' }, { status: 404 });
    }

    return NextResponse.json({ usage });
  } catch (error: any) {
    console.error('Material usage GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve material usage' }, { status: 500 });
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

    const existing = await prisma.materialUsage.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material usage not found' }, { status: 404 });
    }

    const body = await req.json();
    const validated = updateMaterialUsageSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid usage data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const updated = await prisma.materialUsage.update({
      where: { id: params.id },
      data: {
        ...(data.materialId ? { materialId: data.materialId } : {}),
        ...(data.projectId ? { projectId: data.projectId } : {}),
        ...(data.siteId !== undefined ? { siteId: data.siteId || null } : {}),
        ...(data.date ? { date: new Date(data.date) } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.taskPurpose !== undefined ? { taskPurpose: data.taskPurpose } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
      include: {
        material: true,
        project: true,
        site: true,
      },
    });

    return NextResponse.json({ success: true, usage: updated });
  } catch (error: any) {
    console.error('Material usage PUT error:', error);
    return NextResponse.json({ error: 'Failed to update material usage' }, { status: 500 });
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

    const existing = await prisma.materialUsage.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material usage not found' }, { status: 404 });
    }

    await prisma.materialUsage.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Material usage deleted successfully' });
  } catch (error: any) {
    console.error('Material usage DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete material usage' }, { status: 500 });
  }
}
