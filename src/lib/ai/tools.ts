import prisma from '@/lib/db/prisma';
import { ToolExecutionContext, LlmToolDefinition } from './types';
import {
  calculateWalletBalance,
  calculateDailyCashFlow,
  formatINR,
} from '@/lib/calculations';
import { getStartOfDayUTC } from '@/lib/auth/day-lock';
import { normalizeRole } from '@/lib/auth/roles';

// -------------------------------------------------------------
// Read-Only Tool Declarations for LLM
// -------------------------------------------------------------

export const READ_ONLY_TOOL_DEFINITIONS: LlmToolDefinition[] = [
  {
    name: 'getCashBookSummary',
    description: 'Get live Cash Book and wallet balance for a user on a given date (default today). Shows cash in hand, money in, money out, and closing hisaab status.',
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID of the partner or supervisor (Only accessible by Owner). If omitted, defaults to current user.',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today.',
        },
      },
    },
  },
  {
    name: 'getPartnerWallets',
    description: 'Get live closing cash in hand and wallet balance for all partners. Accessible in full only by OWNER/MANAGER. Partners can only see their own balance.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getExpenses',
    description: 'Query site and daily expenses with filters for date range, category, or project.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Expense category or custom reason (e.g. CHAY_NASTA, TRAVEL_PETROL, Dinner, Petrol, etc.)',
        },
        projectId: {
          type: 'string',
          description: 'Filter by specific project ID.',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format.',
        },
      },
    },
  },
  {
    name: 'getWorkerKhata',
    description: 'Look up a worker ledger (khata), total wages earned, advance paid, and pending balance amount.',
    parameters: {
      type: 'object',
      properties: {
        workerName: {
          type: 'string',
          description: 'Name or part of the name of the worker (e.g. Ramesh, Mukesh).',
        },
        workerId: {
          type: 'string',
          description: 'Specific worker ID if known.',
        },
      },
    },
  },
  {
    name: 'getProjectSummary',
    description: 'Get project financial summary: contract value, money received from client, pending receivables, and expenses.',
    parameters: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'Project name or search keyword.',
        },
        projectId: {
          type: 'string',
          description: 'Specific project ID.',
        },
      },
    },
  },
  {
    name: 'getMaterialStock',
    description: 'Get waterproofing material inventory: Aaya (Inward), Use Hua (Consumed), and Bacha (Current Balance Stock).',
    parameters: {
      type: 'object',
      properties: {
        materialName: {
          type: 'string',
          description: 'Name of the material (e.g. Dr. Fixit, PU 270i, Cipoxy, Bitumen).',
        },
        siteId: {
          type: 'string',
          description: 'Filter by specific site/tower ID.',
        },
      },
    },
  },
  {
    name: 'getDailyReport',
    description: 'Get high-level daily operational summary for today or a specific date: attendance count, daily cash flow, and key expenses.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today.',
        },
      },
    },
  },
  {
    name: 'getPendingPayments',
    description: 'Check pending client receivables (money yet to be collected) and pending worker payouts.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Filter by project ID.',
        },
      },
    },
  },
];

// -------------------------------------------------------------
// Tool Implementations (Strict Role-Enforced Server Logic)
// -------------------------------------------------------------

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  ctx: ToolExecutionContext
): Promise<any> {
  const role = normalizeRole(ctx.userRole);
  const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(role);

  switch (toolName) {
    // ---------------------------------------------------------
    // 1. getCashBookSummary
    // ---------------------------------------------------------
    case 'getCashBookSummary': {
      // Role Scope: Partner or Supervisor can only view their own wallet
      const targetUserId = (isOwnerOrManager && args.userId) ? args.userId : ctx.userId;
      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const targetDate = new Date(dateStr);
      const dayStart = getStartOfDayUTC(targetDate);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, email: true },
      });

      if (!targetUser) {
        return { error: 'User not found' };
      }

      // 1. Lifetime balances
      const [moneyInAgg, transfersInAgg, transfersOutAgg, expensesAgg] = await Promise.all([
        prisma.projectReceipt.aggregate({
          where: { organizationId: ctx.organizationId, receivedById: targetUserId, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.fundTransfer.aggregate({
          where: { organizationId: ctx.organizationId, toUserId: targetUserId, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.fundTransfer.aggregate({
          where: { organizationId: ctx.organizationId, fromUserId: targetUserId, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { organizationId: ctx.organizationId, walletOwnerId: targetUserId, deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

      const wallet = calculateWalletBalance({
        totalMoneyIn: moneyInAgg._sum.amount || 0,
        totalTransfersIn: transfersInAgg._sum.amount || 0,
        totalTransfersOut: transfersOutAgg._sum.amount || 0,
        totalExpenses: expensesAgg._sum.amount || 0,
      });

      // 2. Day Cash Flow
      const [priorInAgg, priorTInAgg, priorTOutAgg, priorExpAgg] = await Promise.all([
        prisma.projectReceipt.aggregate({
          where: { organizationId: ctx.organizationId, receivedById: targetUserId, date: { lt: dayStart }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.fundTransfer.aggregate({
          where: { organizationId: ctx.organizationId, toUserId: targetUserId, date: { lt: dayStart }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.fundTransfer.aggregate({
          where: { organizationId: ctx.organizationId, fromUserId: targetUserId, date: { lt: dayStart }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { organizationId: ctx.organizationId, walletOwnerId: targetUserId, date: { lt: dayStart }, deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

      const openingBalance = (
        (priorInAgg._sum.amount || 0) + (priorTInAgg._sum.amount || 0)
      ) - (
        (priorTOutAgg._sum.amount || 0) + (priorExpAgg._sum.amount || 0)
      );

      const [dayInAgg, dayTInAgg, dayTOutAgg, dayExpAgg, closingRecord] = await Promise.all([
        prisma.projectReceipt.aggregate({
          where: { organizationId: ctx.organizationId, receivedById: targetUserId, date: { gte: dayStart, lte: dayEnd }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.fundTransfer.aggregate({
          where: { organizationId: ctx.organizationId, toUserId: targetUserId, date: { gte: dayStart, lte: dayEnd }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.fundTransfer.aggregate({
          where: { organizationId: ctx.organizationId, fromUserId: targetUserId, date: { gte: dayStart, lte: dayEnd }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { organizationId: ctx.organizationId, walletOwnerId: targetUserId, date: { gte: dayStart, lte: dayEnd }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.dailyClosing.findUnique({
          where: {
            organizationId_userId_date: {
              organizationId: ctx.organizationId,
              userId: targetUserId,
              date: dayStart,
            },
          },
        }),
      ]);

      const daily = calculateDailyCashFlow({
        openingBalance,
        moneyInToday: dayInAgg._sum.amount || 0,
        transfersInToday: dayTInAgg._sum.amount || 0,
        transfersOutToday: dayTOutAgg._sum.amount || 0,
        expensesToday: dayExpAgg._sum.amount || 0,
        actualPhysicalCash: closingRecord?.actualCash ?? undefined,
      });

      return {
        user: targetUser.name,
        date: dateStr,
        cashInHand: wallet.balance,
        formattedCashInHand: formatINR(wallet.balance),
        today: {
          openingBalance: daily.openingBalance,
          moneyIn: daily.totalInflowToday,
          moneyOut: daily.totalOutflowToday,
          closingBalance: daily.closingBalance,
          discrepancy: daily.discrepancy,
          isVerified: Boolean(closingRecord?.isVerified),
          verifiedAt: closingRecord?.verifiedAt || null,
        },
      };
    }

    // ---------------------------------------------------------
    // 2. getPartnerWallets
    // ---------------------------------------------------------
    case 'getPartnerWallets': {
      // Role Scope: Only Owner/Manager can view all partners
      if (!isOwnerOrManager) {
        // If Partner, return only their own balance
        if (role === 'PARTNER') {
          const selfSummary = await executeTool('getCashBookSummary', {}, ctx);
          return {
            message: 'You have access to your own partner wallet balance only.',
            partners: [
              {
                name: ctx.userName,
                cashInHand: selfSummary.cashInHand,
                formattedBalance: selfSummary.formattedCashInHand,
              },
            ],
          };
        }
        return { error: 'Supervisors do not have access to partner wallet overview.' };
      }

      const memberships = await prisma.organizationUser.findMany({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, email: true, mobile: true } } },
      });

      const partnerUsers = memberships
        .filter((m: any) => ['PARTNER', 'OWNER'].includes(normalizeRole(m.role)))
        .map((m: any) => m.user);

      const summaries = await Promise.all(
        partnerUsers.map(async (u: any) => {
          const [mIn, tIn, tOut, exp] = await Promise.all([
            prisma.projectReceipt.aggregate({
              where: { organizationId: ctx.organizationId, receivedById: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.fundTransfer.aggregate({
              where: { organizationId: ctx.organizationId, toUserId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.fundTransfer.aggregate({
              where: { organizationId: ctx.organizationId, fromUserId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.expense.aggregate({
              where: { organizationId: ctx.organizationId, walletOwnerId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
          ]);

          const bal = calculateWalletBalance({
            totalMoneyIn: mIn._sum.amount || 0,
            totalTransfersIn: tIn._sum.amount || 0,
            totalTransfersOut: tOut._sum.amount || 0,
            totalExpenses: exp._sum.amount || 0,
          });

          return {
            userId: u.id,
            name: u.name,
            balance: bal.balance,
            formattedBalance: formatINR(bal.balance),
            totalIn: bal.totalCredits,
            totalOut: bal.totalDebits,
          };
        })
      );

      return {
        totalPartners: summaries.length,
        partners: summaries,
      };
    }

    // ---------------------------------------------------------
    // 3. getExpenses
    // ---------------------------------------------------------
    case 'getExpenses': {
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      // Role Scope: Partner or Supervisor restricted to self or assigned
      if (role === 'PARTNER' || role === 'SITE_SUPERVISOR') {
        where.OR = [
          { walletOwnerId: ctx.userId },
          { spentById: ctx.userId },
        ];
      }

      if (args.category) {
        where.category = { contains: args.category };
      }
      if (args.projectId) {
        where.projectId = args.projectId;
      }
      if (args.startDate || args.endDate) {
        where.date = {};
        if (args.startDate) where.date.gte = new Date(args.startDate);
        if (args.endDate) where.date.lte = new Date(args.endDate);
      }

      const expenses = await prisma.expense.findMany({
        where,
        take: 20,
        orderBy: { date: 'desc' },
        include: {
          project: { select: { name: true } },
          spentBy: { select: { name: true } },
        },
      });

      const totalAmount = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

      return {
        count: expenses.length,
        totalAmount,
        formattedTotal: formatINR(totalAmount),
        expenses: expenses.map((e: any) => ({
          id: e.id,
          date: e.date.toISOString().split('T')[0],
          description: e.description,
          category: e.category,
          amount: e.amount,
          formattedAmount: formatINR(e.amount),
          project: e.project?.name || 'General',
          spentBy: e.spentBy?.name || e.paidBy || 'Unknown',
        })),
      };
    }

    // ---------------------------------------------------------
    // 4. getWorkerKhata
    // ---------------------------------------------------------
    case 'getWorkerKhata': {
      let worker = null;
      if (args.workerId) {
        worker = await prisma.worker.findFirst({
          where: { id: args.workerId, organizationId: ctx.organizationId },
        });
      } else if (args.workerName) {
        worker = await prisma.worker.findFirst({
          where: {
            organizationId: ctx.organizationId,
            name: { contains: args.workerName },
          },
        });
      }

      if (!worker) {
        return { error: `No worker found matching "${args.workerName || args.workerId || ''}"` };
      }

      // Fetch wage earnings (salary records) and payouts
      const [earningsAgg, paymentsAgg] = await Promise.all([
        prisma.salaryRecord.aggregate({
          where: { organizationId: ctx.organizationId, workerId: worker.id },
          _sum: { netPayable: true, totalGrossSalary: true },
        }),
        prisma.payment.aggregate({
          where: { organizationId: ctx.organizationId, workerId: worker.id, deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

      const earned = (earningsAgg._sum?.netPayable ?? earningsAgg._sum?.totalGrossSalary) || 0;
      const paid = paymentsAgg._sum.amount || 0;
      const remainingDues = Math.round((earned - paid) * 100) / 100;

      return {
        workerId: worker.id,
        name: worker.name,
        workerCode: worker.workerCode,
        category: worker.category,
        dailyWage: worker.dailyWage,
        totalEarned: earned,
        totalPaid: paid,
        pendingDues: remainingDues,
        formattedPendingDues: formatINR(remainingDues),
        status: remainingDues <= 0 ? 'FULLY_PAID' : 'PENDING_DUES',
      };
    }

    // ---------------------------------------------------------
    // 5. getProjectSummary
    // ---------------------------------------------------------
    case 'getProjectSummary': {
      const where: any = {
        organizationId: ctx.organizationId,
      };

      if (role === 'PARTNER') {
        where.OR = [{ partnerId: ctx.userId }, { partnerId: null }];
      }

      if (args.projectId) {
        where.id = args.projectId;
      } else if (args.projectName) {
        where.name = { contains: args.projectName };
      }

      const projects = await prisma.project.findMany({
        where,
        take: 10,
        select: {
          id: true,
          name: true,
          projectCode: true,
          projectValue: true,
          status: true,
          receipts: {
            where: { deletedAt: null },
            select: { amount: true },
          },
          expenses: {
            where: { deletedAt: null },
            select: { amount: true },
          },
        },
      });

      return {
        count: projects.length,
        projects: projects.map((p: any) => {
          const totalReceived = p.receipts.reduce((sum: number, r: any) => sum + r.amount, 0);
          const totalExpenses = p.expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
          const pendingReceivable = Math.max(0, (p.projectValue || 0) - totalReceived);

          return {
            id: p.id,
            name: p.name,
            code: p.projectCode,
            contractValue: p.projectValue,
            formattedContractValue: formatINR(p.projectValue),
            totalReceived,
            formattedReceived: formatINR(totalReceived),
            pendingReceivable,
            formattedPending: formatINR(pendingReceivable),
            actualExpenses: totalExpenses,
            status: p.status,
          };
        }),
      };
    }

    // ---------------------------------------------------------
    // 6. getMaterialStock
    // ---------------------------------------------------------
    case 'getMaterialStock': {
      const where: any = {
        organizationId: ctx.organizationId,
      };

      if (args.materialName) {
        where.name = { contains: args.materialName };
      }

      const materials = await prisma.material.findMany({
        where,
        take: 15,
        include: {
          receipts: { where: { deletedAt: null }, select: { quantity: true, purchaseRate: true } },
          usages: { select: { quantity: true } },
        },
      });

      return {
        count: materials.length,
        materials: materials.map((m: any) => {
          const totalInward = m.receipts.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);
          const totalConsumed = m.usages.reduce((sum: number, u: any) => sum + (u.quantity || 0), 0);
          const stock = Math.max(0, totalInward - totalConsumed);

          return {
            name: m.name,
            unit: m.unit,
            aayaInward: totalInward,
            useHuaConsumed: totalConsumed,
            bachaStock: stock,
            minStock: m.minimumStock,
            isLowStock: stock <= (m.minimumStock || 0),
          };
        }),
      };
    }

    // ---------------------------------------------------------
    // 7. getDailyReport
    // ---------------------------------------------------------
    case 'getDailyReport': {
      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const targetDate = new Date(dateStr);
      const dayStart = getStartOfDayUTC(targetDate);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      const [attendanceCount, inAgg, outAgg, expenseAgg] = await Promise.all([
        prisma.attendance.count({
          where: { organizationId: ctx.organizationId, date: { gte: dayStart, lte: dayEnd }, status: 'PRESENT' },
        }),
        prisma.projectReceipt.aggregate({
          where: { organizationId: ctx.organizationId, date: { gte: dayStart, lte: dayEnd }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.fundTransfer.aggregate({
          where: { organizationId: ctx.organizationId, date: { gte: dayStart, lte: dayEnd }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { organizationId: ctx.organizationId, date: { gte: dayStart, lte: dayEnd }, deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

      const moneyIn = inAgg._sum.amount || 0;
      const expenses = expenseAgg._sum.amount || 0;
      const transfers = outAgg._sum.amount || 0;

      return {
        date: dateStr,
        workersPresent: attendanceCount,
        financials: {
          clientReceiptsIn: moneyIn,
          expensesOut: expenses,
          transfersOut: transfers,
          netCashFlow: moneyIn - (expenses + transfers),
          formattedNetCashFlow: formatINR(moneyIn - (expenses + transfers)),
        },
      };
    }

    // ---------------------------------------------------------
    // 8. getPendingPayments
    // ---------------------------------------------------------
    case 'getPendingPayments': {
      const projects = await prisma.project.findMany({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          projectValue: true,
          receipts: { where: { deletedAt: null }, select: { amount: true } },
        },
      });

      const pendingReceivables = projects.map((p: any) => {
        const received = p.receipts.reduce((sum: number, r: any) => sum + r.amount, 0);
        const pending = Math.max(0, (p.projectValue || 0) - received);
        return {
          projectName: p.name,
          contractValue: p.projectValue,
          received,
          pending,
          formattedPending: formatINR(pending),
        };
      }).filter((p: any) => p.pending > 0);

      const totalPendingReceivable = pendingReceivables.reduce((sum: number, p: any) => sum + p.pending, 0);

      return {
        totalPendingReceivable,
        formattedTotal: formatINR(totalPendingReceivable),
        projectsCount: pendingReceivables.length,
        pendingProjects: pendingReceivables.slice(0, 10),
      };
    }

    default:
      return { error: `Tool ${toolName} not implemented` };
  }
}
