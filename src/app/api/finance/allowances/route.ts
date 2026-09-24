import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createAllowanceSchema } from '@/lib/validations/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get('workerId');
    const projectId = searchParams.get('projectId');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (workerId && workerId !== 'ALL') where.workerId = workerId;
    if (projectId && projectId !== 'ALL') where.projectId = projectId;

    const allowances = await prisma.allowance.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true, category: true, workerCode: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalAmount = allowances.reduce((sum, a) => sum + (a.amount || 0), 0);

    return NextResponse.json({
      allowances,
      totalAmount,
      count: allowances.length,
    });
  } catch (error: any) {
    console.error('Allowances GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve allowances' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createAllowanceSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid allowance data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Verify worker exists in tenant
    const worker = await prisma.worker.findFirst({
      where: { id: data.workerId, organizationId: orgId, deletedAt: null },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const allowance = await tx.allowance.create({
        data: {
          organizationId: orgId,
          workerId: data.workerId,
          projectId: data.projectId || null,
          siteId: data.siteId || null,
          date: new Date(data.date),
          type: data.type,
          amount: data.amount,
          description: data.description || null,
        },
      });

      // Credit worker ledger with allowance
      await tx.transaction.create({
        data: {
          organizationId: orgId,
          workerId: data.workerId,
          date: new Date(data.date),
          sourceType: 'ALLOWANCE',
          sourceId: allowance.id,
          description: `Allowance: ${data.type}${data.description ? ` (${data.description})` : ''}`,
          debit: 0,
          credit: data.amount, // Increases worker earnings
        },
      });

      return allowance;
    });

    return NextResponse.json({
      success: true,
      allowance: result,
      message: 'Allowance logged successfully',
    });
  } catch (error: any) {
    console.error('Allowance POST error:', error);
    return NextResponse.json({ error: 'Failed to record allowance' }, { status: 500 });
  }
}
