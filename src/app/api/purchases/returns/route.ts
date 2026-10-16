import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createPurchaseReturnSchema } from '@/lib/validations/purchases';
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

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };
    if (supplierId && supplierId !== 'ALL') where.supplierId = supplierId;
    if (billId && billId !== 'ALL') where.billId = billId;

    const returns = await prisma.purchaseReturn.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, mobile: true } },
        bill: { select: { id: true, billNumber: true, totalAmount: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { returnDate: 'desc' },
    });

    const totalAmount = returns.reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      returns,
      summary: { count: returns.length, totalAmount },
    });
  } catch (error: any) {
    console.error('Purchase Returns GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve returns' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createPurchaseReturnSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid return data' },
        { status: 400 }
      );
    }

    const data = validated.data;
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, organizationId: orgId, deletedAt: null },
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Selected supplier not found' }, { status: 404 });
    }

    const purchaseReturn = await prisma.purchaseReturn.create({
      data: {
        organizationId: orgId,
        supplierId: supplier.id,
        billId: data.billId || null,
        returnDate: new Date(data.returnDate),
        amount: data.amount,
        itemsJson: data.itemsJson || null,
        reason: data.reason.trim(),
        createdById: session.userId,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        bill: { select: { id: true, billNumber: true } },
      },
    });

    // Audit log
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'PurchaseReturn',
      entityId: purchaseReturn.id,
      action: 'CREATE',
      newValue: purchaseReturn,
      details: formatAuditDetails('CREATE', 'PurchaseReturn', {
        name: supplier.name,
        amount: data.amount,
        category: data.reason,
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      return: purchaseReturn,
      message: `Purchase return of ₹${data.amount.toLocaleString('en-IN')} recorded for ${supplier.name}. Supplier dues reduced.`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Purchase Return POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record purchase return' }, { status: 500 });
  }
}
