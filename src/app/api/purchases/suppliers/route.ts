import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createSupplierWithOpeningBalanceSchema } from '@/lib/validations/purchases';
import { computeSupplierBalance, allocateBillsFIFO } from '@/lib/supplierBalance';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (status && status !== 'ALL') where.status = status;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q, mode: 'insensitive' } },
        { gstNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        purchaseBills: {
          where: { deletedAt: null },
          select: { id: true, billNumber: true, billDate: true, totalAmount: true },
          orderBy: { billDate: 'desc' },
        },
        supplierPayments: {
          where: { deletedAt: null },
          select: { id: true, billId: true, amount: true, date: true },
          orderBy: { date: 'desc' },
        },
        purchaseReturns: {
          where: { deletedAt: null },
          select: { id: true, billId: true, amount: true, returnDate: true },
        },
        materials: { where: { deletedAt: null }, select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const supplierSummaries = suppliers.map((sup) => {
      const billsTotal = sup.purchaseBills.reduce((sum, b) => sum + b.totalAmount, 0);
      const paymentsTotal = sup.supplierPayments.reduce((sum, p) => sum + p.amount, 0);
      const returnsTotal = sup.purchaseReturns.reduce((sum, r) => sum + r.amount, 0);

      const bal = computeSupplierBalance({
        openingBalance: sup.openingBalance,
        billsTotal,
        returnsTotal,
        paymentsTotal,
      });

      const { aging } = allocateBillsFIFO(
        sup.purchaseBills,
        sup.supplierPayments,
        sup.purchaseReturns
      );

      const lastPurchase = sup.purchaseBills[0]?.billDate || null;
      const lastPayment = sup.supplierPayments[0]?.date || null;

      return {
        id: sup.id,
        name: sup.name,
        contactPerson: sup.contactPerson,
        mobile: sup.mobile,
        email: sup.email,
        address: sup.address,
        gstNumber: sup.gstNumber,
        status: sup.status,
        openingBalance: sup.openingBalance,
        openingBalanceDate: sup.openingBalanceDate,
        openingBalanceNote: sup.openingBalanceNote,
        totalPurchased: billsTotal,
        totalPaid: paymentsTotal,
        totalReturns: returnsTotal,
        remainingBalance: bal.remainingBalance,
        balanceStatus: bal.status,
        lastPurchaseDate: lastPurchase,
        lastPaymentDate: lastPayment,
        materialsCount: sup.materials.length,
        aging,
      };
    });

    const totalSuppliersPurchased = supplierSummaries.reduce((sum, s) => sum + s.totalPurchased, 0);
    const totalSuppliersPaid = supplierSummaries.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalSuppliersRemaining = supplierSummaries.reduce((sum, s) => sum + s.remainingBalance, 0);

    const overallAging = supplierSummaries.reduce(
      (acc, s) => ({
        bracket0To30: acc.bracket0To30 + s.aging.bracket0To30,
        bracket31To60: acc.bracket31To60 + s.aging.bracket31To60,
        bracket61To90: acc.bracket61To90 + s.aging.bracket61To90,
        bracket90Plus: acc.bracket90Plus + s.aging.bracket90Plus,
        totalDue: acc.totalDue + s.aging.totalDue,
      }),
      { bracket0To30: 0, bracket31To60: 0, bracket61To90: 0, bracket90Plus: 0, totalDue: 0 }
    );

    return NextResponse.json({
      suppliers: supplierSummaries,
      summary: {
        totalSuppliers: supplierSummaries.length,
        totalPurchased: totalSuppliersPurchased,
        totalPaid: totalSuppliersPaid,
        totalRemaining: totalSuppliersRemaining,
        overallAging,
      },
    });
  } catch (error: any) {
    console.error('Purchases Suppliers GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve suppliers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createSupplierWithOpeningBalanceSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid supplier data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const trimmedName = data.name.trim();
    const trimmedMobile = data.mobile?.trim() || null;

    // Duplicate check returning existing supplier if match found (name or mobile)
    const existing = await prisma.supplier.findFirst({
      where: {
        organizationId: orgId,
        deletedAt: null,
        OR: [
          { name: { equals: trimmedName, mode: 'insensitive' } },
          ...(trimmedMobile ? [{ mobile: trimmedMobile }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        supplier: existing,
        existing: true,
        message: `Supplier "${existing.name}" is already registered. Reusing existing profile.`,
      });
    }

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        name: trimmedName,
        contactPerson: data.contactPerson?.trim() || null,
        mobile: trimmedMobile,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        gstNumber: data.gstNumber?.trim() || null,
        status: data.status || 'ACTIVE',
        openingBalance: data.openingBalance || 0,
        openingBalanceDate: data.openingBalanceDate ? new Date(data.openingBalanceDate) : null,
        openingBalanceNote: data.openingBalanceNote?.trim() || null,
      },
    });

    // Record audit
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'Supplier',
      entityId: supplier.id,
      action: 'CREATE',
      newValue: supplier,
      details: formatAuditDetails('CREATE', 'Supplier', {
        name: supplier.name,
        amount: supplier.openingBalance,
        category: `Opening Bal: ₹${supplier.openingBalance}`,
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      supplier,
      message: `Supplier "${supplier.name}" registered successfully with opening balance ₹${supplier.openingBalance}!`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Purchases Supplier POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create supplier' }, { status: 500 });
  }
}
