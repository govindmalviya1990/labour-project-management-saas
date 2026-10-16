import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { allocateBillsFIFO } from '@/lib/supplierBalance';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const rawRange = searchParams.get('period') || searchParams.get('range') || 'MONTHLY';
    const range = rawRange.toUpperCase(); // TODAY, WEEKLY, MONTHLY, CUSTOM, ALL
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const supplierId = searchParams.get('supplierId');
    const projectId = searchParams.get('projectId');

    // Date range calculation
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (range === 'TODAY') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (range === 'WEEKLY') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (range === 'MONTHLY') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (range === 'CUSTOM' && startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
    }

    const billWhere: any = {
      organizationId: orgId,
      deletedAt: null,
    };
    if (supplierId && supplierId !== 'ALL') billWhere.supplierId = supplierId;
    if (projectId && projectId !== 'ALL') billWhere.projectId = projectId;
    if (startDate && endDate) {
      billWhere.billDate = { gte: startDate, lte: endDate };
    }

    const paymentWhere: any = {
      organizationId: orgId,
      deletedAt: null,
    };
    if (supplierId && supplierId !== 'ALL') paymentWhere.supplierId = supplierId;
    if (projectId && projectId !== 'ALL') paymentWhere.projectId = projectId;
    if (startDate && endDate) {
      paymentWhere.date = { gte: startDate, lte: endDate };
    }

    const [bills, payments, returns, items] = await Promise.all([
      prisma.purchaseBill.findMany({
        where: billWhere,
        include: {
          supplier: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, projectCode: true } },
          items: true,
          payments: { where: { deletedAt: null } },
          returns: { where: { deletedAt: null } },
        },
        orderBy: { billDate: 'desc' },
      }),
      prisma.supplierPayment.findMany({
        where: paymentWhere,
        include: {
          supplier: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.purchaseReturn.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(supplierId && supplierId !== 'ALL' ? { supplierId } : {}),
          ...(startDate && endDate ? { returnDate: { gte: startDate, lte: endDate } } : {}),
        },
        include: { supplier: { select: { id: true, name: true } } },
      }),
      prisma.purchaseItem.findMany({
        where: {
          organizationId: orgId,
          bill: billWhere,
        },
        include: {
          bill: {
            select: {
              billDate: true,
              supplier: { select: { name: true } },
              project: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    // 1. Supplier-Wise Aggregation
    const supplierMap = new Map<string, {
      id: string;
      name: string;
      billsCount: number;
      totalPurchased: number;
      totalPaid: number;
      totalReturns: number;
      netDue: number;
    }>();

    for (const b of bills) {
      const sId = b.supplierId;
      if (!supplierMap.has(sId)) {
        supplierMap.set(sId, {
          id: sId,
          name: b.supplier.name,
          billsCount: 0,
          totalPurchased: 0,
          totalPaid: 0,
          totalReturns: 0,
          netDue: 0,
        });
      }
      const entry = supplierMap.get(sId)!;
      entry.billsCount += 1;
      entry.totalPurchased = Math.round((entry.totalPurchased + b.totalAmount) * 100) / 100;
    }

    for (const p of payments) {
      const sId = p.supplierId;
      if (!supplierMap.has(sId)) {
        supplierMap.set(sId, {
          id: sId,
          name: p.supplier.name,
          billsCount: 0,
          totalPurchased: 0,
          totalPaid: 0,
          totalReturns: 0,
          netDue: 0,
        });
      }
      const entry = supplierMap.get(sId)!;
      entry.totalPaid = Math.round((entry.totalPaid + p.amount) * 100) / 100;
    }

    for (const r of returns) {
      const sId = r.supplierId;
      if (supplierMap.has(sId)) {
        const entry = supplierMap.get(sId)!;
        entry.totalReturns = Math.round((entry.totalReturns + r.amount) * 100) / 100;
      }
    }

    for (const entry of supplierMap.values()) {
      entry.netDue = Math.round((entry.totalPurchased - entry.totalReturns - entry.totalPaid) * 100) / 100;
    }

    const supplierWise = Array.from(supplierMap.values()).sort((a, b) => b.totalPurchased - a.totalPurchased);

    // 2. Material-Wise Aggregation
    const materialMap = new Map<string, {
      materialName: string;
      unit: string;
      totalQuantity: number;
      totalAmount: number;
      purchasesCount: number;
    }>();

    for (const itm of items) {
      const key = `${itm.materialName.trim().toLowerCase()}___${itm.unit.trim().toLowerCase()}`;
      if (!materialMap.has(key)) {
        materialMap.set(key, {
          materialName: itm.materialName,
          unit: itm.unit,
          totalQuantity: 0,
          totalAmount: 0,
          purchasesCount: 0,
        });
      }
      const entry = materialMap.get(key)!;
      entry.totalQuantity = Math.round((entry.totalQuantity + itm.quantity) * 100) / 100;
      entry.totalAmount = Math.round((entry.totalAmount + itm.amount) * 100) / 100;
      entry.purchasesCount += 1;
    }

    const materialWise = Array.from(materialMap.values())
      .map((m) => ({
        ...m,
        averageRate: m.totalQuantity > 0 ? Math.round((m.totalAmount / m.totalQuantity) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // 3. Project-Wise Aggregation
    const projectMap = new Map<string, {
      projectId: string;
      projectName: string;
      billsCount: number;
      totalPurchased: number;
      totalPaid: number;
    }>();

    for (const b of bills) {
      const pId = b.projectId || 'unassigned';
      const pName = b.project?.name || 'No Specific Project';
      if (!projectMap.has(pId)) {
        projectMap.set(pId, {
          projectId: pId,
          projectName: pName,
          billsCount: 0,
          totalPurchased: 0,
          totalPaid: 0,
        });
      }
      const entry = projectMap.get(pId)!;
      entry.billsCount += 1;
      entry.totalPurchased = Math.round((entry.totalPurchased + b.totalAmount) * 100) / 100;
    }

    for (const p of payments) {
      const pId = p.projectId || 'unassigned';
      if (projectMap.has(pId)) {
        const entry = projectMap.get(pId)!;
        entry.totalPaid = Math.round((entry.totalPaid + p.amount) * 100) / 100;
      }
    }

    const projectWise = Array.from(projectMap.values()).sort((a, b) => b.totalPurchased - a.totalPurchased);

    // 4. Detailed Flat Bills List with Allocated Status
    const detailedBills = bills.map((b) => {
      const { allocatedBills } = allocateBillsFIFO([b], b.payments, b.returns);
      const allocated = allocatedBills[0];
      return {
        id: b.id,
        billDate: b.billDate,
        billNumber: b.billNumber || '—',
        supplierName: b.supplier.name,
        projectName: b.project?.name || 'No Project',
        totalAmount: b.totalAmount,
        paidAmount: allocated ? allocated.paidAmount : 0,
        returnAmount: allocated ? allocated.returnAmount : 0,
        netDue: allocated ? allocated.netDue : b.totalAmount,
        status: allocated ? allocated.status : b.status,
        itemsCount: b.items.length,
      };
    });

    const totalPurchased = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalReturns = returns.reduce((sum, r) => sum + r.amount, 0);
    const netPayable = Math.round((totalPurchased - totalReturns - totalPaid) * 100) / 100;

    return NextResponse.json({
      summary: {
        totalBills: bills.length,
        totalPurchased,
        totalPaid,
        totalReturns,
        netPayable,
      },
      supplierWise,
      materialWise,
      projectWise,
      detailedBills,
    });
  } catch (error: any) {
    console.error('Purchases Reports GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate report' }, { status: 500 });
  }
}
