import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { calculateProjectCost, calculateMaterialStock } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const dateFilter = searchParams.get('dateFilter') || 'today'; // today, week, month, custom
    const selectedProjectId = searchParams.get('projectId') || undefined;

    // Today's boundaries in UTC
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setUTCHours(23, 59, 59, 999);

    // 1. Project Counts & Values
    const allProjects = await prisma.project.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(selectedProjectId ? { id: selectedProjectId } : {}),
      },
      include: {
        sites: true,
      },
    });

    const totalProjects = allProjects.length;
    const runningProjectsList = allProjects.filter((p) => p.status === 'RUNNING');
    const runningProjectsCount = runningProjectsList.length;
    const totalProjectValue = allProjects.reduce((sum, p) => sum + (p.projectValue || 0), 0);

    // 2. Workers & Today's Attendance
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

    // 3. Today's Expenses
    const todayExpenses = await prisma.expense.findMany({
      where: {
        organizationId: orgId,
        date: { gte: startOfToday, lte: endOfToday },
        deletedAt: null,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    });
    const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // 4. All-time Expenses & Labour Cost for Project Cost & Profit/Loss
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

    // Dynamic calculation engine call
    const projectFinancials = calculateProjectCost({
      projectValue: totalProjectValue,
      labourCost: totalActualLabourCost,
      materialCost: totalActualMaterialCost,
      otherExpenses: totalActualOtherExpenses,
    });

    // 5. Pending Labour Payments (Worker Ledgers)
    const allAllowances = await prisma.allowance.findMany({
      where: { organizationId: orgId, deletedAt: null },
    });
    const totalAllowances = allAllowances.reduce((sum, a) => sum + (a.amount || 0), 0);

    const allPayments = await prisma.payment.findMany({
      where: { organizationId: orgId, deletedAt: null },
    });
    const totalPaidAndAdvances = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingLabourPayment = Math.max(0, (totalActualLabourCost + totalAllowances) - totalPaidAndAdvances);

    // 6. Material Stock Value
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

    // 7. Recent 7-Day Chart Data
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
