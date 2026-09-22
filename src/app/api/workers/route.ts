import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { createWorkerSchema } from '@/lib/validations/workers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { workerCode: { contains: q } },
        { mobile: { contains: q } },
        { skill: { contains: q } },
      ];
    }

    const workers = await prisma.worker.findMany({
      where,
      include: {
        _count: {
          select: {
            attendance: true,
            workRecords: true,
            payments: true,
            allowances: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Overview counters
    const allOrgWorkers = await prisma.worker.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { category: true, status: true, dailyWage: true },
    });

    const totalWorkers = allOrgWorkers.length;
    const activeWorkers = allOrgWorkers.filter((w) => w.status === 'ACTIVE').length;
    const avgDailyWage =
      totalWorkers > 0
        ? Math.round(
            allOrgWorkers.reduce((sum, w) => sum + (w.dailyWage || 0), 0) / totalWorkers
          )
        : 0;

    // Category count distribution
    const categoryCounts: Record<string, number> = {};
    allOrgWorkers.forEach((w) => {
      categoryCounts[w.category] = (categoryCounts[w.category] || 0) + 1;
    });

    return NextResponse.json({
      workers,
      summary: {
        totalWorkers,
        activeWorkers,
        avgDailyWage,
        categoryCounts,
      },
    });
  } catch (error: any) {
    console.error('Workers GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve workers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createWorkerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid worker data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Check unique workerCode in organization
    const existing = await prisma.worker.findFirst({
      where: {
        organizationId: orgId,
        workerCode: data.workerCode,
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Worker code '${data.workerCode}' is already registered in your organization.` },
        { status: 409 }
      );
    }

    const worker = await prisma.worker.create({
      data: {
        organizationId: orgId,
        workerCode: data.workerCode,
        name: data.name,
        fatherOrHusbandName: data.fatherOrHusbandName || null,
        mobile: data.mobile || null,
        address: data.address || null,
        skill: data.skill || null,
        category: data.category,
        dailyWage: data.dailyWage,
        wageUnit: data.wageUnit,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
        status: data.status,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      worker,
      message: 'Worker registered successfully',
    });
  } catch (error: any) {
    console.error('Worker POST error:', error);
    return NextResponse.json({ error: 'Failed to create worker' }, { status: 500 });
  }
}
