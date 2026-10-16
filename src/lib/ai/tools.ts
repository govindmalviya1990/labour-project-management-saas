import prisma from '@/lib/db/prisma';
import { ToolExecutionContext, LlmToolDefinition } from './types';
import {
  calculateWalletBalance,
  calculateDailyCashFlow,
  calculateBankBalance,
  calculateOverallMoneyPosition,
  formatINR,
} from '@/lib/calculations';
import { computeSupplierBalance } from '@/lib/supplierBalance';
import { getStartOfDayUTC } from '@/lib/auth/day-lock';
import { normalizeRole } from '@/lib/auth/roles';
import {
  matchWorker,
  matchUser,
  matchProject,
  matchMaterial,
  matchBankAccount,
  getOrgFormOptions,
} from '@/lib/assistant/matcher';
import { DraftConfirmationPayload } from '@/lib/assistant/draft-types';

// -------------------------------------------------------------
// Read-Only Tool Declarations for LLM
// -------------------------------------------------------------

export const READ_ONLY_TOOL_DEFINITIONS: LlmToolDefinition[] = [
  {
    name: 'getAttendance',
    description: 'Get live daily worker turnout and attendance for today or a specific date, project, or site. Returns present, half day, absent counts, labour cost, and names of workers.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today).',
        },
        projectId: {
          type: 'string',
          description: 'Filter by specific project ID.',
        },
      },
    },
  },
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
    name: 'getMoneyPosition',
    description: 'Get live overall company money position: total cash across all partners, supervisor petty cash, and live balances of all company bank accounts.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getPartnerWallets',
    description: 'Get live closing cash in hand and wallet balance for all partners or a specific partner (includes opening balance, receipts, expenses, transfers, and supplier payments).',
    parameters: {
      type: 'object',
      properties: {
        partnerName: {
          type: 'string',
          description: 'Optional partner name to filter (e.g. Akshay Tak, Rajesh Thakur).',
        },
      },
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
  {
    name: 'getWorkerAdvanceList',
    description: 'Get list of all workers who currently have an outstanding advance (advance baaki hai).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getWorkerPaymentsList',
    description: 'List salary, wage, and advance payments given to workers within a date range, or paid by a specific partner/user.',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format.',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format.',
        },
        workerName: {
          type: 'string',
          description: 'Optional filter by worker name.',
        },
        fromUserName: {
          type: 'string',
          description: 'Optional filter by the partner or user who made the payment (e.g. Rajesh Thakur, Akshay Tak).',
        },
      },
    },
  },
  {
    name: 'getSupplierBalances',
    description: 'Get supplier ledger and outstanding balance for all suppliers or a specific supplier (bills, payments, returns, net balance, and aging).',
    parameters: {
      type: 'object',
      properties: {
        supplierName: {
          type: 'string',
          description: 'Optional supplier name to filter.',
        },
      },
    },
  },
  {
    name: 'getPayrollSummary',
    description: 'Get total labour cost, attendance wages, allowances, and worker earnings for a given month or date range (e.g. pichhle mahine ka labour cost).',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['THIS_MONTH', 'LAST_MONTH', 'THIS_WEEK', 'CUSTOM'],
          description: 'Time period for payroll summary.',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (for CUSTOM period).',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (for CUSTOM period).',
        },
      },
    },
  },
];

// -------------------------------------------------------------
// Write Tool Declarations (Draft-Only: Never Mutates Database)
// -------------------------------------------------------------

export const WRITE_TOOL_DEFINITIONS: LlmToolDefinition[] = [
  {
    name: 'draftFundTransfer',
    description: 'Create a draft for giving money / cash to a worker, supervisor, or partner ("Give Money"). Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        toName: {
          type: 'string',
          description: 'Name of the worker, supervisor, or partner receiving the cash (e.g. Ramesh, Sonu).',
        },
        amount: {
          type: 'number',
          description: 'Amount of money given in INR.',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today).',
        },
        purpose: {
          type: 'string',
          description: 'Purpose or reason (e.g. Dinner, Advance, Petrol, Chay-Nasta, Petty Cash, Site Daily Expenses).',
        },
        notes: {
          type: 'string',
          description: 'Optional remarks or description.',
        },
      },
      required: ['toName', 'amount'],
    },
  },
  {
    name: 'draftExpense',
    description: 'Create a draft for a daily site or operational expense ("Daily Expense"). Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category or reason (e.g. Chay-Nasta, Petrol, Dinner, Labour Food, Travel, etc.)',
        },
        amount: {
          type: 'number',
          description: 'Amount in INR.',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today).',
        },
        projectName: {
          type: 'string',
          description: 'Optional project name if expense was spent on a specific site.',
        },
        notes: {
          type: 'string',
          description: 'Optional description.',
        },
      },
      required: ['amount'],
    },
  },
  {
    name: 'draftMoneyIn',
    description: 'Create a draft for incoming client project payment ("Money In" / "Paisa Aaya"). Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'Name of the client project.',
        },
        amount: {
          type: 'number',
          description: 'Amount received in INR.',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today).',
        },
        receivedIn: {
          type: 'string',
          enum: ['WALLET', 'BANK'],
          description: 'WALLET (partner cash wallet) or BANK (bank account).',
        },
        bankName: {
          type: 'string',
          description: 'Bank account name if received in bank.',
        },
        notes: {
          type: 'string',
          description: 'Optional remarks.',
        },
      },
      required: ['amount'],
    },
  },
  {
    name: 'draftGoodsPurchase',
    description: 'Create a draft for purchasing waterproofing materials or goods ("Goods Purchase"). Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        materialName: {
          type: 'string',
          description: 'Material name (e.g. Cement, Dr Fixit PU 270i, Cipoxy, Bitumen, etc.).',
        },
        quantity: {
          type: 'number',
          description: 'Quantity of material purchased.',
        },
        unit: {
          type: 'string',
          description: 'Unit of measurement (e.g. Bag, Kg, Ltr, Drum).',
        },
        rate: {
          type: 'number',
          description: 'Rate per unit in INR.',
        },
        totalAmount: {
          type: 'number',
          description: 'Total purchase amount in INR.',
        },
        supplierName: {
          type: 'string',
          description: 'Supplier or vendor name.',
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format.',
        },
        notes: {
          type: 'string',
          description: 'Optional notes.',
        },
      },
      required: ['materialName'],
    },
  },
  {
    name: 'draftAttendance',
    description: 'Create a draft for marking worker attendance ("Attendance"). Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        records: {
          type: 'array',
          description: 'List of worker attendance records',
          items: {
            type: 'object',
            properties: {
              workerName: { type: 'string', description: 'Worker name.' },
              status: { type: 'string', enum: ['PRESENT', 'HALF_DAY', 'ABSENT'], description: 'Attendance status.' },
              overtimeHours: { type: 'number', description: 'Overtime hours if any.' },
            },
          },
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today).',
        },
        projectName: {
          type: 'string',
          description: 'Optional project name.',
        },
      },
      required: ['records'],
    },
  },
  {
    name: 'draftWork',
    description: 'Create a draft for work output / measurement record ("Work Record"). Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        workerName: { type: 'string', description: 'Worker name.' },
        projectName: { type: 'string', description: 'Project name.' },
        workItem: { type: 'string', description: 'Description of work done (e.g. 200 sqft waterproofing).' },
        quantity: { type: 'number', description: 'Quantity of work done.' },
        unit: { type: 'string', description: 'Unit (sqft, rft, etc).' },
        rate: { type: 'number', description: 'Rate per unit.' },
        totalAmount: { type: 'number', description: 'Total work amount.' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
      },
      required: ['workerName', 'workItem'],
    },
  },
  {
    name: 'draftWorkerPayment',
    description: 'Create a draft for paying salary wages or advance to a worker. Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        workerName: { type: 'string', description: 'Worker name.' },
        amount: { type: 'number', description: 'Payment amount in INR.' },
        type: { type: 'string', enum: ['SALARY', 'ADVANCE'], description: 'Payout type.' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
        notes: { type: 'string', description: 'Optional remarks.' },
      },
      required: ['workerName', 'amount'],
    },
  },
  {
    name: 'draftBankDeposit',
    description: 'Create a draft for depositing physical cash into a bank account ("Cash Bank mein Jama"). Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        bankName: { type: 'string', description: 'Bank account name.' },
        amount: { type: 'number', description: 'Amount in INR.' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
        notes: { type: 'string', description: 'Optional remarks.' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'draftBankWithdrawal',
    description: 'Create a draft for withdrawing cash from bank into partner physical wallet ("Bank se Cash Nikala"). Does NOT save to database yet.',
    parameters: {
      type: 'object',
      properties: {
        bankName: { type: 'string', description: 'Bank account name.' },
        amount: { type: 'number', description: 'Amount in INR.' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
        notes: { type: 'string', description: 'Optional remarks.' },
      },
      required: ['amount'],
    },
  },
];

export const ALL_ASSISTANT_TOOL_DEFINITIONS: LlmToolDefinition[] = [
  ...READ_ONLY_TOOL_DEFINITIONS,
  ...WRITE_TOOL_DEFINITIONS,
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
    // 0. getAttendance
    // ---------------------------------------------------------
    case 'getAttendance': {
      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const targetDate = new Date(dateStr);
      const dayStart = getStartOfDayUTC(targetDate);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      const where: any = {
        organizationId: ctx.organizationId,
        date: { gte: dayStart, lte: dayEnd },
      };
      if (args.projectId) where.projectId = args.projectId;

      const [attendanceRecords, totalWorkersCount] = await Promise.all([
        prisma.attendance.findMany({
          where,
          include: {
            worker: { select: { id: true, name: true, workerCode: true, category: true, dailyWage: true } },
            project: { select: { id: true, name: true, projectCode: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.worker.count({
          where: { organizationId: ctx.organizationId, status: 'ACTIVE', deletedAt: null },
        }),
      ]);

      const present = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
      const halfDay = attendanceRecords.filter((a) => a.status === 'HALF_DAY').length;
      const absent = attendanceRecords.filter((a) => a.status === 'ABSENT').length;
      const leave = attendanceRecords.filter((a) => a.status === 'LEAVE').length;
      const totalLabourCost = attendanceRecords.reduce((sum, a) => sum + (a.wageForDay || 0), 0);

      const workersList = attendanceRecords.map((a) => ({
        name: a.worker?.name || 'Worker',
        workerCode: a.worker?.workerCode,
        category: a.worker?.category,
        status: a.status,
        wageForDay: a.wageForDay,
        overtimeHours: a.overtimeHours,
        projectName: a.project?.name,
      }));

      return {
        date: dateStr,
        totalWorkers: totalWorkersCount,
        markedCount: attendanceRecords.length,
        present,
        halfDay,
        absent,
        leave,
        totalLabourCost,
        formattedLabourCost: formatINR(totalLabourCost),
        workersList,
      };
    }

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

      let targetUser: any = null;
      try {
        targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, name: true, email: true },
        });
      } catch (e) {
        return {
          user: ctx.userName,
          date: dateStr,
          cashInHand: 0,
          formattedCashInHand: '₹0',
          today: {
            openingBalance: 0,
            moneyIn: 0,
            moneyOut: 0,
            closingBalance: 0,
            discrepancy: 0,
            isVerified: false,
            verifiedAt: null,
          },
        };
      }

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
    // 1b. getMoneyPosition
    // ---------------------------------------------------------
    case 'getMoneyPosition': {
      if (!isOwnerOrManager && role !== 'PARTNER') {
        return { error: 'Supervisors do not have access to company money position.' };
      }

      const memberships = await prisma.organizationUser.findMany({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true, email: true, mobile: true } } },
      });

      const partnerUsers = memberships
        .filter((m: any) => ['PARTNER', 'OWNER'].includes(normalizeRole(m.role)))
        .map((m: any) => ({
          ...m.user,
          openingBalance: m.openingBalance || 0,
          role: m.role,
        }));

      const supervisorUsers = memberships
        .filter((m: any) => normalizeRole(m.role) === 'SITE_SUPERVISOR')
        .map((m: any) => ({
          ...m.user,
          openingBalance: m.openingBalance || 0,
          role: m.role,
        }));

      const partnerWallets = await Promise.all(
        partnerUsers.map(async (u: any) => {
          const [mIn, tIn, tOut, exp, bankDep, bankWith, supPay] = await Promise.all([
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
            prisma.bankTransaction.aggregate({
              where: { organizationId: ctx.organizationId, createdById: u.id, type: 'DEPOSIT', deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.bankTransaction.aggregate({
              where: { organizationId: ctx.organizationId, createdById: u.id, type: 'WITHDRAWAL', deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.supplierPayment.aggregate({
              where: { organizationId: ctx.organizationId, sourceId: u.id, sourceType: 'PARTNER', deletedAt: null },
              _sum: { amount: true },
            }),
          ]);

          const bal = calculateWalletBalance({
            openingBalance: u.openingBalance || 0,
            totalMoneyIn: mIn._sum?.amount || 0,
            totalTransfersIn: tIn._sum?.amount || 0,
            totalTransfersOut: (tOut._sum?.amount || 0) + (supPay._sum?.amount || 0),
            totalExpenses: exp._sum?.amount || 0,
            totalBankDeposits: bankDep._sum?.amount || 0,
            totalBankWithdrawals: bankWith._sum?.amount || 0,
          });

          return {
            id: u.id,
            name: u.name,
            balance: bal.balance,
          };
        })
      );

      const supervisorWallets = await Promise.all(
        supervisorUsers.map(async (u: any) => {
          const [tIn, exp, tOut] = await Promise.all([
            prisma.fundTransfer.aggregate({
              where: { organizationId: ctx.organizationId, toUserId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.expense.aggregate({
              where: { organizationId: ctx.organizationId, spentById: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.fundTransfer.aggregate({
              where: { organizationId: ctx.organizationId, fromUserId: u.id, deletedAt: null },
              _sum: { amount: true },
            }),
          ]);
          const bal = (tIn._sum.amount || 0) - (exp._sum.amount || 0) - (tOut._sum.amount || 0);
          return { id: u.id, name: u.name, balance: Math.round(bal * 100) / 100 };
        })
      );

      const bankAccounts = await prisma.bankAccount.findMany({
        where: { organizationId: ctx.organizationId, deletedAt: null },
      });

      const bankBalances = await Promise.all(
        bankAccounts.map(async (b: any) => {
          const [txs, supPays] = await Promise.all([
            prisma.bankTransaction.findMany({
              where: { bankAccountId: b.id, deletedAt: null },
              select: { type: true, amount: true },
            }),
            prisma.supplierPayment.aggregate({
              where: { organizationId: ctx.organizationId, sourceId: b.id, sourceType: 'BANK', deletedAt: null },
              _sum: { amount: true },
            }),
          ]);

          let totalInflow = 0;
          let totalOutflow = (supPays._sum?.amount || 0);

          for (const t of txs) {
            if (['DEPOSIT', 'RECEIPT', 'TRANSFER_IN'].includes(t.type)) {
              totalInflow += t.amount;
            } else {
              totalOutflow += t.amount;
            }
          }

          const balance = Math.round((Number(b.openingBalance || 0) + totalInflow - totalOutflow) * 100) / 100;
          return {
            id: b.id,
            name: b.name,
            bankName: b.bankName,
            accountLast4: b.accountLast4,
            balance,
          };
        })
      );

      const moneyPos = calculateOverallMoneyPosition({
        partnerWallets,
        supervisorWallets,
        bankBalances,
      });

      return {
        totalMoney: moneyPos.totalMoney,
        formattedTotalMoney: formatINR(moneyPos.totalMoney),
        totalPartnersCash: moneyPos.totalPartnersCash,
        formattedPartnersCash: formatINR(moneyPos.totalPartnersCash),
        totalSupervisorsCash: moneyPos.totalSupervisorsCash,
        formattedSupervisorsCash: formatINR(moneyPos.totalSupervisorsCash),
        totalBankBalance: moneyPos.totalBankBalance,
        formattedBankBalance: formatINR(moneyPos.totalBankBalance),
        partnerWallets: moneyPos.breakdown.partnerWallets.map((p) => ({
          name: p.name,
          balance: p.balance,
          formattedBalance: formatINR(p.balance),
        })),
        bankBalances: moneyPos.breakdown.bankBalances.map((b) => ({
          name: b.name,
          bankName: b.bankName,
          balance: b.balance,
          formattedBalance: formatINR(b.balance),
        })),
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

      let partnerUsers = memberships
        .filter((m: any) => ['PARTNER', 'OWNER'].includes(normalizeRole(m.role)))
        .map((m: any) => ({
          ...m.user,
          openingBalance: m.openingBalance || 0,
          role: m.role,
        }));

      if (args.partnerName) {
        const qName = String(args.partnerName).toLowerCase().trim();
        const filtered = partnerUsers.filter((u: any) => u.name.toLowerCase().includes(qName));
        if (filtered.length > 0) {
          partnerUsers = filtered;
        }
      }

      const summaries = await Promise.all(
        partnerUsers.map(async (u: any) => {
          const [mIn, tIn, tOut, exp, bankDep, bankWith, supPay] = await Promise.all([
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
            prisma.bankTransaction.aggregate({
              where: { organizationId: ctx.organizationId, createdById: u.id, type: 'DEPOSIT', deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.bankTransaction.aggregate({
              where: { organizationId: ctx.organizationId, createdById: u.id, type: 'WITHDRAWAL', deletedAt: null },
              _sum: { amount: true },
            }),
            prisma.supplierPayment.aggregate({
              where: { organizationId: ctx.organizationId, sourceId: u.id, sourceType: 'PARTNER', deletedAt: null },
              _sum: { amount: true },
            }),
          ]);

          const bal = calculateWalletBalance({
            openingBalance: u.openingBalance || 0,
            totalMoneyIn: mIn._sum?.amount || 0,
            totalTransfersIn: tIn._sum?.amount || 0,
            totalTransfersOut: (tOut._sum?.amount || 0) + (supPay._sum?.amount || 0),
            totalExpenses: exp._sum?.amount || 0,
            totalBankDeposits: bankDep._sum?.amount || 0,
            totalBankWithdrawals: bankWith._sum?.amount || 0,
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
      if (role === 'PARTNER' || role === 'SITE_SUPERVISOR' || role === 'ACCOUNTANT') {
        where.OR = [
          { walletOwnerId: ctx.userId },
          { spentById: ctx.userId },
        ];
      }

      if (args.category) {
        where.category = { contains: args.category, mode: 'insensitive' };
      }
      if (args.projectId) {
        where.projectId = args.projectId;
      }
      if (args.startDate || args.endDate) {
        where.date = {};
        if (args.startDate) where.date.gte = new Date(args.startDate);
        if (args.endDate) where.date.lte = new Date(args.endDate);
      }

      const [totalAgg, categoryGroups, recentExpenses] = await Promise.all([
        prisma.expense.aggregate({
          where,
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.expense.groupBy({
          by: ['category'],
          where,
          _sum: { amount: true },
          _count: { id: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 10,
        }),
        prisma.expense.findMany({
          where,
          take: 20,
          orderBy: { date: 'desc' },
          include: {
            project: { select: { name: true } },
            spentBy: { select: { name: true } },
          },
        }),
      ]);

      const totalAmount = totalAgg._sum.amount || 0;
      const totalCount = totalAgg._count.id || 0;

      const topCategories = categoryGroups.map((cg: any) => ({
        category: cg.category || 'General',
        amount: cg._sum.amount || 0,
        formattedAmount: formatINR(cg._sum.amount || 0),
        count: cg._count.id,
      }));

      return {
        count: totalCount,
        totalAmount,
        formattedTotal: formatINR(totalAmount),
        topCategories,
        breakdown: topCategories,
        expenses: recentExpenses.map((e: any) => ({
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
        // Try fuzzy matching first
        const matchRes = await matchWorker(args.workerName, ctx.organizationId);
        if (matchRes.match) {
          worker = await prisma.worker.findFirst({
            where: { id: matchRes.match.id, organizationId: ctx.organizationId },
          });
        } else {
          worker = await prisma.worker.findFirst({
            where: {
              organizationId: ctx.organizationId,
              deletedAt: null,
              OR: [
                { name: { contains: args.workerName, mode: 'insensitive' } },
                { workerCode: { contains: args.workerName, mode: 'insensitive' } },
              ],
            },
          });
        }
      }

      if (!worker) {
        return { error: `No worker found matching "${args.workerName || args.workerId || ''}"` };
      }

      // Fetch live attendance earnings, piece-rate work, salary records, allowances, and payments/transfers
      const [attendanceRecords, salaryRecordsAgg, allowancesAgg, paymentsAgg, fundTransfersAgg, workRecordsAgg] = await Promise.all([
        prisma.attendance.findMany({
          where: { organizationId: ctx.organizationId, workerId: worker.id },
          select: { status: true, wageForDay: true },
        }),
        prisma.salaryRecord.aggregate({
          where: { organizationId: ctx.organizationId, workerId: worker.id },
          _sum: { netPayable: true, totalGrossSalary: true },
        }),
        prisma.allowance.aggregate({
          where: { organizationId: ctx.organizationId, workerId: worker.id, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { organizationId: ctx.organizationId, workerId: worker.id, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.fundTransfer.aggregate({
          where: { organizationId: ctx.organizationId, toWorkerId: worker.id, deletedAt: null, linkedPaymentId: null },
          _sum: { amount: true },
        }),
        prisma.workRecord.aggregate({
          where: { organizationId: ctx.organizationId, workerId: worker.id },
          _sum: { totalWorkValue: true },
        }),
      ]);

      const attendanceEarned = attendanceRecords.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
      const pieceRateEarned = workRecordsAgg._sum.totalWorkValue || 0;
      const salaryEarned = (salaryRecordsAgg._sum?.netPayable ?? salaryRecordsAgg._sum?.totalGrossSalary) || 0;
      const earnedBase = Math.max(attendanceEarned + pieceRateEarned, salaryEarned);
      const totalAllowances = allowancesAgg._sum?.amount || 0;
      const opBal = (worker as any).openingBalance || 0;

      const totalCredits = Math.max(0, opBal) + earnedBase + totalAllowances;
      const directPaid = paymentsAgg._sum.amount || 0;
      const transferPaid = fundTransfersAgg._sum.amount || 0;
      const totalDebits = Math.abs(Math.min(0, opBal)) + directPaid + transferPaid;
      const remainingDues = Math.round((totalCredits - totalDebits) * 100) / 100;

      const presentDays = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
      const halfDays = attendanceRecords.filter((a) => a.status === 'HALF_DAY').length;
      const absentDays = attendanceRecords.filter((a) => a.status === 'ABSENT').length;

      return {
        workerId: worker.id,
        name: worker.name,
        workerCode: worker.workerCode,
        category: worker.category,
        dailyWage: worker.dailyWage,
        openingBalance: opBal,
        presentDays,
        halfDays,
        absentDays,
        totalEarned: earnedBase + totalAllowances,
        totalPaid: directPaid + transferPaid,
        pendingDues: remainingDues,
        formattedPendingDues: formatINR(remainingDues),
        status: remainingDues < 0 ? 'ADVANCE' : remainingDues === 0 ? 'FULLY_PAID' : 'PENDING_DUES',
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
        where.name = { contains: args.projectName, mode: 'insensitive' };
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
        where.name = { contains: args.materialName, mode: 'insensitive' };
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

    // ---------------------------------------------------------
    // 8b. getWorkerAdvanceList
    // ---------------------------------------------------------
    case 'getWorkerAdvanceList': {
      const workers = await prisma.worker.findMany({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE', deletedAt: null },
        select: {
          id: true,
          name: true,
          workerCode: true,
          category: true,
          dailyWage: true,
          mobile: true,
        },
        orderBy: { name: 'asc' },
      });

      const workersWithAdvance: any[] = [];
      for (const w of workers) {
        const [att, allow, pay, fTrans] = await Promise.all([
          prisma.attendance.aggregate({
            where: { organizationId: ctx.organizationId, workerId: w.id },
            _sum: { wageForDay: true },
          }),
          prisma.allowance.aggregate({
            where: { organizationId: ctx.organizationId, workerId: w.id, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.payment.aggregate({
            where: { organizationId: ctx.organizationId, workerId: w.id, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.fundTransfer.aggregate({
            where: { organizationId: ctx.organizationId, toWorkerId: w.id, deletedAt: null, linkedPaymentId: null },
            _sum: { amount: true },
          }),
        ]);

        const opBal = (w as any).openingBalance || 0;
        const totalEarned = (att._sum?.wageForDay || 0) + (allow._sum?.amount || 0);
        const totalPaid = (pay._sum?.amount || 0) + (fTrans._sum?.amount || 0);
        const credits = Math.max(0, opBal) + totalEarned;
        const debits = Math.abs(Math.min(0, opBal)) + totalPaid;
        const netPayable = credits - debits;

        if (netPayable < 0) {
          workersWithAdvance.push({
            id: w.id,
            name: w.name,
            workerCode: w.workerCode,
            category: w.category,
            mobile: w.mobile,
            advanceAmount: Math.abs(netPayable),
            formattedAdvance: formatINR(Math.abs(netPayable)),
          });
        }
      }

      const totalAdvanceDue = workersWithAdvance.reduce((sum, w) => sum + w.advanceAmount, 0);

      return {
        count: workersWithAdvance.length,
        totalAdvanceDue,
        formattedTotalAdvance: formatINR(totalAdvanceDue),
        workers: workersWithAdvance,
      };
    }

    // ---------------------------------------------------------
    // 8c. getWorkerPaymentsList
    // ---------------------------------------------------------
    case 'getWorkerPaymentsList': {
      const wherePayment: any = { organizationId: ctx.organizationId, deletedAt: null };
      const whereTransfer: any = { organizationId: ctx.organizationId, toWorkerId: { not: null }, deletedAt: null };

      if (args.startDate || args.endDate) {
        wherePayment.date = {};
        whereTransfer.date = {};
        if (args.startDate) {
          wherePayment.date.gte = new Date(args.startDate);
          whereTransfer.date.gte = new Date(args.startDate);
        }
        if (args.endDate) {
          wherePayment.date.lte = new Date(args.endDate);
          whereTransfer.date.lte = new Date(args.endDate);
        }
      }

      if (args.fromUserName) {
        const userMatch = await prisma.user.findFirst({
          where: { name: { contains: args.fromUserName, mode: 'insensitive' } },
        });
        if (userMatch) {
          whereTransfer.fromUserId = userMatch.id;
        }
      }

      const [payments, transfers] = await Promise.all([
        prisma.payment.findMany({
          where: wherePayment,
          include: {
            worker: { select: { id: true, name: true, category: true } },
          },
          orderBy: { date: 'desc' },
          take: 50,
        }),
        prisma.fundTransfer.findMany({
          where: whereTransfer,
          include: {
            toWorker: { select: { id: true, name: true, category: true } },
            fromUser: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
          take: 50,
        }),
      ]);

      const items = [
        ...payments.map((p: any) => ({
          id: p.id,
          date: p.date.toISOString().split('T')[0],
          amount: p.amount,
          formattedAmount: formatINR(p.amount),
          workerName: p.worker?.name || 'Worker',
          type: p.transactionType || 'SALARY',
          paidBy: 'Company',
          method: p.paymentMethod || 'CASH',
        })),
        ...transfers.filter((t: any) => !t.linkedPaymentId).map((t: any) => ({
          id: t.id,
          date: t.date.toISOString().split('T')[0],
          amount: t.amount,
          formattedAmount: formatINR(t.amount),
          workerName: t.toWorker?.name || 'Worker',
          type: t.purpose || 'TRANSFER',
          paidBy: t.fromUser?.name || 'Partner',
          method: 'CASH',
        })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1));

      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

      return {
        count: items.length,
        totalAmount,
        formattedTotal: formatINR(totalAmount),
        payments: items.slice(0, 30),
      };
    }

    // ---------------------------------------------------------
    // 8d. getSupplierBalances
    // ---------------------------------------------------------
    case 'getSupplierBalances': {
      const where: any = { organizationId: ctx.organizationId, deletedAt: null };
      if (args.supplierName) {
        where.name = { contains: args.supplierName, mode: 'insensitive' };
      }

      const suppliers = await prisma.supplier.findMany({
        where,
        include: {
          purchaseBills: { where: { deletedAt: null }, select: { id: true, totalAmount: true, billDate: true, billNumber: true } },
          supplierPayments: { where: { deletedAt: null }, select: { id: true, amount: true, date: true, billId: true } },
          purchaseReturns: { where: { deletedAt: null }, select: { id: true, amount: true, returnDate: true, billId: true } },
        },
        orderBy: { name: 'asc' },
      });

      const supplierList = suppliers.map((s: any) => {
        const billsTotal = s.purchaseBills.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
        const paymentsTotal = s.supplierPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const returnsTotal = s.purchaseReturns.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

        const bal = computeSupplierBalance({
          openingBalance: s.openingBalance,
          billsTotal,
          paymentsTotal,
          returnsTotal,
        });

        return {
          id: s.id,
          name: s.name,
          mobile: s.mobile,
          openingBalance: s.openingBalance,
          totalPurchases: bal.netPurchases,
          totalPaid: bal.totalPayments,
          remainingBalance: bal.remainingBalance,
          formattedBalance: formatINR(bal.remainingBalance),
          status: bal.status,
        };
      });

      const totalPayableDues = supplierList
        .filter((s: any) => s.remainingBalance > 0)
        .reduce((sum: number, s: any) => sum + s.remainingBalance, 0);

      const totalAdvanceWithSuppliers = supplierList
        .filter((s: any) => s.remainingBalance < 0)
        .reduce((sum: number, s: any) => sum + Math.abs(s.remainingBalance), 0);

      return {
        totalSuppliers: supplierList.length,
        totalPayableDues,
        formattedPayableDues: formatINR(totalPayableDues),
        totalAdvanceWithSuppliers,
        formattedAdvanceWithSuppliers: formatINR(totalAdvanceWithSuppliers),
        suppliers: supplierList,
      };
    }

    // ---------------------------------------------------------
    // 8e. getPayrollSummary
    // ---------------------------------------------------------
    case 'getPayrollSummary': {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;
      let periodLabel = args.period || 'THIS_MONTH';

      if (args.period === 'LAST_MONTH') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        periodLabel = 'Pichhla Mahina (Last Month)';
      } else if (args.period === 'THIS_WEEK') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        periodLabel = 'Is Hafte (This Week)';
      } else if (args.startDate || args.endDate) {
        startDate = args.startDate ? new Date(args.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = args.endDate ? new Date(args.endDate) : new Date();
        periodLabel = 'Custom Range';
      } else {
        // THIS_MONTH
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        periodLabel = 'Is Mahine (This Month)';
      }

      const [attAgg, allowAgg, workAgg] = await Promise.all([
        prisma.attendance.aggregate({
          where: { organizationId: ctx.organizationId, date: { gte: startDate, lte: endDate } },
          _sum: { wageForDay: true },
          _count: { id: true },
        }),
        prisma.allowance.aggregate({
          where: { organizationId: ctx.organizationId, date: { gte: startDate, lte: endDate }, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.workRecord.aggregate({
          where: { organizationId: ctx.organizationId, date: { gte: startDate, lte: endDate } },
          _sum: { totalWorkValue: true },
        }),
      ]);

      const attWages = attAgg._sum.wageForDay || 0;
      const allowWages = allowAgg._sum.amount || 0;
      const pieceRateWages = workAgg._sum.totalWorkValue || 0;
      const totalLabourCost = attWages + allowWages + pieceRateWages;

      return {
        period: periodLabel,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        totalLabourCost,
        formattedLabourCost: formatINR(totalLabourCost),
        attendanceWages: attWages,
        formattedAttendanceWages: formatINR(attWages),
        allowanceWages: allowWages,
        formattedAllowanceWages: formatINR(allowWages),
        pieceRateWages,
        formattedPieceRateWages: formatINR(pieceRateWages),
        attendanceEntriesCount: attAgg._count.id,
      };
    }

    // ---------------------------------------------------------
    // 9. draftFundTransfer (Give Money: Partner to Worker/User)
    // ---------------------------------------------------------
    case 'draftFundTransfer': {
      const amount = Number(args.amount);
      if (!amount || amount <= 0) {
        return { error: 'Kitna amount transfer karna hai? Kripya amount batayein.' };
      }

      const toName = args.toName ? String(args.toName).trim() : '';
      if (!toName) {
        return { error: 'Kisko paisa dena hai? Kripya naam batayein (worker, supervisor ya partner).' };
      }

      const workerMatch = await matchWorker(toName, ctx.organizationId);
      let receiverId: string | undefined;
      let receiverName = toName;
      let receiverType: 'WORKER' | 'USER' = 'WORKER';

      if (workerMatch.status === 'AMBIGUOUS') {
        return {
          isAmbiguous: true,
          field: 'toName',
          message: `Mujhe "${toName}" naam ke ek se zyada worker mile. Kripya sahi worker chunein:`,
          options: workerMatch.options,
        };
      } else if (workerMatch.status === 'EXACT' && workerMatch.match) {
        receiverId = workerMatch.match.id;
        receiverName = workerMatch.match.name;
        receiverType = 'WORKER';
      } else {
        const userMatch = await matchUser(toName, ctx.organizationId);
        if (userMatch.status === 'AMBIGUOUS') {
          return {
            isAmbiguous: true,
            field: 'toName',
            message: `Mujhe "${toName}" naam ke ek se zyada team members mile:`,
            options: userMatch.options,
          };
        } else if (userMatch.status === 'EXACT' && userMatch.match) {
          receiverId = userMatch.match.id;
          receiverName = userMatch.match.name;
          receiverType = 'USER';
        } else {
          return {
            error: `"${toName}" naam ka koi worker ya partner nahi mila. Kripya sahi naam batayein.`,
          };
        }
      }

      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const purpose = args.purpose || 'Site Daily Expenses & Petty Cash';
      const options = await getOrgFormOptions(ctx.organizationId);

      const draft: DraftConfirmationPayload = {
        draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        draftType: 'FUND_TRANSFER',
        title: 'Give Money Draft (Paisa Diya)',
        badgeText: 'Draft - Not Saved',
        status: 'PENDING',
        senderUserId: ctx.userId,
        senderUserName: ctx.userName,
        date: dateStr,
        amount,
        receiverId,
        receiverName,
        receiverType,
        purpose,
        notes: args.notes || '',
        options,
      };

      return {
        status: 'DRAFT_CREATED',
        message: `${receiverName} ko ₹${amount} (${purpose}) dene ka draft taiyaar hai. Kripya neeche card me verify karke Save karein.`,
        card: {
          type: 'CONFIRMATION',
          title: 'Give Money Confirmation',
          draft,
        },
      };
    }

    // ---------------------------------------------------------
    // 10. draftExpense (Daily Site or Operational Expense)
    // ---------------------------------------------------------
    case 'draftExpense': {
      const amount = Number(args.amount);
      if (!amount || amount <= 0) {
        return { error: 'Kharch ka amount batayein (e.g. ₹300).' };
      }

      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const category = args.category || 'Site Expense';
      let projectId: string | undefined;
      let projectName: string | undefined;

      if (args.projectName) {
        const pMatch = await matchProject(args.projectName, ctx.organizationId);
        if (pMatch.status === 'AMBIGUOUS') {
          return {
            isAmbiguous: true,
            field: 'projectName',
            message: `Mujhe "${args.projectName}" se milte-julte multiple projects mile. Kripya project chunein:`,
            options: pMatch.options,
          };
        } else if (pMatch.status === 'EXACT' && pMatch.match) {
          projectId = pMatch.match.id;
          projectName = pMatch.match.name;
        }
      }

      const options = await getOrgFormOptions(ctx.organizationId);
      const draft: DraftConfirmationPayload = {
        draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        draftType: 'EXPENSE',
        title: 'Daily Expense Draft (Kharch)',
        badgeText: 'Draft - Not Saved',
        status: 'PENDING',
        senderUserId: ctx.userId,
        senderUserName: ctx.userName,
        date: dateStr,
        amount,
        purpose: category,
        projectId,
        projectName,
        notes: args.notes || '',
        options,
      };

      return {
        status: 'DRAFT_CREATED',
        message: `₹${amount} (${category}) kharch ka draft taiyaar hai. Kripya neeche card me check karke Save karein.`,
        card: {
          type: 'CONFIRMATION',
          title: 'Expense Confirmation',
          draft,
        },
      };
    }

    // ---------------------------------------------------------
    // 11. draftMoneyIn (Client Received Payment)
    // ---------------------------------------------------------
    case 'draftMoneyIn': {
      const amount = Number(args.amount);
      if (!amount || amount <= 0) {
        return { error: 'Paisa aaya (Money In) ka amount batayein.' };
      }

      let projectId: string | undefined;
      let projectName = args.projectName || '';
      if (args.projectName) {
        const pMatch = await matchProject(args.projectName, ctx.organizationId);
        if (pMatch.status === 'AMBIGUOUS') {
          return {
            isAmbiguous: true,
            field: 'projectName',
            message: `Mujhe ek se zyada project mile. Kripya sahi project chunein:`,
            options: pMatch.options,
          };
        } else if (pMatch.status === 'EXACT' && pMatch.match) {
          projectId = pMatch.match.id;
          projectName = pMatch.match.name;
        }
      }

      const receivedIn = args.receivedIn === 'BANK' ? 'BANK' : 'WALLET';
      let bankAccountId: string | undefined;
      let bankAccountName: string | undefined;

      if (receivedIn === 'BANK' && args.bankName) {
        const bMatch = await matchBankAccount(args.bankName, ctx.organizationId);
        if (bMatch.status === 'EXACT' && bMatch.match) {
          bankAccountId = bMatch.match.id;
          bankAccountName = `${bMatch.match.bankName} - ${bMatch.match.name}`;
        }
      }

      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const options = await getOrgFormOptions(ctx.organizationId);

      const draft: DraftConfirmationPayload = {
        draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        draftType: 'MONEY_IN',
        title: 'Money In Draft (Client se Paisa Aaya)',
        badgeText: 'Draft - Not Saved',
        status: 'PENDING',
        senderUserId: ctx.userId,
        senderUserName: ctx.userName,
        date: dateStr,
        amount,
        projectId,
        projectName,
        receivedIn,
        bankAccountId,
        bankAccountName,
        notes: args.notes || '',
        options,
      };

      return {
        status: 'DRAFT_CREATED',
        message: `₹${amount} Money In entry ka draft ban gaya hai (${receivedIn === 'BANK' ? 'Bank Account' : 'Partner Cash Wallet'}).`,
        card: {
          type: 'CONFIRMATION',
          title: 'Money In Confirmation',
          draft,
        },
      };
    }

    // ---------------------------------------------------------
    // 12. draftGoodsPurchase (Materials Purchase)
    // ---------------------------------------------------------
    case 'draftGoodsPurchase': {
      const materialName = args.materialName ? String(args.materialName).trim() : 'Material';
      const qty = Number(args.quantity) || 1;
      const rate = Number(args.rate) || 0;
      const totalAmount = Number(args.totalAmount) || (qty * rate) || 0;

      let materialId: string | undefined;
      const matMatch = await matchMaterial(materialName, ctx.organizationId);
      if (matMatch.status === 'EXACT' && matMatch.match) {
        materialId = matMatch.match.id;
      }

      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const options = await getOrgFormOptions(ctx.organizationId);

      const draft: DraftConfirmationPayload = {
        draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        draftType: 'GOODS_PURCHASE',
        title: 'Goods Purchase Draft (Material Kharida)',
        badgeText: 'Draft - Not Saved',
        status: 'PENDING',
        senderUserId: ctx.userId,
        senderUserName: ctx.userName,
        date: dateStr,
        amount: totalAmount,
        materialId,
        materialName,
        quantity: qty,
        unit: args.unit || matMatch.match?.unit || 'Bag',
        rate: rate || (totalAmount > 0 && qty > 0 ? totalAmount / qty : 0),
        supplierName: args.supplierName || 'Cash Purchase',
        notes: args.notes || '',
        options,
      };

      return {
        status: 'DRAFT_CREATED',
        message: `${qty} ${draft.unit} ${materialName} (₹${totalAmount}) ka Goods Purchase draft taiyaar hai.`,
        card: {
          type: 'CONFIRMATION',
          title: 'Goods Purchase Confirmation',
          draft,
        },
      };
    }

    // ---------------------------------------------------------
    // 13. draftAttendance (Worker Daily Attendance)
    // ---------------------------------------------------------
    case 'draftAttendance': {
      const records = Array.isArray(args.records) ? args.records : [];
      if (records.length === 0) {
        return { error: 'Attendance ke liye workers ke naam batayein (e.g. Ramesh present, Suresh half day).' };
      }

      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const mappedRecords = [];
      for (const r of records) {
        const wMatch = await matchWorker(r.workerName, ctx.organizationId);
        mappedRecords.push({
          workerId: wMatch.match?.id,
          workerName: wMatch.match?.name || r.workerName,
          status: (r.status as 'PRESENT' | 'HALF_DAY' | 'ABSENT') || 'PRESENT',
          overtimeHours: Number(r.overtimeHours) || 0,
        });
      }

      const options = await getOrgFormOptions(ctx.organizationId);
      const draft: DraftConfirmationPayload = {
        draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        draftType: 'ATTENDANCE',
        title: 'Attendance Draft (Haziri)',
        badgeText: 'Draft - Not Saved',
        status: 'PENDING',
        senderUserId: ctx.userId,
        senderUserName: ctx.userName,
        date: dateStr,
        attendanceRecords: mappedRecords,
        options,
      };

      return {
        status: 'DRAFT_CREATED',
        message: `${mappedRecords.length} workers ki attendance ka draft ban gaya hai.`,
        card: {
          type: 'CONFIRMATION',
          title: 'Attendance Confirmation',
          draft,
        },
      };
    }

    // ---------------------------------------------------------
    // 14. draftWork (Work Done / Measurement Record)
    // ---------------------------------------------------------
    case 'draftWork': {
      const wName = args.workerName ? String(args.workerName).trim() : '';
      const wMatch = await matchWorker(wName, ctx.organizationId);
      if (wMatch.status === 'AMBIGUOUS') {
        return {
          isAmbiguous: true,
          field: 'workerName',
          message: `Mujhe "${wName}" naam ke ek se zyada worker mile:`,
          options: wMatch.options,
        };
      }

      const qty = Number(args.quantity) || 1;
      const rate = Number(args.rate) || 0;
      const totalAmount = Number(args.totalAmount) || (qty * rate) || 0;
      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const options = await getOrgFormOptions(ctx.organizationId);

      const draft: DraftConfirmationPayload = {
        draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        draftType: 'WORK_RECORD',
        title: 'Work Record Draft (Kaam ka Hisaab)',
        badgeText: 'Draft - Not Saved',
        status: 'PENDING',
        senderUserId: ctx.userId,
        senderUserName: ctx.userName,
        date: dateStr,
        amount: totalAmount,
        receiverId: wMatch.match?.id,
        receiverName: wMatch.match?.name || wName,
        workItem: args.workItem || 'Waterproofing Work',
        quantity: qty,
        unit: args.unit || 'sqft',
        rate: rate || (totalAmount > 0 && qty > 0 ? totalAmount / qty : 0),
        notes: args.notes || '',
        options,
      };

      return {
        status: 'DRAFT_CREATED',
        message: `${draft.receiverName} ke kaam (${qty} ${draft.unit}) ka draft taiyaar hai.`,
        card: {
          type: 'CONFIRMATION',
          title: 'Work Record Confirmation',
          draft,
        },
      };
    }

    // ---------------------------------------------------------
    // 15. draftWorkerPayment (Khata / Salary Payout)
    // ---------------------------------------------------------
    case 'draftWorkerPayment': {
      const amount = Number(args.amount);
      if (!amount || amount <= 0) {
        return { error: 'Payment ka amount batayein.' };
      }

      const wName = args.workerName ? String(args.workerName).trim() : '';
      const wMatch = await matchWorker(wName, ctx.organizationId);
      if (wMatch.status === 'AMBIGUOUS') {
        return {
          isAmbiguous: true,
          field: 'workerName',
          message: `Mujhe "${wName}" naam ke ek se zyada worker mile:`,
          options: wMatch.options,
        };
      }

      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const options = await getOrgFormOptions(ctx.organizationId);

      const draft: DraftConfirmationPayload = {
        draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        draftType: 'WORKER_PAYMENT',
        title: 'Worker Payment Draft (Khata Payout)',
        badgeText: 'Draft - Not Saved',
        status: 'PENDING',
        senderUserId: ctx.userId,
        senderUserName: ctx.userName,
        date: dateStr,
        amount,
        receiverId: wMatch.match?.id,
        receiverName: wMatch.match?.name || wName,
        purpose: args.type === 'ADVANCE' ? 'Worker Advance' : 'Salary Payout',
        notes: args.notes || '',
        options,
      };

      return {
        status: 'DRAFT_CREATED',
        message: `${draft.receiverName} ko ₹${amount} (${draft.purpose}) dene ka draft taiyaar hai.`,
        card: {
          type: 'CONFIRMATION',
          title: 'Worker Payment Confirmation',
          draft,
        },
      };
    }

    // ---------------------------------------------------------
    // 16. draftBankDeposit & draftBankWithdrawal
    // ---------------------------------------------------------
    case 'draftBankDeposit':
    case 'draftBankWithdrawal': {
      const amount = Number(args.amount);
      if (!amount || amount <= 0) {
        return { error: 'Bank transfer ka amount batayein.' };
      }

      const isWithdrawal = toolName === 'draftBankWithdrawal';
      let bankAccountId: string | undefined;
      let bankAccountName = args.bankName || 'Company Bank Account';

      if (args.bankName) {
        const bMatch = await matchBankAccount(args.bankName, ctx.organizationId);
        if (bMatch.status === 'EXACT' && bMatch.match) {
          bankAccountId = bMatch.match.id;
          bankAccountName = `${bMatch.match.bankName} - ${bMatch.match.name}`;
        }
      }

      const dateStr = args.date || new Date().toISOString().split('T')[0];
      const options = await getOrgFormOptions(ctx.organizationId);

      const draft: DraftConfirmationPayload = {
        draftId: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        draftType: isWithdrawal ? 'BANK_WITHDRAWAL' : 'BANK_DEPOSIT',
        title: isWithdrawal ? 'Bank se Cash Nikala Draft' : 'Cash Bank mein Jama Draft',
        badgeText: 'Draft - Not Saved',
        status: 'PENDING',
        senderUserId: ctx.userId,
        senderUserName: ctx.userName,
        date: dateStr,
        amount,
        bankAccountId,
        bankAccountName,
        purpose: isWithdrawal ? 'Bank se Cash Nikala' : 'Cash Bank mein Jama',
        notes: args.notes || '',
        options,
      };

      return {
        status: 'DRAFT_CREATED',
        message: isWithdrawal
          ? `Bank se ₹${amount} cash nikalne ka draft taiyaar hai.`
          : `Bank me ₹${amount} cash jama karne ka draft taiyaar hai.`,
        card: {
          type: 'CONFIRMATION',
          title: draft.title,
          draft,
        },
      };
    }

    default:
      return { error: `Tool ${toolName} not implemented` };
  }
}
