import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createSupplierPaymentSchema } from '@/lib/validations/purchases';
import { executeSupplierPayment } from '@/lib/finance/executeSupplierPayment';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const billId = searchParams.get('billId');
    const sourceType = searchParams.get('sourceType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (supplierId && supplierId !== 'ALL') where.supplierId = supplierId;
    if (billId && billId !== 'ALL') where.billId = billId;
    if (sourceType && sourceType !== 'ALL') where.sourceType = sourceType;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    const payments = await prisma.supplierPayment.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, mobile: true } },
        bill: { select: { id: true, billNumber: true, totalAmount: true } },
        fundTransfer: {
          select: {
            id: true,
            fromUserId: true,
            fromUser: { select: { id: true, name: true } },
            paymentMethod: true,
          },
        },
        bankTransaction: {
          select: {
            id: true,
            bankAccountId: true,
            bankAccount: { select: { id: true, bankName: true, name: true } },
          },
        },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      payments,
      summary: {
        count: payments.length,
        totalAmount,
      },
    });
  } catch (error: any) {
    console.error('Supplier Payments GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve payments' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createSupplierPaymentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid supplier payment data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const paymentDate = new Date(data.date);

    // Verify supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, organizationId: orgId, deletedAt: null },
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Selected supplier not found' }, { status: 404 });
    }

    // Atomic execution with balance check
    const result = await prisma.$transaction(
      async (tx) => {
        return await executeSupplierPayment({
          tx,
          organizationId: orgId,
          supplier,
          billId: data.billId || null,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          amount: data.amount,
          date: paymentDate,
          method: data.method,
          projectId: data.projectId || null,
          siteId: data.siteId || null,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
          session,
        });
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Record Audit Surveillance Entry
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
        amount: data.amount,
        category: `Payment via ${data.sourceType}`,
      }),
      ipAddress,
    });

    return NextResponse.json(
      {
        success: true,
        payment: result.supplierPayment,
        fundTransfer: result.fundTransfer,
        bankTransaction: result.bankTransaction,
        sourceBalanceAfter: result.sourceBalanceAfter,
        message: `Successfully paid ₹${data.amount.toLocaleString('en-IN')} to supplier ${supplier.name}!`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Supplier Payment POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record supplier payment' },
      { status: error.statusCode || 500 }
    );
  }
}
