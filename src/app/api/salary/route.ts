import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;

    const orgId = auth.session.organizationId;
    const { searchParams } = new URL(req.url);

    const projectId = searchParams.get('projectId');
    const month = searchParams.get('month'); // e.g. "2026-09"
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');

    if (month && (!startDate || !endDate)) {
      const [year, m] = month.split('-').map(Number);
      if (year && m) {
        const firstDay = new Date(Date.UTC(year, m - 1, 1));
        const lastDay = new Date(Date.UTC(year, m, 0));
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
      }
    }

    const dateFilter =
      startDate && endDate
        ? {
            gte: startDate,
            lte: endDate,
          }
        : undefined;

    const workers = await prisma.worker.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(projectId && projectId !== 'ALL' ? { defaultProjectId: projectId } : {}),
      },
      include: {
        attendance: {
          where: {
            organizationId: orgId,
            ...(dateFilter ? { date: dateFilter } : {}),
            ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          },
        },
        allowances: {
          where: {
            organizationId: orgId,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
        },
        payments: {
          where: {
            organizationId: orgId,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const calculatedWorkers = workers.map((w) => {
      const regularDays = w.attendance.filter((a) => a.status === 'PRESENT').length;
      const halfDays = w.attendance.filter((a) => a.status === 'HALF_DAY').length;
      const otDays = w.attendance.filter((a) => a.status === 'OVERTIME').length;
      const totalOTHours = w.attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
      const earnedWages = w.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
      const allowances = w.allowances.reduce((sum, al) => sum + al.amount, 0);
      const grossSalary = earnedWages + allowances;
      const advances = w.payments
        .filter((p) => p.transactionType === 'ADVANCE')
        .reduce((sum, p) => sum + p.amount, 0);
      const payments = w.payments
        .filter(
          (p) =>
            p.transactionType === 'SALARY' ||
            p.transactionType === 'PAYMENT' ||
            p.transactionType === 'FINAL_SETTLEMENT'
        )
        .reduce((sum, p) => sum + p.amount, 0);

      const netPayable = Math.max(0, grossSalary - advances - payments);
      const advanceDue = Math.max(0, advances + payments - grossSalary);

      let status = 'PENDING';
      if (grossSalary === 0 && advances === 0 && payments === 0) {
        status = 'NO_ACTIVITY';
      } else if (netPayable === 0 && advanceDue === 0) {
        status = 'PAID';
      } else if (advanceDue > 0) {
        status = 'ADVANCE_DUE';
      } else if (payments > 0) {
        status = 'PARTIAL';
      }

      return {
        id: w.id,
        workerCode: w.workerCode,
        name: w.name,
        fatherOrHusbandName: w.fatherOrHusbandName || '',
        mobile: w.mobile || '',
        category: w.category,
        dailyWage: w.dailyWage,
        regularDays,
        halfDays,
        otDays,
        daysWorked: regularDays + otDays + halfDays * 0.5,
        totalOTHours,
        earnedWages,
        allowances,
        grossSalary,
        advances,
        payments,
        netPayable,
        advanceDue,
        status,
      };
    });

    const summary = {
      totalWorkers: calculatedWorkers.length,
      totalEarnedWages: calculatedWorkers.reduce((acc, curr) => acc + curr.earnedWages, 0),
      totalAllowances: calculatedWorkers.reduce((acc, curr) => acc + curr.allowances, 0),
      totalGrossSalary: calculatedWorkers.reduce((acc, curr) => acc + curr.grossSalary, 0),
      totalAdvances: calculatedWorkers.reduce((acc, curr) => acc + curr.advances, 0),
      totalPaid: calculatedWorkers.reduce((acc, curr) => acc + curr.payments, 0),
      totalOutstandingPayable: calculatedWorkers.reduce((acc, curr) => acc + curr.netPayable, 0),
    };

    return NextResponse.json({
      success: true,
      period: {
        month: month || '',
        startDate: startDate || '',
        endDate: endDate || '',
      },
      summary,
      workers: calculatedWorkers,
    });
  } catch (error: any) {
    console.error('Salary GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve salary payroll sheet' }, { status: 500 });
  }
}
