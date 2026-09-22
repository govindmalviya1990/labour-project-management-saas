import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { updateWorkerSchema } from '@/lib/validations/workers';
import { calculateWorkerBalance } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const workerId = params.id;

    const worker = await prisma.worker.findFirst({
      where: { id: workerId, organizationId: orgId, deletedAt: null },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // 1. Attendance breakdown
    const attendanceRecords = await prisma.attendance.findMany({
      where: { workerId, organizationId: orgId },
      include: {
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const presentDays = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const halfDays = attendanceRecords.filter((a) => a.status === 'HALF_DAY').length;
    const absentDays = attendanceRecords.filter((a) => a.status === 'ABSENT').length;
    const leaveDays = attendanceRecords.filter((a) => a.status === 'LEAVE').length;

    const totalEarnedSalary = attendanceRecords.reduce((sum, a) => sum + (a.wageForDay || 0), 0);

    // 2. Allowances
    const allowances = await prisma.allowance.findMany({
      where: { workerId, organizationId: orgId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
    const totalAllowances = allowances.reduce((sum, a) => sum + (a.amount || 0), 0);

    // 3. Payments & Advances
    const payments = await prisma.payment.findMany({
      where: { workerId, organizationId: orgId, deletedAt: null },
      include: {
        project: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const advances = payments.filter((p) => p.transactionType === 'ADVANCE');
    const totalAdvances = advances.reduce((sum, p) => sum + (p.amount || 0), 0);

    const directPayments = payments.filter((p) => p.transactionType !== 'ADVANCE');
    const totalDirectPayments = directPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // 4. Calculate Ledger Balance using Calculation Engine
    const balance = calculateWorkerBalance({
      totalEarnedSalary,
      totalAllowances,
      totalAdvances,
      totalPayments: totalDirectPayments,
    });

    // 5. Work output records
    const workRecords = await prisma.workRecord.findMany({
      where: { workerId, organizationId: orgId },
      include: {
        project: { select: { name: true } },
        site: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 10,
    });
    const totalWorkValue = workRecords.reduce((sum, w) => sum + (w.totalWorkValue || 0), 0);

    return NextResponse.json({
      worker,
      stats: {
        presentDays,
        halfDays,
        absentDays,
        leaveDays,
        totalDaysWorked: presentDays + (halfDays * 0.5),
        totalEarnedSalary,
        totalAllowances,
        totalAdvances,
        totalDirectPayments,
        totalWorkValue,
      },
      balance,
      recentAttendance: attendanceRecords.slice(0, 10),
      recentPayments: payments.slice(0, 10),
      recentWorkRecords: workRecords,
    });
  } catch (error: any) {
    console.error('Worker detail GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve worker profile' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const workerId = params.id;

    const body = await req.json();
    const validated = updateWorkerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      );
    }

    const existing = await prisma.worker.findFirst({
      where: { id: workerId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    const updated = await prisma.worker.update({
      where: { id: workerId },
      data: {
        ...validated.data,
        joiningDate: validated.data.joiningDate ? new Date(validated.data.joiningDate) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      worker: updated,
      message: 'Worker details updated successfully',
    });
  } catch (error: any) {
    console.error('Worker PUT error:', error);
    return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const workerId = params.id;

    const existing = await prisma.worker.findFirst({
      where: { id: workerId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    await prisma.worker.update({
      where: { id: workerId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Worker archived successfully',
    });
  } catch (error: any) {
    console.error('Worker DELETE error:', error);
    return NextResponse.json({ error: 'Failed to archive worker' }, { status: 500 });
  }
}
