import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg, normalizeRole } from '@/lib/auth/session';
import {
  calculateProjectCost,
  calculateMaterialStock,
  calculateWorkerBalance,
  calculateWalletBalance,
  calculateDailyCashFlow,
} from '@/lib/calculations';

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
    const period = searchParams.get('period') || 'today';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Calculate period dates
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    let filterStart: Date | null = null;
    let filterEnd: Date | null = null;
    let periodLabel = 'Today';

    if (period === 'today') {
      filterStart = startOfToday;
      filterEnd = endOfToday;
      periodLabel = 'Today';
    } else if (period === 'weekly') {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      s.setHours(0, 0, 0, 0);
      const e = new Date(now);
      e.setHours(23, 59, 59, 999);
      filterStart = s;
      filterEnd = e;
      periodLabel = 'Last 7 Days';
    } else if (period === 'monthly') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      s.setHours(0, 0, 0, 0);
      const e = new Date(now);
      e.setHours(23, 59, 59, 999);
      filterStart = s;
      filterEnd = e;
      periodLabel = 'This Month';
    } else if (period === 'custom') {
      if (startDateParam && endDateParam) {
        filterStart = new Date(startDateParam);
        filterStart.setHours(0, 0, 0, 0);
        filterEnd = new Date(endDateParam);
        filterEnd.setHours(23, 59, 59, 999);
        periodLabel = `${startDateParam} to ${endDateParam}`;
      } else if (startDateParam) {
        filterStart = new Date(startDateParam);
        filterStart.setHours(0, 0, 0, 0);
        periodLabel = `From ${startDateParam}`;
      } else if (endDateParam) {
        filterEnd = new Date(endDateParam);
        filterEnd.setHours(23, 59, 59, 999);
        periodLabel = `Until ${endDateParam}`;
      }
    } else if (period === 'all') {
      filterStart = null;
      filterEnd = null;
      periodLabel = 'All Time';
    }

    const dateFilterCondition: any = {};
    if (filterStart && filterEnd) {
      dateFilterCondition.gte = filterStart;
      dateFilterCondition.lte = filterEnd;
    } else if (filterStart) {
      dateFilterCondition.gte = filterStart;
    } else if (filterEnd) {
      dateFilterCondition.lte = filterEnd;
    }
    const hasDateCondition = Boolean(filterStart || filterEnd);

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

    // 2. Workers & Attendance (filtered by selected period)
    const totalWorkers = await prisma.worker.count({
      where: { organizationId: orgId, deletedAt: null },
    });

    const periodAttendance = await prisma.attendance.findMany({
      where: {
        organizationId: orgId,
        ...(hasDateCondition ? { date: dateFilterCondition } : {}),
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    });

    const presentCount = periodAttendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'HALF_DAY'
    ).length;
    const absentCount = periodAttendance.filter((a) => a.status === 'ABSENT').length;
    const periodLabourCost = periodAttendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);

    // If SITE_SUPERVISOR: Return operational metrics only (hide sensitive financial P&L)
    if (role === 'SITE_SUPERVISOR') {
      const todayWorkRecords = await prisma.workRecord.findMany({
        where: {
          organizationId: orgId,
          ...(hasDateCondition ? { date: dateFilterCondition } : {}),
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
          presentWorkers: presentCount,
          absentWorkers: absentCount,
          labourCost: periodLabourCost,
          presentToday: presentCount,
          absentToday: absentCount,
          todayLabourCost: periodLabourCost,
          markedCount: periodAttendance.length,
          unmarkedCount: Math.max(0, totalWorkers - periodAttendance.length),
          period,
          periodLabel,
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
    const periodExpenses = await prisma.expense.findMany({
      where: {
        organizationId: orgId,
        ...(hasDateCondition ? { date: dateFilterCondition } : {}),
        deletedAt: null,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    });
    const periodExpenseTotal = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

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

    // 4. Aaj Ka Hisaab (Today's Cash Flow & Partner Wallet)
    const [
      myMoneyInAgg,
      myTransfersInAgg,
      myTransfersOutAgg,
      myExpensesAgg,
      myBankWithdrawalsAgg,
      myBankDepositsAgg,
    ] = await Promise.all([
      prisma.projectReceipt.aggregate({
        where: {
          organizationId: orgId,
          receivedById: session.userId,
          deletedAt: null,
          OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
        },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: { organizationId: orgId, toUserId: session.userId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: { organizationId: orgId, fromUserId: session.userId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId: orgId, walletOwnerId: session.userId, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { organizationId: orgId, partnerId: session.userId, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { organizationId: orgId, partnerId: session.userId, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    const myWallet = calculateWalletBalance({
      totalMoneyIn: myMoneyInAgg._sum.amount || 0,
      totalTransfersIn: myTransfersInAgg._sum.amount || 0,
      totalTransfersOut: myTransfersOutAgg._sum.amount || 0,
      totalExpenses: myExpensesAgg._sum.amount || 0,
      totalBankWithdrawals: myBankWithdrawalsAgg._sum.amount || 0,
      totalBankDeposits: myBankDepositsAgg._sum.amount || 0,
    });

    const [todayMoneyIn, todayTransfersIn, todayTransfersOut, todayExp, todayBWith, todayBDep] = await Promise.all([
      prisma.projectReceipt.aggregate({
        where: {
          organizationId: orgId,
          receivedById: session.userId,
          date: { gte: startOfToday, lte: endOfToday },
          deletedAt: null,
          OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
        },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: { organizationId: orgId, toUserId: session.userId, date: { gte: startOfToday, lte: endOfToday }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.fundTransfer.aggregate({
        where: { organizationId: orgId, fromUserId: session.userId, date: { gte: startOfToday, lte: endOfToday }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { organizationId: orgId, walletOwnerId: session.userId, date: { gte: startOfToday, lte: endOfToday }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { organizationId: orgId, partnerId: session.userId, type: 'TRANSFER_TO_PARTNER', date: { gte: startOfToday, lte: endOfToday }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { organizationId: orgId, partnerId: session.userId, type: 'TRANSFER_FROM_PARTNER', date: { gte: startOfToday, lte: endOfToday }, deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    const todayClosing = await prisma.dailyClosing.findFirst({
      where: { organizationId: orgId, userId: session.userId, date: startOfToday },
    });

    // Multi-Partner summary if Owner
    let partnersComparison = null;
    if (['OWNER', 'MANAGER'].includes(role)) {
      const partnerMemberships = await prisma.organizationUser.findMany({
        where: { organizationId: orgId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      const partnerUsers = partnerMemberships
        .filter((m: any) => ['PARTNER', 'OWNER'].includes(normalizeRole(m.role)))
        .map((m: any) => m.user);

      partnersComparison = await Promise.all(
        partnerUsers.map(async (u: any) => {
          const [mIn, tIn, tOut, exp, bWith, bDep] = await Promise.all([
            prisma.projectReceipt.aggregate({
              where: {
                organizationId: orgId,
                receivedById: u.id,
                deletedAt: null,
                OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
              },
              _sum: { amount: true },
            }),
            prisma.fundTransfer.aggregate({
              where: { organizationId: orgId, toUserId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.fundTransfer.aggregate({
              where: { organizationId: orgId, fromUserId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.expense.aggregate({
              where: { organizationId: orgId, walletOwnerId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.bankTransaction.aggregate({
              where: { organizationId: orgId, partnerId: u.id, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.bankTransaction.aggregate({
              where: { organizationId: orgId, partnerId: u.id, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
              _sum: { amount: true },
            }),
          ]);

          const w = calculateWalletBalance({
            totalMoneyIn: mIn._sum.amount || 0,
            totalTransfersIn: tIn._sum.amount || 0,
            totalTransfersOut: tOut._sum.amount || 0,
            totalExpenses: exp._sum.amount || 0,
            totalBankWithdrawals: bWith._sum.amount || 0,
            totalBankDeposits: bDep._sum.amount || 0,
          });

          return {
            userId: u.id,
            name: u.name,
            balance: w.balance,
            totalCredits: w.totalCredits,
            totalDebits: w.totalDebits,
          };
        })
      );
    }

    return NextResponse.json({
      role,
      organization: {
        id: session.organizationId,
        name: session.organizationName,
        role: session.role,
      },
      aajKaHisaab: {
        walletBalance: myWallet.balance,
        todayInflow: (todayMoneyIn._sum.amount || 0) + (todayTransfersIn._sum.amount || 0),
        todayTransfersOut: todayTransfersOut._sum.amount || 0,
        todayExpenses: todayExp._sum.amount || 0,
        todayOutflow: (todayTransfersOut._sum.amount || 0) + (todayExp._sum.amount || 0),
        isClosingVerified: Boolean(todayClosing?.isVerified),
        physicalCash: todayClosing?.actualCash ?? null,
      },
      partnersComparison,
      summary: {
        totalProjects,
        runningProjects: runningProjectsCount,
        totalWorkers,
        period,
        periodLabel,
        presentWorkers: presentCount,
        absentWorkers: absentCount,
        labourCost: periodLabourCost,
        expenseTotal: periodExpenseTotal,
        presentToday: presentCount,
        absentToday: absentCount,
        todayLabourCost: periodLabourCost,
        todayExpense: periodExpenseTotal,
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
