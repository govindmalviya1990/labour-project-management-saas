import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { calculateProjectCost, calculateCostPerUnit, calculateMaterialStock, calculateWorkerBalance } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.split('T')[0].split('-');
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
  }
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(clean)) {
    const parts = clean.split(/[-/]/);
    return { day: parseInt(parts[0], 10), month: parseInt(parts[1], 10), year: parseInt(parts[2], 10) };
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  return null;
}

function resolveReportDateBounds(
  startDateStr?: string | null,
  endDateStr?: string | null
): { startDate: Date | null; endDate: Date | null; hasDateFilter: boolean } {
  const s = (startDateStr || '').trim();
  const e = (endDateStr || '').trim();
  if (!s && !e) return { startDate: null, endDate: null, hasDateFilter: false };

  const now = new Date();
  if (s && (!e || s === e)) {
    // Single Day (e.g. "2026-10-08" or "08-10-2026")
    const parts = parseDateParts(s);
    if (!parts) return { startDate: null, endDate: null, hasDateFilter: false };
    const { year, month, day } = parts;
    const startIST = new Date(Date.UTC(year, month - 1, day - 1, 18, 30, 0, 0));
    const endUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    return { startDate: startIST, endDate: endUTC, hasDateFilter: true };
  }

  const sParts = parseDateParts(s);
  const eParts = parseDateParts(e);
  const startDate = sParts
    ? new Date(Date.UTC(sParts.year, sParts.month - 1, sParts.day - 1, 18, 30, 0, 0))
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endDate = eParts
    ? new Date(Date.UTC(eParts.year, eParts.month - 1, eParts.day, 23, 59, 59, 999))
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return { startDate, endDate, hasDateFilter: true };
}

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'labour';
    const projectId = searchParams.get('projectId');
    const workerId = searchParams.get('workerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, mobile: true, email: true, address: true, gstNumber: true, logoUrl: true },
    });

    const { startDate: resolvedStart, endDate: resolvedEnd, hasDateFilter } = resolveReportDateBounds(
      startDate,
      endDate
    );

    const dateFilter: any = {};
    if (resolvedStart) dateFilter.gte = resolvedStart;
    if (resolvedEnd) dateFilter.lte = resolvedEnd;

    // 1. LABOUR REPORT
    if (type === 'labour') {
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
              ...(hasDateFilter ? { date: dateFilter } : {}),
              ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
            },
          },
          payments: {
            where: {
              organizationId: orgId,
              ...(hasDateFilter ? { date: dateFilter } : {}),
            },
          },
          allowances: {
            where: {
              organizationId: orgId,
              ...(hasDateFilter ? { date: dateFilter } : {}),
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const reportRows = workers.map((w) => {
        const daysPresent = w.attendance.filter((a) => a.status === 'PRESENT' || a.status === 'OVERTIME').length;
        const halfDays = w.attendance.filter((a) => a.status === 'HALF_DAY').length;
        const totalEarned = w.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
        const totalAllowances = w.allowances.reduce((sum, al) => sum + al.amount, 0);
        const totalAdvances = w.payments.filter((p) => p.transactionType === 'ADVANCE').reduce((sum, p) => sum + p.amount, 0);
        const totalPayments = w.payments.filter((p) => p.transactionType === 'SALARY' || p.transactionType === 'PAYMENT' || p.transactionType === 'FINAL_SETTLEMENT').reduce((sum, p) => sum + p.amount, 0);

        const balance = calculateWorkerBalance({
          totalEarnedSalary: totalEarned,
          totalAllowances,
          totalAdvances,
          totalPayments,
        });

        return {
          id: w.id,
          workerCode: w.workerCode,
          name: w.name,
          category: w.category,
          dailyWage: w.dailyWage,
          daysWorked: daysPresent + halfDays * 0.5,
          totalEarned,
          totalAllowances,
          totalAdvances,
          totalPaid: totalPayments,
          remainingPayable: balance.remainingPayable,
          paymentStatus: balance.paymentStatus,
        };
      });

      return NextResponse.json({
        reportType: 'Labour Directory & Earnings Report',
        organization: org,
        summary: {
          totalWorkers: workers.length,
          totalWagesEarned: reportRows.reduce((sum, r) => sum + r.totalEarned, 0),
          totalPayableOutstanding: reportRows.reduce((sum, r) => sum + r.remainingPayable, 0),
        },
        data: reportRows,
      });
    }

    // 2. ATTENDANCE REPORT
    if (type === 'attendance') {
      const records = await prisma.attendance.findMany({
        where: {
          organizationId: orgId,
          ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          ...(workerId && workerId !== 'ALL' ? { workerId } : {}),
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
        include: {
          worker: { select: { workerCode: true, name: true, category: true, dailyWage: true } },
          project: { select: { name: true, projectCode: true } },
        },
        orderBy: { date: 'desc' },
      });

      const data = records.map((r) => ({
        id: r.id,
        date: r.date,
        workerCode: r.worker?.workerCode,
        workerName: r.worker?.name,
        category: r.worker?.category,
        projectName: r.project?.name,
        status: r.status,
        shift: r.shift || 'DAY',
        overtimeHours: r.overtimeHours,
        wageForDay: r.wageForDay,
        notes: r.notes || '',
      }));

      return NextResponse.json({
        reportType: 'Daily Labour Attendance Sheet',
        organization: org,
        summary: {
          totalEntries: records.length,
          presentCount: records.filter((r) => r.status === 'PRESENT' || r.status === 'OVERTIME').length,
          halfDayCount: records.filter((r) => r.status === 'HALF_DAY').length,
          absentCount: records.filter((r) => r.status === 'ABSENT').length,
          totalWages: records.reduce((sum, r) => sum + (r.wageForDay || 0), 0),
        },
        data,
      });
    }

    // 3. PRODUCTIVITY REPORT
    if (type === 'productivity') {
      const workRecords = await prisma.workRecord.findMany({
        where: {
          organizationId: orgId,
          ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          ...(workerId && workerId !== 'ALL' ? { workerId } : {}),
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
        include: {
          worker: { select: { workerCode: true, name: true, category: true } },
          project: { select: { name: true } },
        },
      });

      const workerMap: Record<string, any> = {};

      workRecords.forEach((wr) => {
        const key = `${wr.workerId}_${wr.task}`;
        if (!workerMap[key]) {
          workerMap[key] = {
            workerId: wr.workerId,
            workerCode: wr.worker?.workerCode,
            workerName: wr.worker?.name,
            category: wr.worker?.category,
            projectName: wr.project?.name,
            task: wr.task,
            unit: wr.unit,
            totalQuantity: 0,
            totalCost: 0,
            logCount: 0,
          };
        }
        workerMap[key].totalQuantity += wr.quantity;
        workerMap[key].totalCost += wr.totalWorkValue;
        workerMap[key].logCount += 1;
      });

      const data = Object.values(workerMap).map((row: any) => {
        const avgOutputPerLog = Math.round((row.totalQuantity / (row.logCount || 1)) * 100) / 100;
        const avgUnitRate = Math.round((row.totalCost / (row.totalQuantity || 1)) * 100) / 100;
        return {
          ...row,
          avgOutputPerLog,
          avgUnitRate,
        };
      });

      return NextResponse.json({
        reportType: 'Worker Productivity & Output Efficiency Report',
        organization: org,
        summary: {
          totalOutputLogs: workRecords.length,
          totalOutputQuantity: workRecords.reduce((sum, w) => sum + w.quantity, 0),
          totalWorkValue: workRecords.reduce((sum, w) => sum + w.totalWorkValue, 0),
        },
        data,
      });
    }

    // 4. WORK REPORT
    if (type === 'work') {
      const workRecords = await prisma.workRecord.findMany({
        where: {
          organizationId: orgId,
          ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          ...(workerId && workerId !== 'ALL' ? { workerId } : {}),
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
        include: {
          worker: { select: { workerCode: true, name: true, category: true } },
          project: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      });

      const data = workRecords.map((w) => ({
        id: w.id,
        date: w.date,
        workerCode: w.worker?.workerCode,
        workerName: w.worker?.name,
        category: w.worker?.category,
        projectName: w.project?.name,
        task: w.task,
        quantity: w.quantity,
        unit: w.unit,
        rate: w.rate,
        totalWorkValue: w.totalWorkValue,
        notes: w.notes,
      }));

      return NextResponse.json({
        reportType: 'Daily Completed Work & Piece-Rate Log',
        organization: org,
        summary: {
          totalRecords: workRecords.length,
          totalAmount: workRecords.reduce((sum, w) => sum + w.totalWorkValue, 0),
        },
        data,
      });
    }

    // 5, 6, 7. EXPENSE REPORTS (Daily, Weekly, Monthly, All Expense)
    if (type === 'daily-expense' || type === 'weekly-expense' || type === 'monthly-expense' || type === 'expense') {
      const expenses = await prisma.expense.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
        include: {
          project: { select: { name: true, projectCode: true } },
          site: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      });

      const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

      // Compute Category-Wise Expense Breakdown
      const categoryMap: Record<string, { totalAmount: number; count: number; percentage: number }> = {};
      expenses.forEach((e) => {
        const cat = e.category || 'MISCELLANEOUS';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { totalAmount: 0, count: 0, percentage: 0 };
        }
        categoryMap[cat].totalAmount += e.amount;
        categoryMap[cat].count += 1;
      });

      Object.keys(categoryMap).forEach((cat) => {
        categoryMap[cat].percentage = totalAmount > 0
          ? Math.round((categoryMap[cat].totalAmount / totalAmount) * 1000) / 10
          : 0;
      });

      const categoryBreakdown = Object.entries(categoryMap)
        .map(([category, stats]) => ({
          category,
          totalAmount: stats.totalAmount,
          count: stats.count,
          percentage: stats.percentage,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

      const data = expenses.map((e) => ({
        id: e.id,
        date: e.date,
        projectName: e.project?.name || 'General HQ / Office',
        siteName: e.site?.name || '—',
        category: e.category,
        description: e.description,
        amount: e.amount,
        paidBy: e.paidBy || '—',
        paymentMethod: e.paymentMethod,
        vendorName: e.vendorName || '—',
        notes: e.notes || '',
      }));

      const title =
        type === 'daily-expense'
          ? 'Daily Construction Site Expense Report'
          : type === 'weekly-expense'
          ? 'Weekly Aggregated Expense Statement'
          : type === 'monthly-expense'
          ? 'Monthly Site Expense & Overhead Audit'
          : 'Construction & Site Expense Report';

      return NextResponse.json({
        reportType: title,
        organization: org,
        summary: {
          totalTransactions: expenses.length,
          totalAmount,
          categories: categoryMap,
        },
        categoryBreakdown,
        data,
      });
    }

    // 8. MATERIAL REPORT
    if (type === 'material') {
      const materials = await prisma.material.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
        },
        include: {
          supplier: { select: { name: true } },
          receipts: {
            where: {
              organizationId: orgId,
              deletedAt: null,
              ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
              ...(hasDateFilter ? { date: dateFilter } : {}),
            },
          },
          usages: {
            where: {
              organizationId: orgId,
              deletedAt: null,
              ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
              ...(hasDateFilter ? { date: dateFilter } : {}),
            },
          },
          transfers: {
            where: {
              organizationId: orgId,
              ...(projectId && projectId !== 'ALL'
                ? { OR: [{ sourceProjectId: projectId }, { destinationProjectId: projectId }] }
                : {}),
              ...(hasDateFilter ? { date: dateFilter } : {}),
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const data = materials.map((m) => {
        const totalReceived = m.receipts.reduce((sum, r) => sum + r.quantity, 0);
        const totalUsed = m.usages.reduce((sum, u) => sum + u.quantity, 0);
        let transfersIn = 0;
        let transfersOut = 0;
        if (projectId && projectId !== 'ALL') {
          transfersIn = m.transfers
            .filter((t) => t.destinationProjectId === projectId)
            .reduce((sum, t) => sum + t.quantity, 0);
          transfersOut = m.transfers
            .filter((t) => t.sourceProjectId === projectId)
            .reduce((sum, t) => sum + t.quantity, 0);
        }

        const stock = calculateMaterialStock({
          openingStock: projectId ? 0 : m.openingStock,
          totalReceived,
          totalUsed,
          transfersIn,
          transfersOut,
          minimumStock: m.minimumStock,
          purchaseRate: m.purchaseRate,
        });

        return {
          id: m.id,
          materialCode: m.materialCode,
          name: m.name,
          category: m.category,
          unit: m.unit,
          openingStock: m.openingStock,
          received: totalReceived,
          used: totalUsed,
          remainingStock: stock.remainingStock,
          minimumStock: m.minimumStock,
          purchaseRate: m.purchaseRate,
          stockValue: stock.stockValue,
          status: stock.isLowStock ? 'LOW STOCK' : 'OK',
          supplier: m.supplier?.name || 'Direct',
        };
      });

      return NextResponse.json({
        reportType: 'Material Inventory & Stock Valuation Report',
        organization: org,
        summary: {
          totalItems: materials.length,
          totalStockValue: data.reduce((sum, m) => sum + m.stockValue, 0),
          lowStockItems: data.filter((m) => m.status === 'LOW STOCK').length,
        },
        data,
      });
    }

    // 9. SALARY REPORT
    if (type === 'salary') {
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
              ...(hasDateFilter ? { date: dateFilter } : {}),
              ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
            },
          },
          allowances: {
            where: {
              organizationId: orgId,
              ...(hasDateFilter ? { date: dateFilter } : {}),
            },
          },
          payments: {
            where: {
              organizationId: orgId,
              ...(hasDateFilter ? { date: dateFilter } : {}),
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const data = workers.map((w) => {
        const regularDays = w.attendance.filter((a) => a.status === 'PRESENT').length;
        const halfDays = w.attendance.filter((a) => a.status === 'HALF_DAY').length;
        const otDays = w.attendance.filter((a) => a.status === 'OVERTIME').length;
        const totalOTHours = w.attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
        const earnedWages = w.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
        const allowances = w.allowances.reduce((sum, al) => sum + al.amount, 0);
        const grossSalary = earnedWages + allowances;
        const advances = w.payments.filter((p) => p.transactionType === 'ADVANCE').reduce((sum, p) => sum + p.amount, 0);
        const payments = w.payments.filter((p) => p.transactionType === 'SALARY' || p.transactionType === 'PAYMENT' || p.transactionType === 'FINAL_SETTLEMENT').reduce((sum, p) => sum + p.amount, 0);
        const netPayable = Math.max(0, grossSalary - advances - payments);

        return {
          id: w.id,
          workerCode: w.workerCode,
          name: w.name,
          category: w.category,
          dailyWage: w.dailyWage,
          daysWorked: regularDays + otDays + halfDays * 0.5,
          totalOTHours,
          earnedWages,
          allowances,
          grossSalary,
          advances,
          payments,
          netPayable,
          status: netPayable === 0 ? 'PAID' : payments > 0 ? 'PARTIAL' : 'PENDING',
        };
      });

      return NextResponse.json({
        reportType: 'Worker Monthly Wage & Payroll Sheet',
        organization: org,
        summary: {
          totalWorkers: workers.length,
          totalGrossSalary: data.reduce((sum, d) => sum + d.grossSalary, 0),
          totalPaidOut: data.reduce((sum, d) => sum + d.payments + d.advances, 0),
          totalNetPayable: data.reduce((sum, d) => sum + d.netPayable, 0),
        },
        data,
      });
    }

    // 10. KHATA REPORT
    if (type === 'khata') {
      const workers = await prisma.worker.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(workerId && workerId !== 'ALL' ? { id: workerId } : {}),
        },
        include: {
          attendance: { where: { organizationId: orgId, ...(hasDateFilter ? { date: dateFilter } : {}) } },
          allowances: { where: { organizationId: orgId, ...(hasDateFilter ? { date: dateFilter } : {}) } },
          payments: { where: { organizationId: orgId, ...(hasDateFilter ? { date: dateFilter } : {}) } },
        },
        orderBy: { name: 'asc' },
      });

      const data = workers.map((w) => {
        const totalEarned = w.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
        const totalAllowances = w.allowances.reduce((sum, al) => sum + al.amount, 0);
        const totalAdvances = w.payments.filter((p) => p.transactionType === 'ADVANCE').reduce((sum, p) => sum + p.amount, 0);
        const totalPayments = w.payments.filter((p) => p.transactionType === 'SALARY' || p.transactionType === 'PAYMENT' || p.transactionType === 'FINAL_SETTLEMENT').reduce((sum, p) => sum + p.amount, 0);

        const balance = calculateWorkerBalance({
          totalEarnedSalary: totalEarned,
          totalAllowances,
          totalAdvances,
          totalPayments,
        });

        return {
          workerId: w.id,
          workerCode: w.workerCode,
          name: w.name,
          category: w.category,
          mobile: w.mobile,
          totalCredits: balance.totalCredits, // Wages + Allowances
          totalDebits: balance.totalDebits,   // Advances + Payments
          remainingPayable: balance.remainingPayable,
          paymentStatus: balance.paymentStatus,
        };
      });

      return NextResponse.json({
        reportType: 'Worker Khata / Master Ledger Summary',
        organization: org,
        summary: {
          totalWorkers: workers.length,
          totalCredits: data.reduce((sum, d) => sum + d.totalCredits, 0),
          totalDebits: data.reduce((sum, d) => sum + d.totalDebits, 0),
          netPayable: data.reduce((sum, d) => sum + d.remainingPayable, 0),
        },
        data,
      });
    }

    // 11. PROJECT COST REPORT
    if (type === 'project-cost') {
      const projects = await prisma.project.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(projectId && projectId !== 'ALL' ? { id: projectId } : {}),
        },
        include: {
          attendance: { select: { wageForDay: true } },
          materialReceipts: { where: { deletedAt: null }, select: { totalCost: true } },
          expenses: { where: { deletedAt: null }, select: { amount: true } },
          workRecords: { select: { quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = projects.map((p) => {
        const actualLabour = p.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
        const actualMaterial = p.materialReceipts.reduce((sum, m) => sum + (m.totalCost || 0), 0);
        const actualOther = p.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const completedQuantity = p.workRecords.reduce((sum, w) => sum + (w.quantity || 0), 0);

        const cost = calculateProjectCost({
          projectValue: p.projectValue,
          labourCost: actualLabour,
          materialCost: actualMaterial,
          otherExpenses: actualOther,
          estimatedLabourCost: p.estimatedLabourCost,
          estimatedMaterialCost: p.estimatedMaterialCost,
          estimatedOtherExpense: p.estimatedOtherExpense,
        });

        const costPerUnit = calculateCostPerUnit({
          completedQuantity: completedQuantity || p.targetQuantity || 0,
          totalLabourCost: actualLabour,
          totalMaterialCost: actualMaterial,
          totalOtherCost: actualOther,
          unitName: p.targetUnit || 'sq.ft.',
        });

        return {
          projectCode: p.projectCode,
          name: p.name,
          status: p.status,
          targetQuantity: `${p.targetQuantity || 0} ${p.targetUnit || 'sq.ft.'}`,
          completedQuantity: `${completedQuantity} ${p.targetUnit || 'sq.ft.'}`,
          estimatedBudget: cost.estimatedTotalCost,
          actualLabour,
          actualMaterial,
          actualOther,
          totalActualCost: cost.actualTotalCost,
          variance: cost.costVariance,
          isBudgetExceeded: cost.isBudgetExceeded,
          costPerUnit: `₹${costPerUnit.totalCostPerUnit} / ${p.targetUnit || 'sq.ft.'}`,
        };
      });

      return NextResponse.json({
        reportType: 'Comprehensive Project Cost & Budget Variance Report',
        organization: org,
        summary: {
          totalProjects: projects.length,
          totalEstimated: data.reduce((sum, d) => sum + d.estimatedBudget, 0),
          totalActualCost: data.reduce((sum, d) => sum + d.totalActualCost, 0),
        },
        data,
      });
    }

    // 12. PROFIT / LOSS REPORT
    if (type === 'profit-loss') {
      const projects = await prisma.project.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(projectId && projectId !== 'ALL' ? { id: projectId } : {}),
        },
        include: {
          attendance: { select: { wageForDay: true } },
          materialReceipts: { where: { deletedAt: null }, select: { totalCost: true } },
          expenses: { where: { deletedAt: null }, select: { amount: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = projects.map((p) => {
        const actualLabour = p.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
        const actualMaterial = p.materialReceipts.reduce((sum, m) => sum + (m.totalCost || 0), 0);
        const actualOther = p.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        const cost = calculateProjectCost({
          projectValue: p.projectValue,
          labourCost: actualLabour,
          materialCost: actualMaterial,
          otherExpenses: actualOther,
          estimatedLabourCost: p.estimatedLabourCost,
          estimatedMaterialCost: p.estimatedMaterialCost,
          estimatedOtherExpense: p.estimatedOtherExpense,
        });

        return {
          projectCode: p.projectCode,
          name: p.name,
          status: p.status,
          projectValue: p.projectValue,
          totalActualCost: cost.actualTotalCost,
          projectedProfit: cost.actualProfit,
          profitMarginPercentage: cost.profitMarginPercentage,
          isProfitable: cost.actualProfit >= 0,
        };
      });

      const totalRevenue = data.reduce((sum, d) => sum + d.projectValue, 0);
      const totalCost = data.reduce((sum, d) => sum + d.totalActualCost, 0);
      const netProfit = totalRevenue - totalCost;
      const overallMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 10000) / 100 : 0;

      return NextResponse.json({
        reportType: 'Project Financial Statement & Profit/Loss Audit',
        organization: org,
        summary: {
          totalContractedValue: totalRevenue,
          totalActualExpenses: totalCost,
          netProjectedProfit: netProfit,
          overallMarginPercentage: overallMargin,
        },
        data,
      });
    }

    return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  } catch (error: any) {
    console.error('Reports GET error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
