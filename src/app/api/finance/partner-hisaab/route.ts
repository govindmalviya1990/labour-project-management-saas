import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { calculateWalletBalance, calculateBankBalance } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

const CATEGORY_COLORS: Record<string, string> = {
  GOODS_PURCHASE: '#3b82f6', // blue
  CHAY_NASTA: '#f59e0b', // amber
  TRAVEL_PETROL: '#ef4444', // red
  LABOUR_FOOD: '#10b981', // emerald
  GROCERY_WORKER: '#06b6d4', // cyan
  GROCERY_SELF: '#8b5cf6', // purple
  PERSONAL: '#ec4899', // pink
  EQUIPMENT_TOOLS: '#6366f1', // indigo
  RENT: '#14b8a6', // teal
  MOBILE_RECHARGE: '#0284c7', // light blue
  MISCELLANEOUS: '#64748b', // slate
  OTHER: '#94a3b8', // light slate
  MATERIAL: '#3b82f6',
  FUEL: '#ef4444',
  ELECTRICITY: '#f97316',
  LABOUR: '#10b981',
};

const COLOR_PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#84cc16', '#a855f7', '#64748b', '#0ea5e9', '#d946ef', '#eab308'
];

function formatCategoryLabel(cat: string): string {
  if (!cat) return 'Miscellaneous';
  const mapping: Record<string, string> = {
    GOODS_PURCHASE: 'Goods Purchase',
    CHAY_NASTA: 'Chay-Nasta',
    TRAVEL_PETROL: 'Petrol & Travel',
    LABOUR_FOOD: 'Labour Food',
    GROCERY_WORKER: 'Worker Grocery',
    GROCERY_SELF: 'Self Grocery',
    PERSONAL: 'Self / Personal',
    EQUIPMENT_TOOLS: 'Equipment / Tools',
    RENT: 'Rent',
    MOBILE_RECHARGE: 'Mobile Recharge',
    MISCELLANEOUS: 'Miscellaneous',
    OTHER: 'Other',
    MATERIAL: 'Material',
    FUEL: 'Fuel',
    ELECTRICITY: 'Electricity',
    LABOUR: 'Labour Wages',
  };
  if (mapping[cat.toUpperCase()]) return mapping[cat.toUpperCase()];
  if (mapping[cat]) return mapping[cat];
  return cat.replace(/_/g, ' ');
}

function getCategoryColor(categoryKey: string, index: number): string {
  const upper = (categoryKey || '').toUpperCase();
  if (CATEGORY_COLORS[upper]) return CATEGORY_COLORS[upper];
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function buildCategoryBreakdown(expensesList: Array<{ category: string; amount: number }>) {
  const total = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0);
  const grouped: Record<string, { category: string; label: string; amount: number; count: number }> = {};

  for (const e of expensesList) {
    const rawCat = (e.category || 'MISCELLANEOUS').trim();
    if (!grouped[rawCat]) {
      grouped[rawCat] = {
        category: rawCat,
        label: formatCategoryLabel(rawCat),
        amount: 0,
        count: 0,
      };
    }
    grouped[rawCat].amount += e.amount || 0;
    grouped[rawCat].count += 1;
  }

  const sorted = Object.values(grouped).sort((a, b) => b.amount - a.amount);

  return {
    total,
    categories: sorted.map((item, idx) => ({
      ...item,
      percentage: total > 0 ? Number(((item.amount / total) * 100).toFixed(1)) : 0,
      color: getCategoryColor(item.category, idx),
    })),
  };
}

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'ACCOUNTANT',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const userRole = normalizeRole(session.role);

    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId') || 'ALL';
    const period = searchParams.get('period') || 'all';
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');

    // 1. Calculate Date Range Filters
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    const now = new Date();
    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'weekly') {
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diffToMonday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'custom') {
      if (customStartDate) {
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
      }
      if (customEndDate) {
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;
    const hasDateFilter = startDate !== null || endDate !== null;

    // 2. Fetch all Partners & Owners in Organization
    const memberships = await prisma.organizationUser.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const partnerMembers = memberships.filter((m) =>
      ['PARTNER', 'OWNER', 'MANAGER'].includes(normalizeRole(m.role))
    );

    // 3. Fetch all expenses in organization for category breakdown
    const orgPeriodExpensesWhere: any = {
      organizationId: orgId,
      deletedAt: null,
    };
    if (hasDateFilter) {
      orgPeriodExpensesWhere.date = dateFilter;
    }

    const allPeriodExpenses = await prisma.expense.findMany({
      where: orgPeriodExpensesWhere,
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        walletOwnerId: true,
        spentById: true,
      },
    });

    const overallExpensesBreakdown = buildCategoryBreakdown(allPeriodExpenses);

    // 4. For each partner/owner, compute live balance and period metrics
    const partnersSummary = await Promise.all(
      partnerMembers.map(async (m) => {
        const uId = m.userId;

        // All-Time Aggregates (Single source of truth for current live wallet balance)
        const [
          allReceiptsAgg,
          allTransfersInAgg,
          allBankWithdrawalsAgg,
          allTransfersOutAgg,
          allExpensesAgg,
          allBankDepositsAgg,
        ] = await Promise.all([
          // Inflow: Direct receipts in hand/cash
          prisma.projectReceipt.aggregate({
            where: {
              organizationId: orgId,
              receivedById: uId,
              deletedAt: null,
              OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
            },
            _sum: { amount: true },
          }),
          // Inflow: Transfers from other users
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, toUserId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          // Inflow: Bank transfers to partner
          prisma.bankTransaction.aggregate({
            where: {
              organizationId: orgId,
              partnerId: uId,
              type: 'TRANSFER_TO_PARTNER',
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
          // Outflow: Transfers to supervisors/workers/partners
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, fromUserId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          // Outflow: Expenses paid from wallet
          prisma.expense.aggregate({
            where: { organizationId: orgId, walletOwnerId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          // Outflow: Bank deposits by partner
          prisma.bankTransaction.aggregate({
            where: {
              organizationId: orgId,
              partnerId: uId,
              type: 'TRANSFER_FROM_PARTNER',
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
        ]);

        const allTimeBalance = calculateWalletBalance({
          totalMoneyIn: allReceiptsAgg._sum.amount || 0,
          totalTransfersIn: allTransfersInAgg._sum.amount || 0,
          totalBankWithdrawals: allBankWithdrawalsAgg._sum.amount || 0,
          totalTransfersOut: allTransfersOutAgg._sum.amount || 0,
          totalExpenses: allExpensesAgg._sum.amount || 0,
          totalBankDeposits: allBankDepositsAgg._sum.amount || 0,
        });

        // Period-specific Aggregates
        const periodReceiptsWhere: any = {
          organizationId: orgId,
          receivedById: uId,
          deletedAt: null,
          OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
        };
        const periodTransfersInWhere: any = {
          organizationId: orgId,
          toUserId: uId,
          deletedAt: null,
        };
        const periodTransfersOutWhere: any = {
          organizationId: orgId,
          fromUserId: uId,
          deletedAt: null,
        };
        const periodExpensesWhere: any = {
          organizationId: orgId,
          walletOwnerId: uId,
          deletedAt: null,
        };

        if (hasDateFilter) {
          periodReceiptsWhere.date = dateFilter;
          periodTransfersInWhere.date = dateFilter;
          periodTransfersOutWhere.date = dateFilter;
          periodExpensesWhere.date = dateFilter;
        }

        const [pReceipts, pTransfersIn, pTransfersOut, pExpenses] = await Promise.all([
          prisma.projectReceipt.aggregate({
            where: periodReceiptsWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.fundTransfer.aggregate({
            where: periodTransfersInWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.fundTransfer.aggregate({
            where: periodTransfersOutWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.expense.aggregate({
            where: periodExpensesWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
        ]);

        const partnerExpensesList = allPeriodExpenses.filter(
          (e) => e.walletOwnerId === uId || (!e.walletOwnerId && e.spentById === uId)
        );
        const partnerExpenseBreakdown = buildCategoryBreakdown(partnerExpensesList);

        return {
          id: uId,
          name: m.user.name,
          email: m.user.email,
          mobile: m.user.mobile,
          role: normalizeRole(m.role),
          // Live Cash Balance in hand
          currentBalance: allTimeBalance.balance,
          totalCredits: allTimeBalance.totalCredits,
          totalDebits: allTimeBalance.totalDebits,
          // Period Stats
          period: {
            receiptsTotal: pReceipts._sum.amount || 0,
            receiptsCount: pReceipts._count.id || 0,
            transfersInTotal: pTransfersIn._sum.amount || 0,
            transfersInCount: pTransfersIn._count.id || 0,
            transfersOutTotal: pTransfersOut._sum.amount || 0,
            transfersOutCount: pTransfersOut._count.id || 0,
            expensesTotal: pExpenses._sum.amount || partnerExpenseBreakdown.total || 0,
            expensesCount: pExpenses._count.id || partnerExpensesList.length || 0,
          },
          expensesByCategory: partnerExpenseBreakdown.categories,
          totalExpensesAmount: partnerExpenseBreakdown.total,
        };
      })
    );

    // 4. If a specific partner or bank ledger query is requested
    let ledgerEntries: any[] = [];
    const isBankQuery = partnerId.startsWith('BANK');
    const specificBankId = partnerId.startsWith('BANK_') && partnerId !== 'BANK_ALL'
      ? partnerId.replace('BANK_', '')
      : null;
    const targetPartnerId = !isBankQuery && partnerId !== 'ALL' ? partnerId : null;

    if (targetPartnerId) {
      // Build Ledger for this specific partner
      const receiptsWhere: any = {
        organizationId: orgId,
        receivedById: targetPartnerId,
        deletedAt: null,
        OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
      };
      const transfersInWhere: any = {
        organizationId: orgId,
        toUserId: targetPartnerId,
        deletedAt: null,
      };
      const bankTransfersInWhere: any = {
        organizationId: orgId,
        partnerId: targetPartnerId,
        type: 'TRANSFER_TO_PARTNER',
        deletedAt: null,
      };
      const transfersOutWhere: any = {
        organizationId: orgId,
        fromUserId: targetPartnerId,
        deletedAt: null,
      };
      const expensesWhere: any = {
        organizationId: orgId,
        walletOwnerId: targetPartnerId,
        deletedAt: null,
      };
      const bankDepositsWhere: any = {
        organizationId: orgId,
        partnerId: targetPartnerId,
        type: 'TRANSFER_FROM_PARTNER',
        deletedAt: null,
      };

      if (hasDateFilter) {
        receiptsWhere.date = dateFilter;
        transfersInWhere.date = dateFilter;
        bankTransfersInWhere.date = dateFilter;
        transfersOutWhere.date = dateFilter;
        expensesWhere.date = dateFilter;
        bankDepositsWhere.date = dateFilter;
      }

      const [receipts, transfersIn, bankTransfersIn, transfersOut, expenses, bankDeposits] =
        await Promise.all([
          prisma.projectReceipt.findMany({
            where: receiptsWhere,
            include: {
              project: { select: { id: true, name: true, projectCode: true } },
              site: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.fundTransfer.findMany({
            where: transfersInWhere,
            include: {
              fromUser: { select: { id: true, name: true, email: true } },
              project: { select: { id: true, name: true } },
              site: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.bankTransaction.findMany({
            where: bankTransfersInWhere,
            include: {
              bankAccount: { select: { id: true, name: true, bankName: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.fundTransfer.findMany({
            where: transfersOutWhere,
            include: {
              toUser: { select: { id: true, name: true, email: true } },
              toWorker: { select: { id: true, name: true, workerCode: true } },
              project: { select: { id: true, name: true } },
              site: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.expense.findMany({
            where: expensesWhere,
            include: {
              project: { select: { id: true, name: true } },
              site: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.bankTransaction.findMany({
            where: bankDepositsWhere,
            include: {
              bankAccount: { select: { id: true, name: true, bankName: true } },
            },
            orderBy: { date: 'desc' },
          }),
        ]);

      // Normalize into unified ledger entries
      receipts.forEach((r) => {
        ledgerEntries.push({
          id: `rcpt-${r.id}`,
          rawId: r.id,
          date: r.date.toISOString(),
          type: 'RECEIPT',
          categoryLabel: 'Payment Received from Client',
          title: r.clientName,
          subtitle: r.project?.name + (r.site?.name ? ` • ${r.site.name}` : ''),
          credit: r.amount,
          debit: 0,
          paymentMethod: r.paymentMethod,
          receivedIn: r.receivedIn || 'WALLET',
          reference: r.reference,
          notes: r.notes,
        });
      });

      transfersIn.forEach((t) => {
        ledgerEntries.push({
          id: `trin-${t.id}`,
          rawId: t.id,
          date: t.date.toISOString(),
          type: 'TRANSFER_IN',
          categoryLabel: 'Transfer Received',
          title: `From: ${t.fromUser?.name || 'Owner/Partner'}`,
          subtitle: t.purpose + (t.project?.name ? ` • ${t.project.name}` : ''),
          credit: t.amount,
          debit: 0,
          paymentMethod: t.paymentMethod,
          reference: t.reference,
          notes: t.notes,
        });
      });

      bankTransfersIn.forEach((bt) => {
        ledgerEntries.push({
          id: `btin-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: 'BANK_WITHDRAWAL',
          categoryLabel: 'Bank Withdrawal',
          title: `Bank: ${bt.bankAccount?.bankName} (${bt.bankAccount?.name})`,
          subtitle: 'Cash withdrawn from company bank into wallet',
          credit: bt.amount,
          debit: 0,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
        });
      });

      transfersOut.forEach((t) => {
        const isWorker = Boolean(t.toWorker);
        const recipientName = t.toWorker?.name || t.toUser?.name || 'Partner/Supervisor';
        ledgerEntries.push({
          id: `trout-${t.id}`,
          rawId: t.id,
          date: t.date.toISOString(),
          type: 'TRANSFER_OUT',
          categoryLabel: isWorker ? `Worker Payment (${t.purpose || 'Labour'})` : 'Transfer Out',
          title: `${isWorker ? 'Worker: ' : 'To: '}${recipientName}`,
          subtitle: (t.purpose ? `${t.purpose}` : '') + (t.project?.name ? ` • ${t.project.name}` : ''),
          credit: 0,
          debit: t.amount,
          paymentMethod: t.paymentMethod,
          reference: t.reference,
          notes: t.notes,
        });
      });

      expenses.forEach((e) => {
        ledgerEntries.push({
          id: `exp-${e.id}`,
          rawId: e.id,
          date: e.date.toISOString(),
          type: 'EXPENSE',
          categoryLabel: `Site Expense: ${e.category}`,
          title: e.description || e.notes || e.category,
          subtitle: e.project?.name + (e.site?.name ? ` • ${e.site.name}` : ''),
          credit: 0,
          debit: e.amount,
          paymentMethod: e.paymentMethod,
          reference: e.vendorName || null,
          notes: e.notes,
        });
      });

      bankDeposits.forEach((bt) => {
        ledgerEntries.push({
          id: `btdep-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: 'BANK_DEPOSIT',
          categoryLabel: 'Bank Deposit',
          title: `Bank: ${bt.bankAccount?.bankName} (${bt.bankAccount?.name})`,
          subtitle: 'Partner deposited cash into bank account',
          credit: 0,
          debit: bt.amount,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
        });
      });

      // Sort chronological descending
      ledgerEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (isBankQuery) {
      // Build Ledger for Company Bank Accounts
      const bankTxWhere: any = {
        organizationId: orgId,
        deletedAt: null,
      };
      if (specificBankId) {
        bankTxWhere.bankAccountId = specificBankId;
      }
      if (hasDateFilter) {
        bankTxWhere.date = dateFilter;
      }

      const bankReceiptsWhere: any = {
        organizationId: orgId,
        receivedIn: 'BANK',
        deletedAt: null,
      };
      if (specificBankId) {
        bankReceiptsWhere.bankAccountId = specificBankId;
      }
      if (hasDateFilter) {
        bankReceiptsWhere.date = dateFilter;
      }

      const [bankTxs, bankReceipts] = await Promise.all([
        prisma.bankTransaction.findMany({
          where: bankTxWhere,
          include: {
            bankAccount: { select: { id: true, name: true, bankName: true, accountLast4: true } },
            partner: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true, projectCode: true } },
          },
          orderBy: { date: 'desc' },
          take: 100,
        }),
        prisma.projectReceipt.findMany({
          where: bankReceiptsWhere,
          include: {
            bankAccount: { select: { id: true, name: true, bankName: true, accountLast4: true } },
            project: { select: { id: true, name: true, projectCode: true } },
            site: { select: { id: true, name: true } },
            receivedBy: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
          take: 50,
        }),
      ]);

      // Direct client receipts received into bank
      bankReceipts.forEach((r) => {
        ledgerEntries.push({
          id: `rcpt-${r.id}`,
          rawId: r.id,
          date: r.date.toISOString(),
          type: 'RECEIPT',
          categoryLabel: 'Client Payment in Bank',
          title: r.clientName,
          subtitle: `${r.bankAccount ? `${r.bankAccount.bankName} (${r.bankAccount.name})` : 'Bank'}${r.project?.name ? ` • ${r.project.name}` : ''}${r.receivedBy?.name ? ` • Received by ${r.receivedBy.name}` : ''}`,
          credit: r.amount,
          debit: 0,
          paymentMethod: r.paymentMethod,
          receivedIn: 'BANK',
          reference: r.reference,
          notes: r.notes,
        });
      });

      // Bank transactions
      bankTxs.forEach((bt) => {
        const isCredit = ['DEPOSIT', 'TRANSFER_FROM_PARTNER', 'RECEIPT'].includes(bt.type);
        let typeLabel = 'Bank Transaction';
        let entryType: 'RECEIPT' | 'TRANSFER_IN' | 'BANK_WITHDRAWAL' | 'TRANSFER_OUT' | 'EXPENSE' | 'BANK_DEPOSIT' = 'BANK_DEPOSIT';
        let title = bt.bankAccount?.bankName || 'Bank';

        if (bt.type === 'DEPOSIT') {
          typeLabel = 'Direct Bank Deposit';
          entryType = 'BANK_DEPOSIT';
          title = bt.partner?.name ? `Deposit by ${bt.partner.name}` : 'Cash Deposited into Bank';
        } else if (bt.type === 'TRANSFER_FROM_PARTNER') {
          typeLabel = 'Partner Deposited Cash';
          entryType = 'BANK_DEPOSIT';
          title = `From Partner: ${bt.partner?.name || 'Partner'}`;
        } else if (bt.type === 'RECEIPT') {
          typeLabel = 'Bank Receipt';
          entryType = 'RECEIPT';
          title = bt.partner?.name ? `Receipt via ${bt.partner.name}` : 'Bank Receipt';
        } else if (bt.type === 'TRANSFER_TO_PARTNER') {
          typeLabel = 'Bank Transfer to Partner';
          entryType = 'TRANSFER_OUT';
          title = `To Partner: ${bt.partner?.name || 'Partner'}`;
        } else if (bt.type === 'WITHDRAWAL') {
          typeLabel = 'Cash Withdrawal from Bank';
          entryType = 'BANK_WITHDRAWAL';
          title = bt.partner?.name ? `Withdrawn by ${bt.partner.name}` : 'Cash Withdrawal';
        } else if (bt.type === 'PAYMENT') {
          typeLabel = 'Direct Vendor / Site Payment';
          entryType = 'EXPENSE';
          title = bt.notes || bt.reference || 'Bank Payment';
        }

        ledgerEntries.push({
          id: `bt-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: entryType,
          categoryLabel: typeLabel,
          title,
          subtitle: `${bt.bankAccount?.bankName} (${bt.bankAccount?.name})${bt.project?.name ? ` • ${bt.project.name}` : ''}`,
          credit: isCredit ? bt.amount : 0,
          debit: !isCredit ? bt.amount : 0,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
        });
      });

      // Sort chronological descending
      ledgerEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // 5. Fetch Recent Client Payment Receipts (for "Transfer from Received Payment" feature)
    const recentReceipts = await prisma.projectReceipt.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 25,
    });

    // 6. Fetch Projects for dropdown selection
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        projectCode: true,
        sites: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 7. Fetch Bank Accounts & compute runtime balances
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const accountsWithBalance = await Promise.all(
      bankAccounts.map(async (acc) => {
        const [
          depositsAgg,
          receiptsAgg,
          transferFromPartnerAgg,
          withdrawalsAgg,
          paymentsAgg,
          transferToPartnerAgg,
        ] = await Promise.all([
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'DEPOSIT', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'RECEIPT', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'WITHDRAWAL', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'PAYMENT', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: { bankAccountId: acc.id, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
            _sum: { amount: true },
          }),
        ]);

        const calc = calculateBankBalance({
          openingBalance: acc.openingBalance,
          totalDeposits: depositsAgg._sum.amount || 0,
          totalReceipts: receiptsAgg._sum.amount || 0,
          totalTransfersFromPartner: transferFromPartnerAgg._sum.amount || 0,
          totalWithdrawals: withdrawalsAgg._sum.amount || 0,
          totalPayments: paymentsAgg._sum.amount || 0,
          totalTransfersToPartner: transferToPartnerAgg._sum.amount || 0,
        });

        return {
          id: acc.id,
          name: acc.name,
          bankName: acc.bankName,
          accountLast4: acc.accountLast4 || '',
          balance: calc.balance,
        };
      })
    );

    const totalBankBalance = accountsWithBalance.reduce((sum, b) => sum + (b.balance || 0), 0);

    // Calculate Bank Summary (period metrics for banks)
    const bankTxSummaryWhere: any = {
      organizationId: orgId,
      deletedAt: null,
    };
    if (specificBankId) {
      bankTxSummaryWhere.bankAccountId = specificBankId;
    }
    if (hasDateFilter) {
      bankTxSummaryWhere.date = dateFilter;
    }

    const bankReceiptSummaryWhere: any = {
      organizationId: orgId,
      receivedIn: 'BANK',
      deletedAt: null,
    };
    if (specificBankId) {
      bankReceiptSummaryWhere.bankAccountId = specificBankId;
    }
    if (hasDateFilter) {
      bankReceiptSummaryWhere.date = dateFilter;
    }

    const [periodBankTxs, periodBankReceipts] = await Promise.all([
      prisma.bankTransaction.findMany({
        where: bankTxSummaryWhere,
        select: { type: true, amount: true },
      }),
      prisma.projectReceipt.aggregate({
        where: bankReceiptSummaryWhere,
        _sum: { amount: true },
      }),
    ]);

    let bankPeriodInflow = periodBankReceipts._sum.amount || 0;
    let bankPeriodToPartner = 0;
    let bankPeriodWithdrawals = 0;
    let bankPeriodPayments = 0;

    periodBankTxs.forEach((tx) => {
      if (['DEPOSIT', 'TRANSFER_FROM_PARTNER', 'RECEIPT'].includes(tx.type)) {
        bankPeriodInflow += tx.amount;
      } else if (tx.type === 'TRANSFER_TO_PARTNER') {
        bankPeriodToPartner += tx.amount;
      } else if (tx.type === 'WITHDRAWAL') {
        bankPeriodWithdrawals += tx.amount;
      } else if (tx.type === 'PAYMENT') {
        bankPeriodPayments += tx.amount;
      }
    });

    const selectedBankBalance = specificBankId
      ? (accountsWithBalance.find((a) => a.id === specificBankId)?.balance || 0)
      : totalBankBalance;

    const selectedBankAccount = specificBankId
      ? (accountsWithBalance.find((a) => a.id === specificBankId) || null)
      : null;

    const bankSummary = {
      selectedBankId: specificBankId || 'ALL',
      selectedBankBalance,
      selectedBankAccount,
      periodInflow: bankPeriodInflow,
      periodToPartner: bankPeriodToPartner,
      periodWithdrawals: bankPeriodWithdrawals,
      periodPayments: bankPeriodPayments,
    };

    // 8. Fetch active workers for "Send Money to Worker"
    const workers = await prisma.worker.findMany({
      where: { organizationId: orgId, deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        workerCode: true,
        category: true,
        mobile: true,
      },
      orderBy: { name: 'asc' },
    });

    // 9. Fetch custom purpose options (Expense categories & transfer reasons)
    const purposeOptions = await prisma.purposeOption.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      partners: partnersSummary,
      selectedPartnerId: partnerId,
      ledger: ledgerEntries,
      recentReceipts,
      projects,
      bankAccounts: accountsWithBalance,
      totalBankBalance,
      bankSummary,
      workers,
      purposeOptions,
      currentUserId: session.userId,
      userRole,
      overallExpensesByCategory: overallExpensesBreakdown.categories,
      overallExpensesTotal: overallExpensesBreakdown.total,
      selectedPartnerExpensesByCategory: targetPartnerId
        ? (partnersSummary.find((p) => p.id === targetPartnerId)?.expensesByCategory || [])
        : [],
    });
  } catch (error: any) {
    console.error('Error fetching partner hisaab:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch partner hisaab' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
      'ACCOUNTANT',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const role = normalizeRole(session.role);
    const isOwnerOrManager = ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(role);

    const body = await req.json();
    const {
      sourceType = 'PARTNER', // 'PARTNER' or 'BANK'
      sourceId, // partner userId or bankAccountId
      fromUserId: legacyFromUserId,
      destinationType = 'TO_PARTNER', // 'TO_PARTNER', 'INTERNAL_BANK_DEPOSIT', 'TO_WORKER', 'SELF_EXPENSE'
      toUserId, // legacy support for TO_PARTNER
      toPartnerId = toUserId,
      toBankAccountId,
      toWorkerId,
      workerReason,
      expenseCategory,
      expenseDescription,
      vendorName,
      amount,
      date,
      paymentMethod = 'CASH',
      purpose = 'PARTNER_TRANSFER',
      projectId,
      siteId,
      receiptId,
      reference,
      notes,
    } = body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Please enter a valid transfer amount greater than ₹0.' },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: 'Please select a transfer date.' },
        { status: 400 }
      );
    }
    const txDate = new Date(date);

    // Resolve source sender partner
    let effectivePartnerId = session.userId;
    if (sourceType === 'PARTNER') {
      if (sourceId) {
        effectivePartnerId = sourceId;
      } else if (legacyFromUserId) {
        effectivePartnerId = legacyFromUserId;
      }
    }

    // Resolve source bank account if source is BANK
    let sourceBankAccount: any = null;
    if (sourceType === 'BANK') {
      if (!sourceId) {
        return NextResponse.json(
          { error: 'Please select the paying bank account.' },
          { status: 400 }
        );
      }
      sourceBankAccount = await prisma.bankAccount.findFirst({
        where: { id: sourceId, organizationId: orgId, deletedAt: null },
      });
      if (!sourceBankAccount) {
        return NextResponse.json(
          { error: 'Source bank account not found.' },
          { status: 404 }
        );
      }
    }

    // Optional receipt reference enrichment
    let enrichedNotes = notes?.trim() || '';
    if (receiptId) {
      const receipt = await prisma.projectReceipt.findFirst({
        where: { id: receiptId, organizationId: orgId, deletedAt: null },
        include: { project: true },
      });
      if (receipt) {
        const prefix = `[From Client Payment: ${receipt.clientName} (₹${receipt.amount}) - ${receipt.project.name}]`;
        enrichedNotes = enrichedNotes ? `${prefix} ${enrichedNotes}` : prefix;
      }
    }

    // ==========================================
    // DESTINATION 1: SEND TO ANOTHER PARTNER
    // ==========================================
    if (destinationType === 'TO_PARTNER') {
      if (!toPartnerId) {
        return NextResponse.json(
          { error: 'Please select the recipient partner or owner.' },
          { status: 400 }
        );
      }

      const recipientMembership = await prisma.organizationUser.findFirst({
        where: { organizationId: orgId, userId: toPartnerId, status: 'ACTIVE' },
        include: { user: true },
      });
      if (!recipientMembership) {
        return NextResponse.json(
          { error: 'Recipient partner not found in this organization.' },
          { status: 404 }
        );
      }

      if (sourceType === 'PARTNER') {
        const transfer = await prisma.fundTransfer.create({
          data: {
            organizationId: orgId,
            transferType: 'PARTNER_TO_PARTNER',
            fromUserId: effectivePartnerId,
            toUserId: toPartnerId,
            projectId: projectId || null,
            siteId: siteId || null,
            amount: parsedAmount,
            date: txDate,
            paymentMethod,
            purpose: purpose || 'PARTNER_TRANSFER',
            reference: reference?.trim() || null,
            notes: enrichedNotes || null,
          },
          include: {
            fromUser: { select: { id: true, name: true } },
            toUser: { select: { id: true, name: true } },
          },
        });

        return NextResponse.json({
          success: true,
          transfer,
          message: `Successfully transferred ₹${parsedAmount.toLocaleString('en-IN')} to ${recipientMembership.user.name}!`,
        });
      } else {
        // Source is BANK
        const bankTx = await prisma.bankTransaction.create({
          data: {
            organizationId: orgId,
            bankAccountId: sourceBankAccount.id,
            type: 'TRANSFER_TO_PARTNER',
            partnerId: toPartnerId,
            amount: parsedAmount,
            date: txDate,
            projectId: projectId || null,
            reference: reference?.trim() || null,
            notes: enrichedNotes || `Transfer to ${recipientMembership.user.name}`,
            createdById: session.userId,
          },
        });

        return NextResponse.json({
          success: true,
          bankTx,
          message: `Successfully transferred ₹${parsedAmount.toLocaleString('en-IN')} from ${sourceBankAccount.bankName} to ${recipientMembership.user.name}!`,
        });
      }
    }

    // ==========================================
    // DESTINATION 2: INTERNAL BANK DEPOSIT / TRANSFER
    // ==========================================
    if (destinationType === 'INTERNAL_BANK_DEPOSIT') {
      if (!toBankAccountId) {
        return NextResponse.json(
          { error: 'Please select the destination bank account for deposit.' },
          { status: 400 }
        );
      }

      const targetBank = await prisma.bankAccount.findFirst({
        where: { id: toBankAccountId, organizationId: orgId, deletedAt: null },
      });
      if (!targetBank) {
        return NextResponse.json(
          { error: 'Target bank account not found.' },
          { status: 404 }
        );
      }

      if (sourceType === 'PARTNER') {
        const bankTx = await prisma.bankTransaction.create({
          data: {
            organizationId: orgId,
            bankAccountId: targetBank.id,
            type: 'TRANSFER_FROM_PARTNER',
            partnerId: effectivePartnerId,
            amount: parsedAmount,
            date: txDate,
            projectId: projectId || null,
            reference: reference?.trim() || null,
            notes: enrichedNotes || 'Partner cash deposited into bank',
            createdById: session.userId,
          },
        });

        return NextResponse.json({
          success: true,
          bankTx,
          message: `Successfully deposited ₹${parsedAmount.toLocaleString('en-IN')} into ${targetBank.bankName} (${targetBank.name})!`,
        });
      } else {
        // Bank-to-Bank Transfer
        if (sourceBankAccount.id === targetBank.id) {
          return NextResponse.json(
            { error: 'Source and target bank accounts cannot be the same.' },
            { status: 400 }
          );
        }

        await prisma.bankTransaction.create({
          data: {
            organizationId: orgId,
            bankAccountId: sourceBankAccount.id,
            type: 'WITHDRAWAL',
            amount: parsedAmount,
            date: txDate,
            reference: reference?.trim() || null,
            notes: `Internal transfer to ${targetBank.bankName} (${targetBank.name})${enrichedNotes ? ` • ${enrichedNotes}` : ''}`,
            createdById: session.userId,
          },
        });

        const depositTx = await prisma.bankTransaction.create({
          data: {
            organizationId: orgId,
            bankAccountId: targetBank.id,
            type: 'DEPOSIT',
            amount: parsedAmount,
            date: txDate,
            reference: reference?.trim() || null,
            notes: `Internal transfer from ${sourceBankAccount.bankName} (${sourceBankAccount.name})${enrichedNotes ? ` • ${enrichedNotes}` : ''}`,
            createdById: session.userId,
          },
        });

        return NextResponse.json({
          success: true,
          depositTx,
          message: `Successfully transferred ₹${parsedAmount.toLocaleString('en-IN')} from ${sourceBankAccount.bankName} to ${targetBank.bankName}!`,
        });
      }
    }

    // ==========================================
    // DESTINATION 3: PAYMENT TO WORKER / LABOUR
    // ==========================================
    if (destinationType === 'TO_WORKER') {
      if (!toWorkerId) {
        return NextResponse.json(
          { error: 'Please select the worker to pay.' },
          { status: 400 }
        );
      }

      const worker = await prisma.worker.findFirst({
        where: { id: toWorkerId, organizationId: orgId, deletedAt: null },
      });
      if (!worker) {
        return NextResponse.json(
          { error: 'Worker not found in this organization.' },
          { status: 404 }
        );
      }

      const reasonText = workerReason?.trim() || purpose || 'Worker Payment';
      const upperReason = reasonText.toUpperCase();
      const txType = upperReason.includes('SALARY') ? 'SALARY' : upperReason.includes('ADVANCE') ? 'ADVANCE' : 'PAYMENT';

      // 1. Create worker payment record
      const payment = await prisma.payment.create({
        data: {
          organizationId: orgId,
          workerId: worker.id,
          projectId: projectId || null,
          siteId: siteId || null,
          date: txDate,
          transactionType: txType,
          amount: parsedAmount,
          paymentMethod: sourceType === 'BANK' ? 'BANK' : paymentMethod,
          reference: reference?.trim() || null,
          notes: enrichedNotes ? `${reasonText} • ${enrichedNotes}` : reasonText,
        },
      });

      if (sourceType === 'PARTNER') {
        // 2. Create FundTransfer for partner wallet
        const transfer = await prisma.fundTransfer.create({
          data: {
            organizationId: orgId,
            transferType: 'PARTNER_TO_WORKER',
            fromUserId: effectivePartnerId,
            toWorkerId: worker.id,
            linkedPaymentId: payment.id,
            projectId: projectId || null,
            siteId: siteId || null,
            amount: parsedAmount,
            date: txDate,
            paymentMethod,
            purpose: reasonText,
            reference: reference?.trim() || null,
            notes: enrichedNotes || `Payment to worker ${worker.name} (${reasonText})`,
          },
        });

        return NextResponse.json({
          success: true,
          transfer,
          message: `Successfully paid ₹${parsedAmount.toLocaleString('en-IN')} to worker ${worker.name} for ${reasonText}!`,
        });
      } else {
        // 2. Create BankTransaction for bank account
        const bankTx = await prisma.bankTransaction.create({
          data: {
            organizationId: orgId,
            bankAccountId: sourceBankAccount.id,
            type: 'PAYMENT',
            amount: parsedAmount,
            date: txDate,
            projectId: projectId || null,
            reference: reference?.trim() || null,
            notes: `Worker Payment: ${worker.name} (${reasonText})${enrichedNotes ? ` • ${enrichedNotes}` : ''}`,
            createdById: session.userId,
          },
        });

        return NextResponse.json({
          success: true,
          bankTx,
          message: `Successfully paid ₹${parsedAmount.toLocaleString('en-IN')} from ${sourceBankAccount.bankName} to worker ${worker.name} (${reasonText})!`,
        });
      }
    }

    // ==========================================
    // DESTINATION 4: SELF / BUSINESS EXPENSE
    // ==========================================
    if (destinationType === 'SELF_EXPENSE') {
      const category = expenseCategory?.trim() || 'MISCELLANEOUS';
      const description = expenseDescription?.trim() || category;

      // Persist custom category to purposeOption if not exists
      try {
        const catExists = await prisma.purposeOption.findFirst({
          where: { organizationId: orgId, type: 'EXPENSE', name: category },
        });
        if (!catExists) {
          await prisma.purposeOption.create({
            data: { organizationId: orgId, type: 'EXPENSE', name: category, isSystem: false },
          });
        }
      } catch (e) {
        // ignore duplicate
      }

      if (sourceType === 'PARTNER') {
        const expense = await prisma.expense.create({
          data: {
            organizationId: orgId,
            walletOwnerId: effectivePartnerId,
            spentById: effectivePartnerId,
            category,
            description,
            amount: parsedAmount,
            date: txDate,
            paymentMethod,
            vendorName: vendorName?.trim() || null,
            projectId: projectId || null,
            siteId: siteId || null,
            notes: enrichedNotes || null,
          },
        });

        return NextResponse.json({
          success: true,
          expense,
          message: `Successfully recorded expense of ₹${parsedAmount.toLocaleString('en-IN')} under ${category}!`,
        });
      } else {
        // Bank direct expense
        const expense = await prisma.expense.create({
          data: {
            organizationId: orgId,
            category,
            description,
            amount: parsedAmount,
            date: txDate,
            paymentMethod: 'BANK',
            vendorName: vendorName?.trim() || null,
            projectId: projectId || null,
            siteId: siteId || null,
            notes: enrichedNotes || null,
          },
        });

        const bankTx = await prisma.bankTransaction.create({
          data: {
            organizationId: orgId,
            bankAccountId: sourceBankAccount.id,
            type: 'PAYMENT',
            amount: parsedAmount,
            date: txDate,
            projectId: projectId || null,
            reference: vendorName?.trim() || null,
            notes: `Expense: ${category} - ${description}${enrichedNotes ? ` • ${enrichedNotes}` : ''}`,
            createdById: session.userId,
          },
        });

        return NextResponse.json({
          success: true,
          expense,
          bankTx,
          message: `Successfully recorded bank payment of ₹${parsedAmount.toLocaleString('en-IN')} under ${category}!`,
        });
      }
    }

    return NextResponse.json(
      { error: 'Invalid destination type provided.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error creating partner transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process transaction' },
      { status: 500 }
    );
  }
}
