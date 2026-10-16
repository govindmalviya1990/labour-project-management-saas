import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { calculateWalletBalance, calculateBankBalance } from '@/lib/calculations';
import { getPartnerWalletBalance, getMultiplePartnersWalletBalances } from '@/lib/finance/partnerWallet';
import { executeWorkerPayment } from '@/lib/finance/executeWorkerPayment';
import { executeSupplierPayment } from '@/lib/finance/executeSupplierPayment';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

const CATEGORY_COLORS: Record<string, string> = {
  'FUEL & TRAVEL': '#3b82f6', // blue
  FUEL_TRAVEL: '#3b82f6',
  'WORKER SALARY & WAGES': '#f59e0b', // amber
  WORKER_SALARY: '#f59e0b',
  'WORKER ADVANCE': '#8b5cf6', // purple
  WORKER_ADVANCE: '#8b5cf6',
  'WORKER FOOD & TEA': '#10b981', // emerald
  WORKER_FOOD_TEA: '#10b981',
  'WORKER EXPENSES & PAYOUTS': '#ec4899', // pink
  WORKER_EXPENSE: '#ec4899',
  'GOODS & MATERIAL PURCHASE': '#06b6d4', // cyan
  GOODS_PURCHASE: '#06b6d4',
  'EQUIPMENT & TOOLS': '#6366f1', // indigo
  EQUIPMENT_TOOLS: '#6366f1',
  RENT: '#14b8a6', // teal
  PERSONAL: '#f43f5e', // rose
  MISCELLANEOUS: '#64748b', // slate
};

const COLOR_PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#84cc16',
  '#a855f7', '#64748b', '#0ea5e9', '#d946ef', '#eab308'
];

function formatCategoryLabel(cat: string): string {
  if (!cat) return 'Miscellaneous';
  const mapping: Record<string, string> = {
    GOODS_PURCHASE: 'Goods & Material Purchase',
    CHAY_NASTA: 'Worker Food & Tea',
    TRAVEL_PETROL: 'Fuel & Travel',
    LABOUR_FOOD: 'Worker Food & Tea',
    GROCERY_WORKER: 'Worker Grocery',
    GROCERY_SELF: 'Self Grocery',
    PERSONAL: 'Self / Personal',
    EQUIPMENT_TOOLS: 'Equipment & Tools',
    RENT: 'Rent',
    MOBILE_RECHARGE: 'Mobile Recharge',
    MISCELLANEOUS: 'Miscellaneous',
    OTHER: 'Other',
    MATERIAL: 'Material',
    FUEL: 'Fuel & Travel',
    PETROL: 'Fuel & Travel',
    ELECTRICITY: 'Electricity',
    LABOUR: 'Worker Salary & Wages',
  };
  if (mapping[cat.toUpperCase()]) return mapping[cat.toUpperCase()];
  if (mapping[cat]) return mapping[cat];
  return cat.replace(/_/g, ' ');
}

function normalizeCategory(cat: string): { key: string; label: string } {
  if (!cat) return { key: 'MISCELLANEOUS', label: 'Miscellaneous' };
  const clean = cat.trim();
  const upper = clean.toUpperCase().replace(/[\s&/_-]+/g, '_');

  // Unified Fuel & Travel: Petrol, Fuel, Travel, Diesel
  if (
    upper === 'PETROL' ||
    upper === 'FUEL' ||
    upper === 'TRAVEL' ||
    upper === 'DIESEL' ||
    upper === 'FUEL_TRAVEL' ||
    upper === 'TRAVEL_PETROL' ||
    upper.includes('PETROL') ||
    upper.includes('FUEL') ||
    upper.includes('TRAVEL') ||
    upper.includes('DIESEL')
  ) {
    return { key: 'FUEL_TRAVEL', label: 'Fuel & Travel' };
  }

  // Worker Salary & Wages
  if (
    upper === 'SALARY' ||
    upper === 'WORKER_SALARY' ||
    upper === 'LABOUR' ||
    upper === 'LABOUR_WAGES' ||
    upper === 'WAGE' ||
    upper === 'WAGES' ||
    upper.includes('SALARY') ||
    upper.includes('WAGE')
  ) {
    return { key: 'WORKER_SALARY', label: 'Worker Salary & Wages' };
  }

  // Worker Advance
  if (
    upper === 'ADVANCE' ||
    upper === 'WORKER_ADVANCE' ||
    upper.includes('ADVANCE')
  ) {
    return { key: 'WORKER_ADVANCE', label: 'Worker Advance' };
  }

  // Worker Food & Tea
  if (
    upper === 'CHAY_NASTA' ||
    upper === 'CHAI_NASTA' ||
    upper === 'TEA' ||
    upper === 'CHAY' ||
    upper === 'NASTA' ||
    upper === 'SNACKS' ||
    upper === 'LABOUR_FOOD' ||
    upper === 'WORKER_FOOD' ||
    upper === 'WORKER_FOOD_TEA' ||
    upper.includes('FOOD') ||
    upper.includes('NASTA') ||
    upper.includes('CHAY') ||
    upper.includes('TEA')
  ) {
    return { key: 'WORKER_FOOD_TEA', label: 'Worker Food & Tea' };
  }

  // Worker General Expense / Payout
  if (
    upper === 'WORKER_EXPENSE' ||
    upper === 'WORKER_PAYMENT' ||
    upper.includes('WORKER') ||
    upper.includes('LABOUR')
  ) {
    return { key: 'WORKER_EXPENSE', label: 'Worker Expenses & Payouts' };
  }

  // Goods & Material Purchase
  if (
    upper === 'GOODS_PURCHASE' ||
    upper === 'MATERIAL' ||
    upper === 'MATERIALS' ||
    upper.includes('MATERIAL') ||
    upper.includes('PURCHASE') ||
    upper.includes('CEMENT') ||
    upper.includes('CHEMICAL')
  ) {
    return { key: 'GOODS_PURCHASE', label: 'Goods & Material Purchase' };
  }

  // Equipment & Tools
  if (upper === 'EQUIPMENT_TOOLS' || upper.includes('EQUIPMENT') || upper.includes('TOOLS')) {
    return { key: 'EQUIPMENT_TOOLS', label: 'Equipment & Tools' };
  }

  // Rent
  if (upper === 'RENT' || upper.includes('RENT')) {
    return { key: 'RENT', label: 'Rent' };
  }

  // Grocery
  if (upper.includes('GROCERY')) {
    return { key: 'GROCERY', label: 'Grocery & Supplies' };
  }

  return { key: upper, label: formatCategoryLabel(clean) };
}

function getCategoryColor(categoryKey: string, index: number): string {
  const upper = (categoryKey || '').toUpperCase().trim();
  if (CATEGORY_COLORS[upper]) return CATEGORY_COLORS[upper];
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function buildCategoryBreakdown(expensesList: Array<{ category: string; amount: number }>) {
  const total = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0);
  const grouped: Record<string, { category: string; label: string; amount: number; count: number }> = {};

  for (const e of expensesList) {
    const { key, label } = normalizeCategory(e.category);
    if (!grouped[key]) {
      grouped[key] = {
        category: label,
        label,
        amount: 0,
        count: 0,
      };
    }
    grouped[key].amount += e.amount || 0;
    grouped[key].count += 1;
  }

  const sorted = Object.values(grouped).sort((a, b) => b.amount - a.amount);

  return {
    total,
    categories: sorted.map((item, idx) => ({
      ...item,
      percentage: total > 0 ? Number(((item.amount / total) * 100).toFixed(1)) : 0,
      color: getCategoryColor(item.label, idx),
    })),
  };
}

function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.split('T')[0].split('-');
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
  }
  // Check DD-MM-YYYY or DD/MM/YYYY
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

function createSingleDayBounds(dateStr: string): { startDate: Date; endDate: Date } {
  const parts = parseDateParts(dateStr);
  if (!parts) {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startDate: s, endDate: e };
  }
  const { year, month, day } = parts;
  // Start of day IST is 18:30 UTC of previous day
  const startIST = new Date(Date.UTC(year, month - 1, day - 1, 18, 30, 0, 0));
  // End of day UTC is 23:59:59.999 UTC of selected day (envelopes both IST day and UTC timestamps)
  const endUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return { startDate: startIST, endDate: endUTC };
}

function createRangeBounds(startStr: string, endStr: string): { startDate: Date; endDate: Date } {
  const sParts = parseDateParts(startStr);
  const eParts = parseDateParts(endStr);
  const now = new Date();
  const startDate = sParts
    ? new Date(Date.UTC(sParts.year, sParts.month - 1, sParts.day - 1, 18, 30, 0, 0))
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endDate = eParts
    ? new Date(Date.UTC(eParts.year, eParts.month - 1, eParts.day, 23, 59, 59, 999))
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startDate, endDate };
}

function resolvePeriodDateRange(
  period: string,
  customStartDate?: string | null,
  customEndDate?: string | null
): { startDate: Date | null; endDate: Date | null; hasDateFilter: boolean; isSingleDay: boolean } {
  if (period === 'all' && !customStartDate && !customEndDate) {
    return { startDate: null, endDate: null, hasDateFilter: false, isSingleDay: false };
  }

  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayISTStr = istFormatter.format(now); // e.g. "2026-10-09"

  if (period === 'today') {
    const { startDate, endDate } = createSingleDayBounds(todayISTStr);
    return { startDate, endDate, hasDateFilter: true, isSingleDay: true };
  }

  if (period === 'single_day') {
    const target = customStartDate || customEndDate || todayISTStr;
    const { startDate, endDate } = createSingleDayBounds(target);
    return { startDate, endDate, hasDateFilter: true, isSingleDay: true };
  }

  if (period === 'weekly') {
    const [y, m, d] = todayISTStr.split('-').map(Number);
    const istNowDate = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = istNowDate.getUTCDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const mondayDate = new Date(istNowDate);
    mondayDate.setUTCDate(mondayDate.getUTCDate() - diffToMonday);
    const mondayStr = mondayDate.toISOString().split('T')[0];
    const { startDate, endDate } = createRangeBounds(mondayStr, todayISTStr);
    return { startDate, endDate, hasDateFilter: true, isSingleDay: false };
  }

  if (period === 'monthly') {
    const [y, m] = todayISTStr.split('-').map(Number);
    const monthStartStr = `${y}-${String(m).padStart(2, '0')}-01`;
    const { startDate, endDate } = createRangeBounds(monthStartStr, todayISTStr);
    return { startDate, endDate, hasDateFilter: true, isSingleDay: false };
  }

  if (period === 'custom' || customStartDate || customEndDate) {
    const s = (customStartDate || '').trim();
    const e = (customEndDate || '').trim();
    if (s && e && s === e) {
      const { startDate, endDate } = createSingleDayBounds(s);
      return { startDate, endDate, hasDateFilter: true, isSingleDay: true };
    }
    if (s && !e) {
      const { startDate, endDate } = createSingleDayBounds(s);
      return { startDate, endDate, hasDateFilter: true, isSingleDay: true };
    }
    if (!s && e) {
      const { startDate, endDate } = createSingleDayBounds(e);
      return { startDate, endDate, hasDateFilter: true, isSingleDay: true };
    }
    const { startDate, endDate } = createRangeBounds(s, e);
    return { startDate, endDate, hasDateFilter: true, isSingleDay: false };
  }

  return { startDate: null, endDate: null, hasDateFilter: false, isSingleDay: false };
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
    const showDeletedParam = searchParams.get('showDeleted');
    const isOwner = userRole === 'OWNER';
    const showDeleted = isOwner && showDeletedParam === 'true';

    // 1. Calculate Date Range Filters with IST Timezone boundary safety
    const { startDate, endDate, hasDateFilter, isSingleDay } = resolvePeriodDateRange(
      period,
      customStartDate,
      customEndDate
    );

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

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

    // 3. Fetch all expenses & worker payouts in organization for category breakdown
    const orgPeriodExpensesWhere: any = {
      organizationId: orgId,
      deletedAt: null,
    };
    if (hasDateFilter) {
      orgPeriodExpensesWhere.date = dateFilter;
    }

    const [allPeriodExpenses, allPeriodPayments, allPeriodTransfersToWorker] = await Promise.all([
      prisma.expense.findMany({
        where: orgPeriodExpensesWhere,
        select: {
          id: true,
          amount: true,
          category: true,
          description: true,
          walletOwnerId: true,
          spentById: true,
          paidBy: true,
          notes: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
        select: {
          id: true,
          amount: true,
          transactionType: true,
          notes: true,
          fundTransferId: true,
          fundTransfer: {
            select: {
              fromUserId: true,
            },
          },
        },
      }),
      prisma.fundTransfer.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(hasDateFilter ? { date: dateFilter } : {}),
          OR: [
            { toWorkerId: { not: null } },
            { transferType: 'PARTNER_TO_WORKER' },
            { transferType: 'SUPERVISOR_TO_WORKER' },
          ],
        },
        select: {
          id: true,
          amount: true,
          purpose: true,
          notes: true,
          fromUserId: true,
          linkedPaymentId: true,
        },
      }),
    ]);

    // Build unified expenses list including worker salaries, advances & payouts
    // Filter out Expense rows created as bridges for Payment records to prevent double-counting
    const allPeriodCombinedExpenses: Array<{
      category: string;
      amount: number;
      walletOwnerId?: string | null;
      spentById?: string | null;
      paidBy?: string | null;
    }> = [
      ...allPeriodExpenses
        .filter((e) => !(e.notes && e.notes.includes('Payment ID:')))
        .map((e) => ({
          category: e.category,
          amount: e.amount,
          walletOwnerId: e.walletOwnerId,
          spentById: e.spentById,
          paidBy: e.paidBy,
        })),
      ...allPeriodPayments.map((p) => {
        let cat = 'Worker Expenses & Payouts';
        const tType = (p.transactionType || '').toUpperCase();
        const notesUpper = (p.notes || '').toUpperCase();
        if (tType === 'SALARY' || notesUpper.includes('SALARY') || notesUpper.includes('WAGE')) {
          cat = 'Worker Salary & Wages';
        } else if (tType === 'ADVANCE' || notesUpper.includes('ADVANCE')) {
          cat = 'Worker Advance';
        }
        return {
          category: cat,
          amount: p.amount,
          walletOwnerId: p.fundTransfer?.fromUserId || null,
          spentById: p.fundTransfer?.fromUserId || null,
        };
      }),
      ...allPeriodTransfersToWorker
        .filter((t) => !t.linkedPaymentId)
        .map((t) => {
          let cat = 'Worker Expenses & Payouts';
          const pUpper = (t.purpose || '').toUpperCase();
          const notesUpper = (t.notes || '').toUpperCase();
          if (pUpper.includes('SALARY') || notesUpper.includes('SALARY') || notesUpper.includes('WAGE')) {
            cat = 'Worker Salary & Wages';
          } else if (pUpper.includes('ADVANCE') || notesUpper.includes('ADVANCE')) {
            cat = 'Worker Advance';
          }
          return {
            category: cat,
            amount: t.amount,
            walletOwnerId: t.fromUserId,
            spentById: t.fromUserId,
          };
        }),
    ];

    const overallExpensesBreakdown = buildCategoryBreakdown(allPeriodCombinedExpenses);

    // 4. For each partner/owner, compute live balance and period metrics
    const partnersSummary = await Promise.all(
      partnerMembers.map(async (m) => {
        const uId = m.userId;

        // All-Time Aggregates (using shared helper with opening balance)
        const allTimeBalance = await getPartnerWalletBalance(prisma, orgId, uId);

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
        const periodTransfersToPartnersWhere: any = {
          organizationId: orgId,
          fromUserId: uId,
          toWorkerId: null,
          linkedPaymentId: null,
          transferType: { notIn: ['PARTNER_TO_WORKER', 'SUPERVISOR_TO_WORKER', 'PARTNER_TO_SUPPLIER'] },
          deletedAt: null,
        };
        const periodSupplierPaymentsWhere: any = {
          organizationId: orgId,
          fromUserId: uId,
          transferType: 'PARTNER_TO_SUPPLIER',
          deletedAt: null,
        };
        const periodWorkerPaymentsWhere: any = {
          organizationId: orgId,
          fromUserId: uId,
          deletedAt: null,
          OR: [
            { toWorkerId: { not: null } },
            { linkedPaymentId: { not: null } },
            { transferType: 'PARTNER_TO_WORKER' },
            { transferType: 'SUPERVISOR_TO_WORKER' },
          ],
        };
        const periodExpensesWhere: any = {
          organizationId: orgId,
          walletOwnerId: uId,
          deletedAt: null,
          NOT: {
            AND: [
              { category: 'LABOUR' },
              { notes: { contains: 'Payment ID:' } },
            ],
          },
        };

        if (hasDateFilter) {
          periodReceiptsWhere.date = dateFilter;
          periodTransfersInWhere.date = dateFilter;
          periodTransfersToPartnersWhere.date = dateFilter;
          periodSupplierPaymentsWhere.date = dateFilter;
          periodWorkerPaymentsWhere.date = dateFilter;
          periodExpensesWhere.date = dateFilter;
        }

        const [pReceipts, pTransfersIn, pTransfersToPartners, pSupplierPayments, pWorkerPayments, pExpenses] = await Promise.all([
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
            where: periodTransfersToPartnersWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.fundTransfer.aggregate({
            where: periodSupplierPaymentsWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.fundTransfer.aggregate({
            where: periodWorkerPaymentsWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.expense.aggregate({
            where: periodExpensesWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
        ]);

        const partnerExpensesList = allPeriodCombinedExpenses.filter((e) => {
          if (partnerMembers.length === 1) return true;
          if (e.walletOwnerId === uId) return true;
          if (!e.walletOwnerId && e.spentById === uId) return true;
          if (e.paidBy && m.user?.name && (e.paidBy.toLowerCase().includes(m.user.name.toLowerCase()) || m.user.name.toLowerCase().includes(e.paidBy.toLowerCase()))) return true;
          return false;
        });
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
          openingBalance: allTimeBalance.openingBalance,
          openingBalanceDate: m.openingBalanceDate ? m.openingBalanceDate.toISOString() : null,
          openingBalanceNote: m.openingBalanceNote || null,
          // Period Stats
          period: {
            receiptsTotal: pReceipts._sum.amount || 0,
            receiptsCount: pReceipts._count.id || 0,
            transfersInTotal: pTransfersIn._sum.amount || 0,
            transfersInCount: pTransfersIn._count.id || 0,
            transfersOutTotal: pTransfersToPartners._sum.amount || 0,
            transfersOutCount: pTransfersToPartners._count.id || 0,
            supplierPaymentsTotal: pSupplierPayments._sum.amount || 0,
            supplierPaymentsCount: pSupplierPayments._count.id || 0,
            workerPaymentsTotal: pWorkerPayments._sum.amount || 0,
            workerPaymentsCount: pWorkerPayments._count.id || 0,
            combinedTransfersOutTotal: (pTransfersToPartners._sum.amount || 0) + (pWorkerPayments._sum.amount || 0) + (pSupplierPayments._sum.amount || 0),
            combinedTransfersOutCount: (pTransfersToPartners._count.id || 0) + (pWorkerPayments._count.id || 0) + (pSupplierPayments._count.id || 0),
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
    const deleteFilter = showDeleted ? {} : { deletedAt: null };

    if (targetPartnerId) {
      // Build Ledger for this specific partner
      const receiptsWhere: any = {
        organizationId: orgId,
        receivedById: targetPartnerId,
        ...deleteFilter,
        OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
      };
      const transfersInWhere: any = {
        organizationId: orgId,
        toUserId: targetPartnerId,
        ...deleteFilter,
      };
      const bankTransfersInWhere: any = {
        organizationId: orgId,
        partnerId: targetPartnerId,
        type: 'TRANSFER_TO_PARTNER',
        ...deleteFilter,
      };
      const transfersOutWhere: any = {
        organizationId: orgId,
        fromUserId: targetPartnerId,
        ...deleteFilter,
      };
      const expensesWhere: any = {
        organizationId: orgId,
        walletOwnerId: targetPartnerId,
        ...deleteFilter,
      };
      const bankDepositsWhere: any = {
        organizationId: orgId,
        partnerId: targetPartnerId,
        type: 'TRANSFER_FROM_PARTNER',
        ...deleteFilter,
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
              receivedBy: { select: { id: true, name: true } },
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
          entityType: 'ProjectReceipt',
          model: 'ProjectReceipt',
          categoryLabel: 'Payment Received from Client',
          title: r.clientName,
          subtitle: r.project?.name + (r.site?.name ? ` • ${r.site.name}` : ''),
          credit: r.amount,
          debit: 0,
          amount: r.amount,
          paymentMethod: r.paymentMethod,
          receivedIn: r.receivedIn || 'WALLET',
          reference: r.reference,
          notes: r.notes,
          remarks: r.notes,
          description: r.clientName,
          category: r.purpose || 'RUNNING_BILL',
          projectId: r.projectId,
          siteId: r.siteId,
          createdAt: r.createdAt.toISOString(),
          isEdited: Boolean(r.isEdited),
          editReason: r.editReason,
          isDeleted: Boolean(r.deletedAt),
          deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
          deleteReason: r.deleteReason,
          receivedById: r.receivedById,
        });
      });

      transfersIn.forEach((t) => {
        ledgerEntries.push({
          id: `trin-${t.id}`,
          rawId: t.id,
          date: t.date.toISOString(),
          type: 'TRANSFER_IN',
          entityType: 'FundTransfer',
          model: 'FundTransfer',
          categoryLabel: 'Transfer Received',
          title: `From: ${t.fromUser?.name || 'Owner/Partner'}`,
          subtitle: t.purpose + (t.project?.name ? ` • ${t.project.name}` : ''),
          credit: t.amount,
          debit: 0,
          amount: t.amount,
          paymentMethod: t.paymentMethod,
          reference: t.reference,
          notes: t.notes,
          remarks: t.notes,
          category: t.purpose,
          projectId: t.projectId,
          siteId: t.siteId,
          createdAt: t.createdAt.toISOString(),
          isEdited: Boolean(t.isEdited),
          editReason: t.editReason,
          isDeleted: Boolean(t.deletedAt),
          deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
          deleteReason: t.deleteReason,
          fromUserId: t.fromUserId,
          toUserId: t.toUserId,
        });
      });

      bankTransfersIn.forEach((bt) => {
        ledgerEntries.push({
          id: `btin-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: 'BANK_WITHDRAWAL',
          entityType: 'BankTransaction',
          model: 'BankTransaction',
          categoryLabel: 'Bank Withdrawal',
          title: `Bank: ${bt.bankAccount?.bankName} (${bt.bankAccount?.name})`,
          subtitle: 'Cash withdrawn from company bank into wallet',
          credit: bt.amount,
          debit: 0,
          amount: bt.amount,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
          remarks: bt.notes,
          createdAt: bt.createdAt.toISOString(),
          isEdited: Boolean(bt.isEdited),
          editReason: bt.editReason,
          isDeleted: Boolean(bt.deletedAt),
          deletedAt: bt.deletedAt ? bt.deletedAt.toISOString() : null,
          deleteReason: bt.deleteReason,
          createdById: bt.createdById,
          partnerId: bt.partnerId,
        });
      });

      transfersOut.forEach((t) => {
        const isWorker = Boolean(t.toWorker || t.toWorkerId || t.linkedPaymentId);
        const isSupplier = t.transferType === 'PARTNER_TO_SUPPLIER' || (Boolean(t.purpose) && t.purpose.includes('Supplier Payment'));
        const supMatch = t.purpose?.match(/Supplier Payment:\s*(.+)$/i);
        const supplierName = supMatch ? supMatch[1].trim() : 'Supplier';
        const recipientName = isSupplier
          ? supplierName
          : (t.toWorker?.name || t.toUser?.name || 'Partner/Supervisor');

        let entryType = 'TRANSFER_OUT';
        let entityType = 'FundTransfer';
        let categoryLabel = 'Transfer Out';
        let title = `To: ${recipientName}`;

        if (isWorker) {
          entryType = 'WORKER_PAYMENT';
          entityType = 'Payment';
          categoryLabel = `Worker Payment (${t.purpose || 'Labour'})`;
          title = `Worker: ${recipientName}`;
        } else if (isSupplier) {
          entryType = 'SUPPLIER_PAYMENT';
          entityType = 'SupplierPayment';
          categoryLabel = 'Supplier Payment';
          title = `Supplier Payment: ${recipientName}`;
        }

        ledgerEntries.push({
          id: `trout-${t.id}`,
          rawId: t.id,
          date: t.date.toISOString(),
          type: entryType,
          entityType: entityType,
          model: 'FundTransfer',
          isWorkerPayment: isWorker,
          isSupplierPayment: isSupplier,
          workerId: t.toWorkerId,
          workerName: t.toWorker?.name,
          categoryLabel,
          title,
          subtitle: (t.purpose ? `${t.purpose}` : '') + (t.project?.name ? ` • ${t.project.name}` : ''),
          credit: 0,
          debit: t.amount,
          amount: t.amount,
          paymentMethod: t.paymentMethod,
          reference: t.reference,
          notes: t.notes,
          remarks: t.notes,
          category: t.purpose,
          projectId: t.projectId,
          siteId: t.siteId,
          createdAt: t.createdAt.toISOString(),
          isEdited: Boolean(t.isEdited),
          editReason: t.editReason,
          isDeleted: Boolean(t.deletedAt),
          deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
          deleteReason: t.deleteReason,
          fromUserId: t.fromUserId,
          toUserId: t.toUserId,
          toWorkerId: t.toWorkerId,
          linkedPaymentId: t.linkedPaymentId,
        });
      });

      expenses.forEach((e) => {
        const isLabourExpense = e.category === 'LABOUR' && Boolean(e.notes && e.notes.includes('Payment ID:'));
        if (isLabourExpense) {
          // SKIP duplicate: worker payment is already debited via FundTransfer (trout)
          return;
        }
        ledgerEntries.push({
          id: `exp-${e.id}`,
          rawId: e.id,
          date: e.date.toISOString(),
          type: 'EXPENSE',
          entityType: 'Expense',
          model: 'Expense',
          isWorkerPayment: false,
          categoryLabel: `Site Expense: ${formatCategoryLabel(e.category)}`,
          title: e.description || e.notes || e.category,
          subtitle: e.project?.name + (e.site?.name ? ` • ${e.site.name}` : ''),
          credit: 0,
          debit: e.amount,
          amount: e.amount,
          paymentMethod: e.paymentMethod,
          reference: e.vendorName || null,
          notes: e.notes,
          remarks: e.notes,
          description: e.description,
          category: e.category,
          projectId: e.projectId,
          siteId: e.siteId,
          createdAt: e.createdAt.toISOString(),
          isEdited: Boolean(e.isEdited),
          editReason: e.editReason,
          isDeleted: Boolean(e.deletedAt),
          deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
          deleteReason: e.deleteReason,
          walletOwnerId: e.walletOwnerId,
          spentById: e.spentById,
        });
      });

      bankDeposits.forEach((bt) => {
        ledgerEntries.push({
          id: `btdep-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: 'BANK_DEPOSIT',
          entityType: 'BankTransaction',
          model: 'BankTransaction',
          categoryLabel: 'Bank Deposit',
          title: `Bank: ${bt.bankAccount?.bankName} (${bt.bankAccount?.name})`,
          subtitle: 'Partner deposited cash into bank account',
          credit: 0,
          debit: bt.amount,
          amount: bt.amount,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
          remarks: bt.notes,
          createdAt: bt.createdAt.toISOString(),
          isEdited: Boolean(bt.isEdited),
          editReason: bt.editReason,
          isDeleted: Boolean(bt.deletedAt),
          deletedAt: bt.deletedAt ? bt.deletedAt.toISOString() : null,
          deleteReason: bt.deleteReason,
          createdById: bt.createdById,
          partnerId: bt.partnerId,
        });
      });

      // Opening Balance & Balance Brought Forward calculations for Partner
      const targetOrgUser = memberships.find((m) => m.userId === targetPartnerId);
      const opBal = targetOrgUser?.openingBalance || 0;
      const opDate = targetOrgUser?.openingBalanceDate || null;
      const opNote = targetOrgUser?.openingBalanceNote || null;

      if (hasDateFilter && startDate) {
        const priorCutoff = dateFilter.gte;
        const [priorRcpt, priorTrIn, priorBWith, priorTrOut, priorExp, priorBDep] = await Promise.all([
          prisma.projectReceipt.aggregate({
            where: {
              organizationId: orgId,
              receivedById: targetPartnerId,
              date: { lt: priorCutoff },
              deletedAt: null,
              OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
            },
            _sum: { amount: true },
          }),
          prisma.fundTransfer.aggregate({
            where: {
              organizationId: orgId,
              toUserId: targetPartnerId,
              date: { lt: priorCutoff },
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: {
              organizationId: orgId,
              partnerId: targetPartnerId,
              type: 'TRANSFER_TO_PARTNER',
              date: { lt: priorCutoff },
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
          prisma.fundTransfer.aggregate({
            where: {
              organizationId: orgId,
              fromUserId: targetPartnerId,
              date: { lt: priorCutoff },
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: {
              organizationId: orgId,
              walletOwnerId: targetPartnerId,
              date: { lt: priorCutoff },
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
          prisma.bankTransaction.aggregate({
            where: {
              organizationId: orgId,
              partnerId: targetPartnerId,
              type: 'TRANSFER_FROM_PARTNER',
              date: { lt: priorCutoff },
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
        ]);

        const priorCredits =
          (priorRcpt._sum.amount || 0) +
          (priorTrIn._sum.amount || 0) +
          (priorBWith._sum.amount || 0);
        const priorDebits =
          (priorTrOut._sum.amount || 0) +
          (priorExp._sum.amount || 0) +
          (priorBDep._sum.amount || 0);
        const priorBalance = Math.round((opBal + priorCredits - priorDebits) * 100) / 100;

        ledgerEntries.push({
          id: `bbf-${targetPartnerId}`,
          rawId: `bbf-${targetPartnerId}`,
          date: priorCutoff.toISOString(),
          type: 'BALANCE_BROUGHT_FORWARD',
          entityType: 'BALANCE_BROUGHT_FORWARD',
          categoryLabel: 'Balance Brought Forward',
          title: 'Balance brought forward (Pichhla Bacha Balance)',
          subtitle: `Prior opening balance & transactions before ${priorCutoff.toLocaleDateString('en-IN')}`,
          credit: priorBalance > 0 ? priorBalance : 0,
          debit: priorBalance < 0 ? Math.abs(priorBalance) : 0,
          paymentMethod: 'ADJUSTMENT',
          reference: null,
          notes: null,
          isNonEditable: true,
          canEdit: false,
          canDelete: false,
        });
      } else {
        if (opBal !== 0) {
          ledgerEntries.push({
            id: `opbal-${targetPartnerId}`,
            rawId: `opbal-${targetPartnerId}`,
            date: (opDate || new Date(2020, 0, 1)).toISOString(),
            type: 'OPENING_BALANCE',
            entityType: 'OPENING_BALANCE',
            categoryLabel: 'Opening Balance',
            title: 'Opening Balance (Shuruaati Balance)',
            subtitle: opNote || 'Partner initial opening cash balance',
            credit: opBal > 0 ? opBal : 0,
            debit: opBal < 0 ? Math.abs(opBal) : 0,
            paymentMethod: 'OPENING',
            reference: null,
            notes: opNote,
            isNonEditable: true,
            canEdit: false,
            canDelete: false,
          });
        }
      }
    } else if (isBankQuery) {
      // Build Ledger for Company Bank Accounts
      const bankTxWhere: any = {
        organizationId: orgId,
        ...deleteFilter,
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
        ...deleteFilter,
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
        }),
      ]);

      const addedReceiptRefs = new Set<string>();

      // Direct client receipts received into bank
      bankReceipts.forEach((r) => {
        addedReceiptRefs.add(r.id);
        if (r.reference) addedReceiptRefs.add(r.reference);

        ledgerEntries.push({
          id: `rcpt-${r.id}`,
          rawId: r.id,
          date: r.date.toISOString(),
          type: 'RECEIPT',
          entityType: 'ProjectReceipt',
          model: 'ProjectReceipt',
          categoryLabel: 'Client Payment in Bank',
          title: r.clientName,
          subtitle: `${r.bankAccount ? `${r.bankAccount.bankName} (${r.bankAccount.name})` : 'Bank'}${r.project?.name ? ` • ${r.project.name}` : ''}${r.receivedBy?.name ? ` • Received by ${r.receivedBy.name}` : ''}`,
          credit: r.amount,
          debit: 0,
          amount: r.amount,
          paymentMethod: r.paymentMethod,
          receivedIn: 'BANK',
          reference: r.reference,
          notes: r.notes,
          remarks: r.notes,
          description: r.clientName,
          category: r.purpose || 'RUNNING_BILL',
          projectId: r.projectId,
          siteId: r.siteId,
          createdAt: r.createdAt.toISOString(),
          isEdited: Boolean(r.isEdited),
          editReason: r.editReason,
          isDeleted: Boolean(r.deletedAt),
          deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
          deleteReason: r.deleteReason,
          receivedById: r.receivedById,
        });
      });

      // Bank transactions (skip duplicates for receipts already added via bankReceipts)
      bankTxs.forEach((bt) => {
        if (
          bt.type === 'RECEIPT' &&
          ((bt.reference && addedReceiptRefs.has(bt.reference)) || bt.notes?.includes('Client Receipt:'))
        ) {
          return;
        }

        const isCredit = ['DEPOSIT', 'TRANSFER_FROM_PARTNER', 'RECEIPT'].includes(bt.type);
        const isWorkerPmt = bt.notes?.includes('Worker Payment:') || bt.notes?.includes('Payment ID:');
        let typeLabel = 'Bank Transaction';
        let entryType: 'RECEIPT' | 'TRANSFER_IN' | 'BANK_WITHDRAWAL' | 'TRANSFER_OUT' | 'EXPENSE' | 'BANK_DEPOSIT' | 'WORKER_PAYMENT' = 'BANK_DEPOSIT';
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
          title = bt.partner?.name ? `Receipt via ${bt.partner.name}` : (bt.notes || 'Bank Receipt');
        } else if (bt.type === 'TRANSFER_TO_PARTNER') {
          typeLabel = 'Bank Transfer to Partner';
          entryType = 'TRANSFER_OUT';
          title = `To Partner: ${bt.partner?.name || 'Partner'}`;
        } else if (bt.type === 'WITHDRAWAL') {
          typeLabel = 'Cash Withdrawal from Bank';
          entryType = 'BANK_WITHDRAWAL';
          title = bt.partner?.name ? `Withdrawn by ${bt.partner.name}` : 'Cash Withdrawal';
        } else if (bt.type === 'PAYMENT') {
          if (isWorkerPmt) {
            typeLabel = 'Worker Payment from Bank';
            entryType = 'WORKER_PAYMENT';
            title = bt.notes || bt.reference || 'Worker Payment from Bank';
          } else {
            typeLabel = 'Direct Bank Payment';
            entryType = 'EXPENSE';
            title = bt.notes || bt.reference || 'Bank Payment';
          }
        }

        ledgerEntries.push({
          id: `bt-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: entryType,
          entityType: isWorkerPmt ? 'Payment' : 'BankTransaction',
          model: 'BankTransaction',
          isWorkerPayment: isWorkerPmt,
          categoryLabel: typeLabel,
          title,
          subtitle: `${bt.bankAccount?.bankName} (${bt.bankAccount?.name})${bt.project?.name ? ` • ${bt.project.name}` : ''}`,
          credit: isCredit ? bt.amount : 0,
          debit: !isCredit ? bt.amount : 0,
          amount: bt.amount,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
          remarks: bt.notes,
          createdAt: bt.createdAt.toISOString(),
          isEdited: Boolean(bt.isEdited),
          editReason: bt.editReason,
          isDeleted: Boolean(bt.deletedAt),
          deletedAt: bt.deletedAt ? bt.deletedAt.toISOString() : null,
          deleteReason: bt.deleteReason,
          createdById: bt.createdById,
          partnerId: bt.partnerId,
        });
      });

      // Opening Balance & Balance Brought Forward calculations for Bank Account
      let targetBankAcc: any = null;
      if (specificBankId) {
        targetBankAcc = await prisma.bankAccount.findUnique({
          where: { id: specificBankId },
          select: { id: true, name: true, bankName: true, openingBalance: true, openingBalanceDate: true, openingBalanceNote: true },
        });
      }

      if (targetBankAcc) {
        const bankOpBal = targetBankAcc.openingBalance || 0;
        const bankOpDate = targetBankAcc.openingBalanceDate || null;
        const bankOpNote = targetBankAcc.openingBalanceNote || null;

        if (hasDateFilter && startDate) {
          const priorCutoff = dateFilter.gte;
          const [priorBTxs, priorBReceipts] = await Promise.all([
            prisma.bankTransaction.findMany({
              where: {
                organizationId: orgId,
                bankAccountId: specificBankId!,
                date: { lt: priorCutoff },
                deletedAt: null,
              },
              select: { type: true, amount: true },
            }),
            prisma.projectReceipt.aggregate({
              where: {
                organizationId: orgId,
                bankAccountId: specificBankId!,
                receivedIn: 'BANK',
                date: { lt: priorCutoff },
                deletedAt: null,
              },
              _sum: { amount: true },
            }),
          ]);

          let priorBankCredits = priorBReceipts._sum.amount || 0;
          let priorBankDebits = 0;
          priorBTxs.forEach((tx) => {
            if (['DEPOSIT', 'TRANSFER_FROM_PARTNER'].includes(tx.type)) {
              priorBankCredits += tx.amount;
            } else if (tx.type !== 'RECEIPT') {
              priorBankDebits += tx.amount;
            }
          });

          const priorBankBalance = Math.round((bankOpBal + priorBankCredits - priorBankDebits) * 100) / 100;

          ledgerEntries.push({
            id: `bbf-bank-${specificBankId}`,
            rawId: `bbf-bank-${specificBankId}`,
            date: priorCutoff.toISOString(),
            type: 'BALANCE_BROUGHT_FORWARD',
            entityType: 'BALANCE_BROUGHT_FORWARD',
            categoryLabel: 'Balance Brought Forward',
            title: 'Balance brought forward (Pichhla Bacha Balance)',
            subtitle: `Prior bank opening balance & transactions before ${priorCutoff.toLocaleDateString('en-IN')}`,
            credit: priorBankBalance > 0 ? priorBankBalance : 0,
            debit: priorBankBalance < 0 ? Math.abs(priorBankBalance) : 0,
            paymentMethod: 'ADJUSTMENT',
            reference: null,
            notes: null,
            isNonEditable: true,
            canEdit: false,
            canDelete: false,
          });
        } else if (bankOpBal !== 0) {
          ledgerEntries.push({
            id: `opbal-bank-${specificBankId}`,
            rawId: `opbal-bank-${specificBankId}`,
            date: (bankOpDate || new Date(2020, 0, 1)).toISOString(),
            type: 'OPENING_BALANCE',
            entityType: 'OPENING_BALANCE',
            categoryLabel: 'Opening Balance',
            title: 'Opening Balance (Shuruaati Balance)',
            subtitle: bankOpNote || 'Bank initial opening balance',
            credit: bankOpBal > 0 ? bankOpBal : 0,
            debit: bankOpBal < 0 ? Math.abs(bankOpBal) : 0,
            paymentMethod: 'OPENING',
            reference: null,
            notes: bankOpNote,
            isNonEditable: true,
            canEdit: false,
            canDelete: false,
          });
        }
      }
    } else {
      // Build Unified Organization Ledger for "All Partners & Owners" (partnerId === 'ALL')
      const allReceiptsWhere: any = {
        organizationId: orgId,
        ...deleteFilter,
      };
      const allTransfersWhere: any = {
        organizationId: orgId,
        ...deleteFilter,
      };
      const allExpensesWhere: any = {
        organizationId: orgId,
        ...deleteFilter,
      };
      const allBankTxsWhere: any = {
        organizationId: orgId,
        ...deleteFilter,
      };

      if (hasDateFilter) {
        allReceiptsWhere.date = dateFilter;
        allTransfersWhere.date = dateFilter;
        allExpensesWhere.date = dateFilter;
        allBankTxsWhere.date = dateFilter;
      }

      const [orgReceipts, orgTransfers, orgExpenses, orgBankTxs] = await Promise.all([
        prisma.projectReceipt.findMany({
          where: allReceiptsWhere,
          include: {
            project: { select: { id: true, name: true, projectCode: true } },
            site: { select: { id: true, name: true } },
            receivedBy: { select: { id: true, name: true } },
            bankAccount: { select: { id: true, name: true, bankName: true } },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.fundTransfer.findMany({
          where: allTransfersWhere,
          include: {
            fromUser: { select: { id: true, name: true, email: true } },
            toUser: { select: { id: true, name: true, email: true } },
            toWorker: { select: { id: true, name: true, workerCode: true } },
            project: { select: { id: true, name: true } },
            site: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.expense.findMany({
          where: allExpensesWhere,
          include: {
            project: { select: { id: true, name: true } },
            site: { select: { id: true, name: true } },
            walletOwner: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.bankTransaction.findMany({
          where: allBankTxsWhere,
          include: {
            bankAccount: { select: { id: true, name: true, bankName: true } },
            partner: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
        }),
      ]);

      // 1. Receipts (Wallet + Bank)
      orgReceipts.forEach((r) => {
        const isInBank = r.receivedIn === 'BANK';
        ledgerEntries.push({
          id: `rcpt-${r.id}`,
          rawId: r.id,
          date: r.date.toISOString(),
          type: 'RECEIPT',
          entityType: 'ProjectReceipt',
          model: 'ProjectReceipt',
          categoryLabel: isInBank ? 'Client Payment in Bank' : 'Client Payment in Wallet',
          title: r.clientName,
          subtitle: `${r.receivedBy?.name ? `Received by ${r.receivedBy.name}` : ''}${isInBank ? ` • Bank: ${r.bankAccount?.bankName || 'Bank'}` : ' • Cash'}${r.project?.name ? ` • ${r.project.name}` : ''}`,
          credit: r.amount,
          debit: 0,
          amount: r.amount,
          paymentMethod: r.paymentMethod,
          receivedIn: r.receivedIn || 'WALLET',
          reference: r.reference,
          notes: r.notes,
          remarks: r.notes,
          description: r.clientName,
          category: r.purpose || 'RUNNING_BILL',
          projectId: r.projectId,
          siteId: r.siteId,
          createdAt: r.createdAt.toISOString(),
          isEdited: Boolean(r.isEdited),
          editReason: r.editReason,
          isDeleted: Boolean(r.deletedAt),
          deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
          deleteReason: r.deleteReason,
          receivedById: r.receivedById,
        });
      });

      // 2. Fund Transfers (Transfers between partners, Supplier Payments & Worker Payments)
      orgTransfers.forEach((t) => {
        const isWorker = Boolean(t.toWorker || t.toWorkerId || t.linkedPaymentId || t.transferType === 'PARTNER_TO_WORKER' || t.transferType === 'SUPERVISOR_TO_WORKER');
        const isSupplier = t.transferType === 'PARTNER_TO_SUPPLIER' || (Boolean(t.purpose) && t.purpose.includes('Supplier Payment'));

        if (isWorker) {
          ledgerEntries.push({
            id: `trout-${t.id}`,
            rawId: t.id,
            date: t.date.toISOString(),
            type: 'WORKER_PAYMENT',
            entityType: 'Payment',
            model: 'FundTransfer',
            isWorkerPayment: true,
            workerId: t.toWorkerId,
            workerName: t.toWorker?.name,
            categoryLabel: `Worker Payment (${t.purpose || 'Labour'})`,
            title: `Worker: ${t.toWorker?.name || 'Worker'}`,
            subtitle: `Paid by ${t.fromUser?.name || 'Partner'}${t.project?.name ? ` • ${t.project.name}` : ''}`,
            credit: 0,
            debit: t.amount,
            amount: t.amount,
            paymentMethod: t.paymentMethod,
            reference: t.reference,
            notes: t.notes,
            remarks: t.notes,
            category: t.purpose,
            projectId: t.projectId,
            siteId: t.siteId,
            createdAt: t.createdAt.toISOString(),
            isEdited: Boolean(t.isEdited),
            editReason: t.editReason,
            isDeleted: Boolean(t.deletedAt),
            deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
            deleteReason: t.deleteReason,
            fromUserId: t.fromUserId,
            toWorkerId: t.toWorkerId,
            linkedPaymentId: t.linkedPaymentId,
          });
        } else if (isSupplier) {
          const supMatch = t.purpose?.match(/Supplier Payment:\s*(.+)$/i);
          const supplierName = supMatch ? supMatch[1].trim() : 'Supplier';
          ledgerEntries.push({
            id: `trout-${t.id}`,
            rawId: t.id,
            date: t.date.toISOString(),
            type: 'SUPPLIER_PAYMENT',
            entityType: 'SupplierPayment',
            model: 'FundTransfer',
            isWorkerPayment: false,
            categoryLabel: 'Supplier Payment',
            title: `Supplier Payment: ${supplierName}`,
            subtitle: `Paid by ${t.fromUser?.name || 'Partner'}${t.project?.name ? ` • ${t.project.name}` : ''}`,
            credit: 0,
            debit: t.amount,
            amount: t.amount,
            paymentMethod: t.paymentMethod,
            reference: t.reference,
            notes: t.notes,
            remarks: t.notes,
            category: 'SUPPLIER_PAYMENT',
            projectId: t.projectId,
            siteId: t.siteId,
            createdAt: t.createdAt.toISOString(),
            isEdited: Boolean(t.isEdited),
            editReason: t.editReason,
            isDeleted: Boolean(t.deletedAt),
            deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
            deleteReason: t.deleteReason,
            fromUserId: t.fromUserId,
          });
        } else {
          ledgerEntries.push({
            id: `tr-${t.id}`,
            rawId: t.id,
            date: t.date.toISOString(),
            type: 'TRANSFER',
            entityType: 'FundTransfer',
            model: 'FundTransfer',
            isWorkerPayment: false,
            categoryLabel: 'Partner Transfer',
            title: `${t.fromUser?.name || 'Partner'} ➔ ${t.toUser?.name || 'Partner'}`,
            subtitle: (t.purpose ? `${t.purpose}` : '') + (t.project?.name ? ` • ${t.project.name}` : ''),
            credit: 0,
            debit: 0,
            amount: t.amount,
            paymentMethod: t.paymentMethod,
            reference: t.reference,
            notes: t.notes,
            remarks: t.notes,
            category: t.purpose,
            projectId: t.projectId,
            siteId: t.siteId,
            createdAt: t.createdAt.toISOString(),
            isEdited: Boolean(t.isEdited),
            editReason: t.editReason,
            isDeleted: Boolean(t.deletedAt),
            deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
            deleteReason: t.deleteReason,
            fromUserId: t.fromUserId,
            toUserId: t.toUserId,
          });
        }
      });

      // 3. Site Expenses (wallet expenses, excluding bridge labour expenses)
      orgExpenses.forEach((e) => {
        const isLabourBridge = e.category === 'LABOUR' && Boolean(e.notes && e.notes.includes('Payment ID:'));
        if (isLabourBridge) return; // skip bridge row

        ledgerEntries.push({
          id: `exp-${e.id}`,
          rawId: e.id,
          date: e.date.toISOString(),
          type: 'EXPENSE',
          entityType: 'Expense',
          model: 'Expense',
          isWorkerPayment: false,
          categoryLabel: `Site Expense: ${formatCategoryLabel(e.category)}`,
          title: e.description || e.notes || e.category,
          subtitle: `${e.walletOwner?.name ? `Paid by ${e.walletOwner.name}` : ''}${e.project?.name ? ` • ${e.project.name}` : ''}`,
          credit: 0,
          debit: e.amount,
          amount: e.amount,
          paymentMethod: e.paymentMethod,
          reference: e.vendorName || null,
          notes: e.notes,
          remarks: e.notes,
          description: e.description,
          category: e.category,
          projectId: e.projectId,
          siteId: e.siteId,
          createdAt: e.createdAt.toISOString(),
          isEdited: Boolean(e.isEdited),
          editReason: e.editReason,
          isDeleted: Boolean(e.deletedAt),
          deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
          deleteReason: e.deleteReason,
          walletOwnerId: e.walletOwnerId,
          spentById: e.spentById,
        });
      });

      // 4. Bank Transactions (deposits, withdrawals, payments - skip duplicate receipts already in orgReceipts)
      const existingReceiptRefs = new Set(orgReceipts.map((r) => r.id));
      orgReceipts.forEach((r) => { if (r.reference) existingReceiptRefs.add(r.reference); });

      orgBankTxs.forEach((bt) => {
        if (bt.type === 'RECEIPT' && (existingReceiptRefs.has(bt.reference || '') || bt.notes?.includes('Client Receipt:'))) {
          return; // Skip duplicate bank receipt
        }

        const isWorkerPmt = bt.notes?.includes('Worker Payment:') || bt.notes?.includes('Payment ID:');
        let entryType: 'RECEIPT' | 'TRANSFER' | 'BANK_WITHDRAWAL' | 'BANK_DEPOSIT' | 'EXPENSE' | 'WORKER_PAYMENT' = 'BANK_DEPOSIT';
        let label = 'Bank Transaction';
        let title = bt.bankAccount?.bankName || 'Bank';
        let credit = 0;
        let debit = 0;

        if (bt.type === 'DEPOSIT') {
          entryType = 'BANK_DEPOSIT';
          label = 'Bank Cash Deposit';
          title = `Cash Deposited to ${bt.bankAccount?.bankName || 'Bank'}`;
          credit = bt.amount;
        } else if (bt.type === 'TRANSFER_FROM_PARTNER') {
          entryType = 'BANK_DEPOSIT';
          label = 'Partner Deposited Cash';
          title = `${bt.partner?.name || 'Partner'} ➔ Bank Deposit (${bt.bankAccount?.bankName || 'Bank'})`;
          credit = bt.amount;
        } else if (bt.type === 'TRANSFER_TO_PARTNER') {
          entryType = 'BANK_WITHDRAWAL';
          label = 'Bank Transfer to Partner';
          title = `Bank ➔ Transfer to ${bt.partner?.name || 'Partner'}`;
          debit = bt.amount;
        } else if (bt.type === 'WITHDRAWAL') {
          entryType = 'BANK_WITHDRAWAL';
          label = 'Bank Cash Withdrawal';
          title = `Withdrawn from ${bt.bankAccount?.bankName || 'Bank'}${bt.partner?.name ? ` by ${bt.partner.name}` : ''}`;
          debit = bt.amount;
        } else if (bt.type === 'PAYMENT') {
          if (isWorkerPmt) {
            entryType = 'WORKER_PAYMENT';
            label = 'Worker Payment from Bank';
            title = bt.notes || 'Worker Payment from Bank';
            debit = bt.amount;
          } else {
            entryType = 'EXPENSE';
            label = 'Direct Bank Site Payment';
            title = bt.notes || bt.reference || 'Bank Site Expense';
            debit = bt.amount;
          }
        } else if (bt.type === 'RECEIPT') {
          entryType = 'RECEIPT';
          label = 'Direct Bank Receipt';
          title = bt.notes || 'Bank Receipt';
          credit = bt.amount;
        }

        ledgerEntries.push({
          id: `bt-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: entryType,
          entityType: isWorkerPmt ? 'Payment' : 'BankTransaction',
          model: 'BankTransaction',
          isWorkerPayment: isWorkerPmt,
          categoryLabel: label,
          title,
          subtitle: `${bt.bankAccount?.bankName} (${bt.bankAccount?.name})${bt.project?.name ? ` • ${bt.project.name}` : ''}`,
          credit,
          debit,
          amount: bt.amount,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
          remarks: bt.notes,
          createdAt: bt.createdAt.toISOString(),
          isEdited: Boolean(bt.isEdited),
          editReason: bt.editReason,
          isDeleted: Boolean(bt.deletedAt),
          deletedAt: bt.deletedAt ? bt.deletedAt.toISOString() : null,
          deleteReason: bt.deleteReason,
          createdById: bt.createdById,
          partnerId: bt.partnerId,
        });
      });
    }

    // Sort chronologically: Opening Balance / Balance Brought Forward strictly first, then by date ascending
    ledgerEntries.sort((a, b) => {
      const isOpA = a.type === 'OPENING_BALANCE' || a.type === 'BALANCE_BROUGHT_FORWARD';
      const isOpB = b.type === 'OPENING_BALANCE' || b.type === 'BALANCE_BROUGHT_FORWARD';
      if (isOpA && !isOpB) return -1;
      if (!isOpA && isOpB) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    let runningAccumulator = 0;
    for (const entry of ledgerEntries) {
      if (entry.isDeleted) {
        entry.runningBalance = runningAccumulator;
        continue;
      }
      runningAccumulator = Math.round((runningAccumulator + (entry.credit || 0) - (entry.debit || 0)) * 100) / 100;
      entry.runningBalance = runningAccumulator;
    }

    // Place Opening Balance / Balance Brought Forward at the top (row 0), followed by transactions (newest first)
    const opEntries = ledgerEntries.filter(
      (e) => e.type === 'OPENING_BALANCE' || e.type === 'BALANCE_BROUGHT_FORWARD'
    );
    const nonOpEntries = ledgerEntries.filter(
      (e) => e.type !== 'OPENING_BALANCE' && e.type !== 'BALANCE_BROUGHT_FORWARD'
    );
    nonOpEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    ledgerEntries = [...opEntries, ...nonOpEntries];

    // Populate permission flags (canEdit, canDelete) on all entries
    const isOwnerUser = userRole === 'OWNER';
    const isManagerOrAccountant = ['MANAGER', 'ACCOUNTANT'].includes(userRole);
    const currentTimeMs = Date.now();

    for (const entry of ledgerEntries) {
      if (entry.isNonEditable) {
        entry.canEdit = false;
        entry.canDelete = false;
        continue;
      }
      const isMine =
        entry.createdById === session.userId ||
        entry.receivedById === session.userId ||
        entry.fromUserId === session.userId ||
        entry.walletOwnerId === session.userId ||
        entry.spentById === session.userId ||
        entry.partnerId === session.userId;
      const ageMs = currentTimeMs - new Date(entry.createdAt || entry.date).getTime();
      const isWithin48h = ageMs <= 48 * 60 * 60 * 1000;

      entry.canEdit = !entry.isDeleted && (isOwnerUser || (isManagerOrAccountant && isMine && isWithin48h));
      entry.canDelete = !entry.isDeleted && (isOwnerUser || (isManagerOrAccountant && isMine && isWithin48h));
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
          openingBalance: acc.openingBalance || 0,
          openingBalanceDate: acc.openingBalanceDate ? acc.openingBalanceDate.toISOString() : null,
          openingBalanceNote: acc.openingBalanceNote || null,
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
        select: { type: true, amount: true, notes: true },
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
      if (['DEPOSIT', 'TRANSFER_FROM_PARTNER'].includes(tx.type)) {
        bankPeriodInflow += tx.amount;
      } else if (tx.type === 'RECEIPT') {
        if (!tx.notes?.includes('Client Receipt:')) {
          bankPeriodInflow += tx.amount;
        }
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

    // 10. Fetch active suppliers for "Send Money to Supplier"
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: orgId, deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        mobile: true,
        gstNumber: true,
      },
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
      suppliers,
      purposeOptions,
      currentUserId: session.userId,
      userRole,
      overallExpensesByCategory: overallExpensesBreakdown.categories,
      overallExpensesTotal: overallExpensesBreakdown.total,
      selectedPartnerExpensesByCategory: targetPartnerId
        ? (partnersSummary.find((p) => p.id === targetPartnerId)?.expensesByCategory || [])
        : [],
      period,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      isSingleDay,
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
      toSupplierId,
      supplierId,
      billId,
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
      const effectiveSourceId = sourceType === 'PARTNER' ? effectivePartnerId : sourceBankAccount.id;

      const result = await prisma.$transaction(async (tx) => {
        return executeWorkerPayment({
          tx,
          organizationId: orgId,
          worker,
          sourceType,
          sourceId: effectiveSourceId,
          category: reasonText,
          amount: parsedAmount,
          date: txDate,
          method: paymentMethod,
          projectId: projectId || null,
          siteId: siteId || null,
          reference: reference?.trim() || null,
          remarks: enrichedNotes || null,
          session: {
            userId: session.userId,
            name: session.name,
            email: session.email,
            role: session.role,
          },
        });
      });

      // Record Audit Surveillance Entry with 48h Undo Window
      await recordAudit({
        organizationId: orgId,
        userId: session.userId,
        userName: session.name,
        userEmail: session.email,
        userRole: session.role,
        entityType: 'Payment',
        entityId: result.payment.id,
        action: 'CREATE',
        newValue: result.payment,
        details: formatAuditDetails('CREATE', 'Payment', {
          name: worker.name,
          amount: result.payment.amount,
          category: result.payment.transactionType,
        }),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
      });

      return NextResponse.json({
        success: true,
        payment: result.payment,
        transfer: result.fundTransfer,
        bankTx: result.bankTransaction,
        message: `Successfully paid ₹${parsedAmount.toLocaleString('en-IN')} to worker ${worker.name} for ${reasonText}!`,
      });
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

    // ==========================================
    // DESTINATION 5: PAYMENT TO SUPPLIER / VENDOR
    // ==========================================
    if (destinationType === 'TO_SUPPLIER') {
      const targetSupplierId = toSupplierId || supplierId;
      if (!targetSupplierId) {
        return NextResponse.json(
          { error: 'Please select the supplier to pay.' },
          { status: 400 }
        );
      }

      const supplier = await prisma.supplier.findFirst({
        where: { id: targetSupplierId, organizationId: orgId, deletedAt: null },
      });
      if (!supplier) {
        return NextResponse.json(
          { error: 'Selected supplier not found.' },
          { status: 404 }
        );
      }

      const effectiveSourceId = sourceType === 'PARTNER' ? effectivePartnerId : sourceBankAccount.id;

      const result = await prisma.$transaction(
        async (tx) => {
          return await executeSupplierPayment({
            tx,
            organizationId: orgId,
            supplier,
            billId: billId || null,
            sourceType,
            sourceId: effectiveSourceId,
            amount: parsedAmount,
            date: txDate,
            method: paymentMethod,
            projectId: projectId || null,
            siteId: siteId || null,
            reference: reference?.trim() || null,
            notes: enrichedNotes || null,
            session,
          });
        },
        { timeout: 30000, maxWait: 10000 }
      );

      // Record Audit Surveillance Entry with 48h Undo Window
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
      await recordAudit({
        organizationId: orgId,
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        entityType: 'SupplierPayment',
        entityId: result.supplierPayment.id,
        action: 'CREATE',
        newValue: result.supplierPayment,
        details: formatAuditDetails('CREATE', 'SupplierPayment', {
          name: supplier.name,
          amount: parsedAmount,
          category: `Paid via ${sourceType}`,
        }),
        ipAddress,
      });

      return NextResponse.json({
        success: true,
        payment: result.supplierPayment,
        transfer: result.fundTransfer,
        bankTx: result.bankTransaction,
        sourceBalanceAfter: result.sourceBalanceAfter,
        message: `Successfully paid ₹${parsedAmount.toLocaleString('en-IN')} to supplier ${supplier.name}!`,
      });
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
