import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'PARTNER', 'MANAGER', 'ACCOUNTANT']);
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
            gte: new Date(`${startDate}T00:00:00.000+05:30`),
            lte: new Date(`${endDate}T23:59:59.999+05:30`),
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
            deletedAt: null,
            ...(dateFilter ? { date: dateFilter } : {}),
            ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          },
        },
        workRecords: {
          where: {
            organizationId: orgId,
            ...(dateFilter ? { date: dateFilter } : {}),
            ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          },
        },
        allowances: {
          where: {
            organizationId: orgId,
            deletedAt: null,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
        },
        payments: {
          where: {
            organizationId: orgId,
            deletedAt: null,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const pAtt = new Map<string, number>();
    const pAllow = new Map<string, number>();
    const pPay = new Map<string, number>();
    const pWork = new Map<string, number>();

    if (dateFilter) {
      const workerIds = workers.map((w) => w.id);
      const [priorAtt, priorAllow, priorPay, priorWork] = await Promise.all([
        prisma.attendance.groupBy({
          by: ['workerId'],
          where: {
            workerId: { in: workerIds },
            organizationId: orgId,
            deletedAt: null,
            date: { lt: dateFilter.gte },
          },
          _sum: { wageForDay: true },
        }),
        prisma.allowance.groupBy({
          by: ['workerId'],
          where: {
            workerId: { in: workerIds },
            organizationId: orgId,
            deletedAt: null,
            date: { lt: dateFilter.gte },
          },
          _sum: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ['workerId'],
          where: {
            workerId: { in: workerIds },
            organizationId: orgId,
            deletedAt: null,
            date: { lt: dateFilter.gte },
            transactionType: { in: ['SALARY', 'PAYMENT', 'FINAL_SETTLEMENT', 'ADVANCE'] },
          },
          _sum: { amount: true },
        }),
        prisma.workRecord.groupBy({
          by: ['workerId'],
          where: {
            workerId: { in: workerIds },
            organizationId: orgId,
            date: { lt: dateFilter.gte },
          },
          _sum: { totalWorkValue: true },
        }),
      ]);

      priorAtt.forEach((r) => pAtt.set(r.workerId, r._sum.wageForDay || 0));
      priorAllow.forEach((r) => pAllow.set(r.workerId, r._sum.amount || 0));
      priorPay.forEach((r) => pPay.set(r.workerId, r._sum.amount || 0));
      priorWork.forEach((r) => pWork.set(r.workerId, r._sum.totalWorkValue || 0));
    }

    const calculatedWorkers = workers.map((w) => {
      const regularDays = w.attendance.filter((a) => a.status === 'PRESENT').length;
      const halfDays = w.attendance.filter((a) => a.status === 'HALF_DAY').length;
      const otDays = w.attendance.filter((a) => a.status === 'OVERTIME').length;
      const totalOTHours = w.attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

      const attendanceWages = w.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
      const pieceRateWages = w.workRecords.reduce((sum, r) => sum + (r.totalWorkValue || 0), 0);
      const earnedWages = attendanceWages + pieceRateWages;
      const allowances = w.allowances.reduce((sum, al) => sum + al.amount, 0);
      const grossSalary = earnedWages + allowances;

      const previousBalance = Math.round(
        (((w as any).openingBalance || 0) +
          (pAtt.get(w.id) || 0) +
          (pWork.get(w.id) || 0) +
          (pAllow.get(w.id) || 0) -
          (pPay.get(w.id) || 0)) *
          100
      ) / 100;

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

      const balance = Math.round((previousBalance + grossSalary - advances - payments) * 100) / 100;
      const netPayable = Math.max(0, balance);
      const advanceDue = Math.max(0, -balance);

      let status = 'PENDING';
      if (grossSalary === 0 && advances === 0 && payments === 0 && previousBalance === 0) {
        status = 'NO_ACTIVITY';
      } else if (balance === 0) {
        status = 'PAID';
      } else if (advanceDue > 0) {
        status = 'ADVANCE_DUE';
      } else if (payments + advances > 0) {
        status = 'PARTIAL';
      } else {
        status = 'PENDING';
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
        attendanceWages,
        pieceRateWages,
        earnedWages,
        allowances,
        previousBalance,
        grossSalary,
        advances,
        payments,
        balance,
        netPayable,
        advanceDue,
        status,
      };
    });

    const summary = {
      totalWorkers: calculatedWorkers.length,
      totalPreviousBalance: calculatedWorkers.reduce((acc, curr) => acc + curr.previousBalance, 0),
      totalEarnedWages: calculatedWorkers.reduce((acc, curr) => acc + curr.earnedWages, 0),
      totalAllowances: calculatedWorkers.reduce((acc, curr) => acc + curr.allowances, 0),
      totalGrossSalary: calculatedWorkers.reduce((acc, curr) => acc + curr.grossSalary, 0),
      totalAdvances: calculatedWorkers.reduce((acc, curr) => acc + curr.advances, 0),
      totalPaid: calculatedWorkers.reduce((acc, curr) => acc + curr.payments, 0),
      totalOutstandingPayable: calculatedWorkers.reduce((acc, curr) => acc + curr.netPayable, 0),
      totalAdvanceDue: calculatedWorkers.reduce((acc, curr) => acc + curr.advanceDue, 0),
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
