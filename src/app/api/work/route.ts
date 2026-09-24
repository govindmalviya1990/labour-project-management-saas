import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { createWorkRecordSchema } from '@/lib/validations/workers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'SITE_SUPERVISOR',
      'ACCOUNTANT',
      'LABOUR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const isLabour = normalizeRole(session.role) === 'LABOUR';

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get('workerId');
    const projectId = searchParams.get('projectId');
    const task = searchParams.get('task');

    const where: any = {
      organizationId: orgId,
    };

    if (isLabour) {
      if (session.workerId) {
        where.workerId = session.workerId;
      } else {
        where.workerId = '__NONE__';
      }
    } else if (workerId && workerId !== 'ALL') {
      where.workerId = workerId;
    }

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
    // Only OWNER, MANAGER, and SITE_SUPERVISOR can add work records
    // ACCOUNTANT and LABOUR are forbidden
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const body = await req.json();
    const validated = createWorkRecordSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid work record data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const totalWorkValue = data.quantity * data.rate;

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
      },
      include: {
        worker: { select: { name: true, workerCode: true } },
        project: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      record,
      message: 'Work record created successfully',
    });
  } catch (error: any) {
    console.error('Work record POST error:', error);
    return NextResponse.json({ error: 'Failed to create work record' }, { status: 500 });
  }
}
