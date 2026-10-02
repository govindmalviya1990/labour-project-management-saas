import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { getStartOfDayUTC } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

// Category color palette for rich visual contrast
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
  MISCELLANEOUS: '#64748b', // slate
  OTHER: '#94a3b8', // light slate
};

const COLOR_PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#84cc16', '#a855f7', '#64748b'
];

function formatCategoryLabel(cat: string): string {
  if (!cat) return 'Other';
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
    LABOUR: 'Labour',
  };
  if (mapping[cat]) return mapping[cat];
  // If it's a custom reason (e.g. "Dinner" or "Site Cement"), return as is
  return cat.replace(/_/g, ' ');
}

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get('dateRange') || 'THIS_MONTH'; // TODAY, THIS_WEEK, THIS_MONTH, CUSTOM
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const partnerIdParam = searchParams.get('partnerId');
    const projectIdParam = searchParams.get('projectId');

    // 1. Calculate Date Filters
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (dateRange === 'TODAY') {
      startDate = getStartOfDayUTC(now);
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
    } else if (dateRange === 'THIS_WEEK') {
      // Last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === 'THIS_MONTH') {
      // 1st of current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (dateRange === 'CUSTOM') {
      if (startDateParam) {
        startDate = new Date(startDateParam);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }
      if (endDateParam) {
        endDate = new Date(endDateParam);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    // 2. Build Where Filter
    const where: any = {
      organizationId: orgId,
      deletedAt: null,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Role Scoping
    if (!isOwnerOrManager) {
      // Partner / Supervisor sees only their wallet or their assigned sites
      where.OR = [
        { walletOwnerId: session.userId },
        { spentById: session.userId },
      ];
    } else if (partnerIdParam && partnerIdParam !== 'ALL') {
      where.walletOwnerId = partnerIdParam;
    }

    if (projectIdParam && projectIdParam !== 'ALL') {
      where.projectId = projectIdParam;
    }

    // 3. Fetch expenses with relations
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        walletOwner: { select: { id: true, name: true } },
        spentBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    // 4. Compute Totals & Breakdowns
    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // a) Category breakdown
    const categoryAgg: Record<string, { rawCategory: string; label: string; amount: number; count: number }> = {};
    expenses.forEach((e) => {
      const rawCat = e.category || 'OTHER';
      const label = formatCategoryLabel(rawCat);
      if (!categoryAgg[label]) {
        categoryAgg[label] = { rawCategory: rawCat, label, amount: 0, count: 0 };
      }
      categoryAgg[label].amount += e.amount || 0;
      categoryAgg[label].count += 1;
    });

    const byCategory = Object.values(categoryAgg)
      .map((item, idx) => ({
        category: item.label,
        rawCategory: item.rawCategory,
        amount: Math.round(item.amount),
        count: item.count,
        percentage: totalAmount > 0 ? Number(((item.amount / totalAmount) * 100).toFixed(1)) : 0,
        color: CATEGORY_COLORS[item.rawCategory] || COLOR_PALETTE[idx % COLOR_PALETTE.length],
      }))
      .sort((a, b) => b.amount - a.amount);

    // b) Partner breakdown (only relevant for Owner/Manager or multi-partner views)
    const partnerAgg: Record<string, { partnerId: string; name: string; amount: number; count: number }> = {};
    expenses.forEach((e) => {
      const pId = e.walletOwnerId || e.spentById || 'unassigned';
      const pName = e.walletOwner?.name || e.spentBy?.name || 'Unassigned';
      if (!partnerAgg[pId]) {
        partnerAgg[pId] = { partnerId: pId, name: pName, amount: 0, count: 0 };
      }
      partnerAgg[pId].amount += e.amount || 0;
      partnerAgg[pId].count += 1;
    });

    const byPartner = Object.values(partnerAgg)
      .map((item, idx) => ({
        partnerId: item.partnerId,
        partnerName: item.name,
        amount: Math.round(item.amount),
        count: item.count,
        percentage: totalAmount > 0 ? Number(((item.amount / totalAmount) * 100).toFixed(1)) : 0,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      }))
      .sort((a, b) => b.amount - a.amount);

    // 5. Fetch available partners & projects for filter dropdowns
    const [partnersList, projectsList] = await Promise.all([
      isOwnerOrManager
        ? prisma.organizationUser.findMany({
            where: { organizationId: orgId, status: 'ACTIVE' },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        : Promise.resolve([]),
      prisma.project.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { id: true, name: true, projectCode: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const activePartners = partnersList
      .filter((m) => ['PARTNER', 'OWNER', 'MANAGER'].includes(normalizeRole(m.role)))
      .map((m) => ({ id: m.user.id, name: m.user.name }));

    return NextResponse.json({
      totalAmount,
      totalCount: expenses.length,
      byCategory,
      byPartner,
      filters: {
        dateRange,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        partnerId: partnerIdParam || 'ALL',
        projectId: projectIdParam || 'ALL',
      },
      partners: activePartners,
      projects: projectsList,
      isOwnerOrManager,
    });
  } catch (error: any) {
    console.error('Expense Analytics API error:', error);
    return NextResponse.json({ error: 'Failed to generate expense analytics' }, { status: 500 });
  }
}
