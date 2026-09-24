import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updateWorkRecordSchema } from '@/lib/validations/workers';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'SITE_SUPERVISOR',
      'ACCOUNTANT',
      'LABOUR',
    ]);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const record = await prisma.workRecord.findFirst({
      where: { id: params.id, organizationId: orgId },
      include: {
        worker: { select: { id: true, name: true, category: true, workerCode: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Work record not found' }, { status: 404 });
    }

    return NextResponse.json({ record });
  } catch (error: any) {
    console.error('Work record GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve work record' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const existing = await prisma.workRecord.findFirst({
      where: { id: params.id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Work record not found' }, { status: 404 });
    }

    const body = await req.json();
    const validated = updateWorkRecordSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid work record data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const quantity = data.quantity !== undefined ? data.quantity : existing.quantity;
    const rate = data.rate !== undefined ? data.rate : existing.rate;
    const totalWorkValue = quantity * rate;

    const updated = await prisma.workRecord.update({
      where: { id: params.id },
      data: {
        ...(data.projectId ? { projectId: data.projectId } : {}),
        ...(data.siteId !== undefined ? { siteId: data.siteId || null } : {}),
        ...(data.workerId ? { workerId: data.workerId } : {}),
        ...(data.date ? { date: new Date(data.date) } : {}),
        ...(data.task ? { task: data.task } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.unit ? { unit: data.unit } : {}),
        ...(data.rate !== undefined ? { rate: data.rate } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        totalWorkValue,
      },
      include: {
        worker: { select: { id: true, name: true, category: true, workerCode: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (error: any) {
    console.error('Work record PUT error:', error);
    return NextResponse.json({ error: 'Failed to update work record' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const existing = await prisma.workRecord.findFirst({
      where: { id: params.id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Work record not found' }, { status: 404 });
    }

    await prisma.workRecord.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Work record deleted successfully' });
  } catch (error: any) {
    console.error('Work record DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete work record' }, { status: 500 });
  }
}
