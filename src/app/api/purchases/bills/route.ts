import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createPurchaseBillSchema } from '@/lib/validations/purchases';
import { executeSupplierPayment } from '@/lib/finance/executeSupplierPayment';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';
import { allocateBillsFIFO } from '@/lib/supplierBalance';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (supplierId && supplierId !== 'ALL') where.supplierId = supplierId;
    if (projectId && projectId !== 'ALL') where.projectId = projectId;

    if (startDate && endDate) {
      where.billDate = {
        gte: new Date(startDate),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { billNumber: { contains: q, mode: 'insensitive' } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
        { project: { name: { contains: q, mode: 'insensitive' } } },
        { notes: { contains: q, mode: 'insensitive' } },
        { items: { some: { materialName: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const bills = await prisma.purchaseBill.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, mobile: true, gstNumber: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items: true,
        payments: { where: { deletedAt: null } },
        returns: { where: { deletedAt: null } },
      },
      orderBy: { billDate: 'desc' },
    });

    // Compute derived live status for each bill using allocateBillsFIFO
    const billsWithAllocations = bills.map((bill) => {
      const { allocatedBills } = allocateBillsFIFO([bill], bill.payments, bill.returns);
      const allocated = allocatedBills[0];
      return {
        ...bill,
        derivedPaidAmount: allocated ? allocated.paidAmount : 0,
        derivedReturnAmount: allocated ? allocated.returnAmount : 0,
        derivedNetDue: allocated ? allocated.netDue : bill.totalAmount,
        derivedStatus: allocated ? allocated.status : bill.status,
      };
    });

    // Apply status filter if requested
    const filteredBills = status && status !== 'ALL'
      ? billsWithAllocations.filter((b) => b.derivedStatus === status)
      : billsWithAllocations;

    const totalBillsAmount = filteredBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPaidAmount = filteredBills.reduce((sum, b) => sum + b.derivedPaidAmount, 0);
    const totalDueAmount = filteredBills.reduce((sum, b) => sum + b.derivedNetDue, 0);

    return NextResponse.json({
      bills: filteredBills,
      summary: {
        totalBills: filteredBills.length,
        totalBillsAmount,
        totalPaidAmount,
        totalDueAmount,
      },
    });
  } catch (error: any) {
    console.error('Purchase Bills GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve purchase bills' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createPurchaseBillSchema.safeParse(body);

    if (!validated.success) {
      const err = validated.error.errors[0];
      const field = err?.path?.length ? `${err.path.join('.')}: ` : '';
      return NextResponse.json(
        { error: `${field}${err?.message || 'Invalid purchase bill data'}` },
        { status: 400 }
      );
    }

    const data = validated.data;
    const billDate = new Date(data.billDate);

    // Auto-calculate subtotal and totalAmount if not provided or to ensure arithmetic consistency
    const itemsSubtotal = data.items.reduce(
      (sum, it) => sum + (it.amount || Math.round(it.quantity * it.rate * 100) / 100),
      0
    );
    const subtotal = data.subtotal !== undefined ? data.subtotal : itemsSubtotal;
    const gstAmount = data.gstAmount ?? 0;
    const transportCharges = data.transportCharges ?? 0;
    const discount = data.discount ?? 0;
    const totalAmount = data.totalAmount !== undefined
      ? data.totalAmount
      : Math.max(0, Math.round((subtotal + gstAmount + transportCharges - discount) * 100) / 100);

    // Verify supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, organizationId: orgId, deletedAt: null },
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Selected supplier not found' }, { status: 404 });
    }

    // Atomic transaction: Create Bill, Items, and optional Pay Now payment
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Create PurchaseBill
        const bill = await tx.purchaseBill.create({
          data: {
            organizationId: orgId,
            supplierId: supplier.id,
            billDate,
            billNumber: data.billNumber?.trim() || null,
            projectId: data.projectId || null,
            siteId: data.siteId || null,
            vehicleNumber: data.vehicleNumber?.trim() || null,
            receivedBy: data.receivedBy?.trim() || null,
            notes: data.notes?.trim() || null,
            attachmentUrl: data.attachmentUrl || null,
            subtotal,
            gstAmount,
            transportCharges,
            discount,
            totalAmount,
            status: 'UNPAID', // Will be re-computed or updated if payNow
            createdById: session.userId,
            items: {
              create: data.items.map((item) => ({
                organizationId: orgId,
                materialId: item.materialId || null,
                materialName: item.materialName.trim(),
                quantity: item.quantity,
                unit: item.unit.trim(),
                rate: item.rate,
                amount: Math.round(item.quantity * item.rate * 100) / 100,
              })),
            },
          },
          include: {
            items: true,
            supplier: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        });

        // 2. Optional "Pay Now" flow in same transaction
        let executedPayment = null;
        if (data.payNow && data.payNow.amount > 0) {
          executedPayment = await executeSupplierPayment({
            tx,
            organizationId: orgId,
            supplier,
            billId: bill.id,
            sourceType: data.payNow.sourceType,
            sourceId: data.payNow.sourceId,
            amount: data.payNow.amount,
            date: billDate,
            method: data.payNow.method || 'CASH',
            projectId: data.projectId || null,
            siteId: data.siteId || null,
            reference: data.payNow.reference?.trim() || null,
            notes: `Paid at bill creation (#${bill.billNumber || bill.id.slice(-6)})`,
            session,
          });

          // Update bill status if fully paid
          if (data.payNow.amount >= bill.totalAmount) {
            await tx.purchaseBill.update({
              where: { id: bill.id },
              data: { status: 'PAID' },
            });
          } else {
            await tx.purchaseBill.update({
              where: { id: bill.id },
              data: { status: 'PARTIAL' },
            });
          }
        }

        return { bill, executedPayment };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Audit Log Entry
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'PurchaseBill',
      entityId: result.bill.id,
      action: 'CREATE',
      newValue: result.bill,
      details: formatAuditDetails('CREATE', 'PurchaseBill', {
        name: supplier.name,
        amount: result.bill.totalAmount,
        category: `Bill #${result.bill.billNumber || 'No-Number'}`,
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      bill: result.bill,
      payment: result.executedPayment,
      message: `Purchase bill of ₹${result.bill.totalAmount.toLocaleString('en-IN')} for ${supplier.name} saved successfully!`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Purchase Bill POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create purchase bill' },
      { status: error.statusCode || 500 }
    );
  }
}
