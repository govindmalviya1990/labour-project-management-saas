import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { createWorkRecordSchema } from '@/lib/validations/workers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get('workerId');
    const projectId = searchParams.get('projectId');
    const task = searchParams.get('task');

    const where: any = {
      organizationId: orgId,
    };

    if (workerId && workerId !== 'ALL') where.workerId = workerId;
    if (projectId && projectId !== 'ALL') where.projectId = projectId;
    if (task && task.trim()) where.task = { contains: task.trim() };

    const records = await prisma.workRecord.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true, category: true, workerCode: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalQuantity = records.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const totalWorkValue = records.reduce((sum, r) => sum + (r.totalWorkValue || 0), 0);

    return NextResponse.json({
      records,
      summary: {
        totalRecords: records.length,
        totalQuantity,
        totalWorkValue,
      },
    });
  } catch (error: any) {
    console.error('Work records GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve work records' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createWorkRecordSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid work record' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const totalWorkValue = Math.round((data.quantity * data.rate) * 100) / 100;

    const record = await prisma.workRecord.create({
      data: {
        organizationId: orgId,
        projectId: data.projectId,
        siteId: data.siteId || null,
        workerId: data.workerId,
        date: new Date(data.date),
        task: data.task,
        description: data.description || null,
        quantity: data.quantity,
        unit: data.unit,
        rate: data.rate,
        totalWorkValue,
        notes: data.notes || null,
      },
      include: {
        worker: { select: { name: true } },
        project: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      record,
      message: 'Work record logged successfully',
    });
  } catch (error: any) {
    console.error('Work records POST error:', error);
    return NextResponse.json({ error: 'Failed to save work record' }, { status: 500 });
  }
}
