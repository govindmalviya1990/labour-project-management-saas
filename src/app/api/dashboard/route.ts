import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg, normalizeRole } from '@/lib/auth/session';
import { calculateProjectCost, calculateMaterialStock, calculateWorkerBalance } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const role = normalizeRole(session.role);

    // -------------------------------------------------------------
    // SPECIAL LABOUR DASHBOARD: strictly personal worker records
    // -------------------------------------------------------------
    if (role === 'LABOUR') {
      const workerId = session.workerId;
      const worker = workerId
        ? await prisma.worker.findFirst({
            where: { id: workerId, organizationId: orgId, deletedAt: null },
          })
        : null;

      if (!worker) {
        return NextResponse.json({
          role: 'LABOUR',
          organization: {
            id: session.organizationId,
            name: session.organizationName,
            role: session.role,
          },
          worker: null,
          labourSummary: {
            totalEarned: 0,
            totalPaid: 0,
            totalAdvances: 0,
            remainingPayable: 0,
            presentDays: 0,
            halfDays: 0,
            absentDays: 0,
            overtimeHours: 0,
          },
          recentAttendance: [],
          recentPayments: [],
        });
      }

      // Fetch labour attendance records
      const attendance = await prisma.attendance.findMany({
        where: { workerId: worker.id, organizationId: orgId },
        include: {
          project: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
      });

      const presentDays = attendance.filter((a) => a.status === 'PRESENT').length;
      const halfDays = attendance.filter((a) => a.status === 'HALF_DAY').length;
      const absentDays = attendance.filter((a) => a.status === 'ABSENT').length;
      const overtimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
      const totalEarned = attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);

      // Fetch labour allowances
      const allowances = await prisma.allowance.findMany({
        where: { workerId: worker.id, organizationId: orgId, deletedAt: null },
      });
      const totalAllowances = allowances.reduce((sum, a) => sum + (a.amount || 0), 0);

      // Fetch labour payments
      const payments = await prisma.payment.findMany({
        where: { workerId: worker.id, organizationId: orgId, deletedAt: null },
        include: { project: { select: { name: true } } },
        orderBy: { date: 'desc' },
      });

      const totalAdvances = payments
        .filter((p) => p.transactionType === 'ADVANCE')
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalPaid = payments
        .filter((p) => p.transactionType !== 'ADVANCE')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const bal = calculateWorkerBalance({
        totalEarnedSalary: totalEarned,
        totalAllowances,
        totalAdvances,
        totalPayments: totalPaid,
      });

      return NextResponse.json({
        role: 'LABOUR',
        organization: {
          id: session.organizationId,
          name: session.organizationName,
          role: session.role,
        },
        worker: {
          id: worker.id,
          workerCode: worker.workerCode,
          name: worker.name,
          category: worker.category,
          dailyWage: worker.dailyWage,
          mobile: worker.mobile,
        },
        labourSummary: {
          totalEarned,
          totalPaid,
          totalAdvances,
          totalAllowances,
          remainingPayable: bal.remainingPayable,
          paymentStatus: bal.paymentStatus,
          presentDays,
          halfDays,
          absentDays,
          overtimeHours,
        },
        recentAttendance: attendance.slice(0, 10),
        recentPayments: payments.slice(0, 10),
      });
    }

    // -------------------------------------------------------------
    // SITE SUPERVISOR OR OWNER / ACCOUNTANT DASHBOARD
    // -------------------------------------------------------------
    const { searchParams } = new URL(req.url);
    const selectedProjectId = searchParams.get('projectId') || undefined;

    // Today's boundaries in UTC
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setUTCHours(23, 59, 59, 999);

    // 1. Projects
    const allProjects = await prisma.project.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(selectedProjectId ? { id: selectedProjectId } : {}),
      },
      include: { sites: true },
    });

    const totalProjects = allProjects.length;
    const runningProjectsList = allProjects.filter((p) => p.status === 'RUNNING');
    const runningProjectsCount = runningProjectsList.length;
    const totalProjectValue = allProjects.reduce((sum, p) => sum + (p.projectValue || 0), 0);

    // 2. Workers & Attendance
    const totalWorkers = await prisma.worker.count({
      where: { organizationId: orgId, deletedAt: null },
    });

    const todayAttendance = await prisma.attendance.findMany({
      where: {
        organizationId: orgId,
        date: { gte: startOfToday, lte: endOfToday },
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    });

    const presentToday = todayAttendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'HALF_DAY'
    ).length;
    const absentToday = todayAttendance.filter((a) => a.status === 'ABSENT').length;
    const todayLabourCost = todayAttendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);

    // If SITE_SUPERVISOR: Return operational metrics only (hide sensitive financial P&L)
    if (role === 'SITE_SUPERVISOR') {
      const todayWorkRecords = await prisma.workRecord.findMany({
        where: {
          organizationId: orgId,
          date: { gte: startOfToday, lte: endOfToday },
        },
        include: {
          worker: { select: { name: true } },
          project: { select: { name: true } },
        },
        take: 10,
      });

      return NextResponse.json({
        role: 'SITE_SUPERVISOR',
        organization: {
          id: session.organizationId,
          name: session.organizationName,
          role: session.role,
        },
        summary: {
          totalProjects,
          runningProjects: runningProjectsCount,
          totalWorkers,
          presentToday,
          absentToday,
          markedCount: todayAttendance.length,
          unmarkedCount: Math.max(0, totalWorkers - todayAttendance.length),
        },
        runningProjects: runningProjectsList.slice(0, 5).map((p) => ({
          id: p.id,
          projectCode: p.projectCode,
          name: p.name,
          location: p.location,
          status: p.status,
        })),
        recentWorkRecords: todayWorkRecords,
      });
    }

    // 3. For OWNER, MANAGER, ACCOUNTANT: Full financial metrics & charts
    const todayExpenses = await prisma.expense.findMany({
      where: {
        organizationId: orgId,
        date: { gte: startOfToday, lte: endOfToday },
        deletedAt: null,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    });
    const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const allAttendance = await prisma.attendance.findMany({
      where: {
        organizationId: orgId,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    });
    const totalActualLabourCost = allAttendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);

    const allMaterialReceipts = await prisma.materialReceipt.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    });
    const totalActualMaterialCost = allMaterialReceipts.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    const allExpenses = await prisma.expense.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    });
    const totalActualOtherExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const projectFinancials = calculateProjectCost({
      projectValue: totalProjectValue,
      labourCost: totalActualLabourCost,
      materialCost: totalActualMaterialCost,
      otherExpenses: totalActualOtherExpenses,
    });

    const allAllowances = await prisma.allowance.findMany({
      where: { organizationId: orgId, deletedAt: null },
    });
    const totalAllowances = allAllowances.reduce((sum, a) => sum + (a.amount || 0), 0);

    const allPayments = await prisma.payment.findMany({
      where: { organizationId: orgId, deletedAt: null },
    });
    const totalPaidAndAdvances = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingLabourPayment = Math.max(0, totalActualLabourCost + totalAllowances - totalPaidAndAdvances);

    const materials = await prisma.material.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: {
        receipts: { where: { deletedAt: null } },
        usages: { where: { deletedAt: null } },
      },
    });

    let totalStockValue = 0;
    let lowStockCount = 0;
    materials.forEach((m) => {
      const rec = m.receipts.reduce((sum, r) => sum + r.quantity, 0);
      const used = m.usages.reduce((sum, u) => sum + u.quantity, 0);
      const stock = calculateMaterialStock({
        openingStock: m.openingStock,
        totalReceived: rec,
        totalUsed: used,
        minimumStock: m.minimumStock,
        purchaseRate: m.purchaseRate,
      });
      totalStockValue += stock.stockValue;
      if (stock.isLowStock) lowStockCount++;
    });

    // 7-Day Chart Data
    const chartDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayAtt = allAttendance.filter(
        (a) => new Date(a.date) >= dayStart && new Date(a.date) <= dayEnd
      );
      const dayExp = allExpenses.filter(
        (e) => new Date(e.date) >= dayStart && new Date(e.date) <= dayEnd
      );

      const present = dayAtt.filter((a) => a.status === 'PRESENT' || a.status === 'HALF_DAY').length;
      const labourCost = dayAtt.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
      const expenseAmount = dayExp.reduce((sum, e) => sum + (e.amount || 0), 0);

      chartDays.push({
        day: dayLabel,
        present,
        labourCost,
        expenseAmount,
      });
    }

    return NextResponse.json({
      role,
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        role: session.role,
      },
      summary: {
        totalProjects,
        runningProjects: runningProjectsCount,
        totalWorkers,
        presentToday,
        absentToday,
        todayLabourCost,
        todayExpense: todayExpenseTotal,
        pendingLabourPayment,
        materialStockValue: totalStockValue,
        lowStockCount,
        totalProjectValue,
        actualProjectCost: projectFinancials.actualTotalCost,
        actualProfit: projectFinancials.actualProfit,
        profitMargin: projectFinancials.profitMarginPercentage,
      },
      runningProjects: runningProjectsList.slice(0, 5).map((p) => ({
        id: p.id,
        projectCode: p.projectCode,
        name: p.name,
        location: p.location,
        projectValue: p.projectValue,
        status: p.status,
      })),
      chartData: chartDays,
    });
  } catch (error: any) {
    if (error.message === 'NO_ORGANIZATION') {
      return NextResponse.json({ requireOnboarding: true }, { status: 403 });
    }
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics.' },
      { status: 500 }
    );
  }
}
