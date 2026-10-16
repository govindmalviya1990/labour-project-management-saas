import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { computeSupplierBalance, allocateBillsFIFO } from '@/lib/supplierBalance';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const supplierId = params.id;

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId, deletedAt: null },
      include: {
        purchaseBills: {
          where: { deletedAt: null },
          include: {
            project: { select: { id: true, name: true } },
            items: true,
          },
          orderBy: { billDate: 'asc' },
        },
        supplierPayments: {
          where: { deletedAt: null },
          include: {
            fundTransfer: { include: { fromUser: { select: { id: true, name: true } } } },
            bankTransaction: { include: { bankAccount: { select: { id: true, name: true, bankName: true } } } },
            project: { select: { id: true, name: true } },
          },
          orderBy: { date: 'asc' },
        },
        purchaseReturns: {
          where: { deletedAt: null },
          include: { bill: { select: { id: true, billNumber: true } } },
          orderBy: { returnDate: 'asc' },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const billsTotal = supplier.purchaseBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const paymentsTotal = supplier.supplierPayments.reduce((sum, p) => sum + p.amount, 0);
    const returnsTotal = supplier.purchaseReturns.reduce((sum, r) => sum + r.amount, 0);

    const balanceTotals = computeSupplierBalance({
      openingBalance: supplier.openingBalance,
      billsTotal,
      returnsTotal,
      paymentsTotal,
    });

    const { allocatedBills, aging } = allocateBillsFIFO(
      supplier.purchaseBills,
      supplier.supplierPayments,
      supplier.purchaseReturns
    );

    // Build Chronological Running-Balance Statement
    interface StatementEntry {
      id: string;
      date: string;
      type: 'OPENING_BALANCE' | 'BILL' | 'PAYMENT' | 'RETURN';
      reference: string;
      description: string;
      project?: string | null;
      billAmount: number;    // Increases dues
      paidAmount: number;    // Decreases dues
      returnAmount: number;  // Decreases dues
      runningBalance: number;
      methodOrSource?: string | null;
      rawRecord?: any;
    }

    const statement: StatementEntry[] = [];
    let running = supplier.openingBalance || 0;

    // 1. Opening Balance Entry
    if (supplier.openingBalance !== 0 || supplier.openingBalanceDate) {
      statement.push({
        id: `opbal-${supplier.id}`,
        date: supplier.openingBalanceDate
          ? new Date(supplier.openingBalanceDate).toISOString()
          : new Date(supplier.createdAt).toISOString(),
        type: 'OPENING_BALANCE',
        reference: 'Opening Balance',
        description: supplier.openingBalanceNote || 'Initial dues carried forward',
        billAmount: supplier.openingBalance > 0 ? supplier.openingBalance : 0,
        paidAmount: supplier.openingBalance < 0 ? Math.abs(supplier.openingBalance) : 0,
        returnAmount: 0,
        runningBalance: running,
      });
    }

    // Combine all transactions into single timeline
    const timelineItems: Array<{
      date: Date;
      type: 'BILL' | 'PAYMENT' | 'RETURN';
      raw: any;
    }> = [];

    supplier.purchaseBills.forEach((b) => {
      timelineItems.push({ date: new Date(b.billDate), type: 'BILL', raw: b });
    });
    supplier.supplierPayments.forEach((p) => {
      timelineItems.push({ date: new Date(p.date), type: 'PAYMENT', raw: p });
    });
    supplier.purchaseReturns.forEach((r) => {
      timelineItems.push({ date: new Date(r.returnDate), type: 'RETURN', raw: r });
    });

    // Sort chronologically ascending
    timelineItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const item of timelineItems) {
      if (item.type === 'BILL') {
        const b = item.raw;
        running = Math.round((running + b.totalAmount) * 100) / 100;
        statement.push({
          id: `bill-${b.id}`,
          date: b.billDate.toISOString ? b.billDate.toISOString() : new Date(b.billDate).toISOString(),
          type: 'BILL',
          reference: b.billNumber ? `Bill #${b.billNumber}` : `Bill #${b.id.slice(-6)}`,
          description: b.notes || (b.items && b.items.length > 0 ? `${b.items.length} items purchased` : 'Material Purchase Bill'),
          project: b.project?.name || null,
          billAmount: b.totalAmount,
          paidAmount: 0,
          returnAmount: 0,
          runningBalance: running,
          rawRecord: b,
        });
      } else if (item.type === 'PAYMENT') {
        const p = item.raw;
        running = Math.round((running - p.amount) * 100) / 100;
        const sourceLabel =
          p.sourceType === 'PARTNER'
            ? `Partner Wallet (${p.fundTransfer?.fromUser?.name || 'Partner'})`
            : `Bank (${p.bankTransaction?.bankAccount?.bankName || 'Bank'})`;
        statement.push({
          id: `pay-${p.id}`,
          date: p.date.toISOString ? p.date.toISOString() : new Date(p.date).toISOString(),
          type: 'PAYMENT',
          reference: p.reference ? `Ref: ${p.reference}` : `Payment #${p.id.slice(-6)}`,
          description: p.notes || `Paid via ${sourceLabel}`,
          project: p.project?.name || null,
          billAmount: 0,
          paidAmount: p.amount,
          returnAmount: 0,
          runningBalance: running,
          methodOrSource: sourceLabel,
          rawRecord: p,
        });
      } else if (item.type === 'RETURN') {
        const r = item.raw;
        running = Math.round((running - r.amount) * 100) / 100;
        statement.push({
          id: `ret-${r.id}`,
          date: r.returnDate.toISOString ? r.returnDate.toISOString() : new Date(r.returnDate).toISOString(),
          type: 'RETURN',
          reference: r.bill?.billNumber ? `Return agst #${r.bill.billNumber}` : `Return #${r.id.slice(-6)}`,
          description: r.reason || 'Material returned to supplier',
          billAmount: 0,
          paidAmount: 0,
          returnAmount: r.amount,
          runningBalance: running,
          rawRecord: r,
        });
      }
    }

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        mobile: supplier.mobile,
        email: supplier.email,
        address: supplier.address,
        gstNumber: supplier.gstNumber,
        status: supplier.status,
        openingBalance: supplier.openingBalance,
        openingBalanceDate: supplier.openingBalanceDate,
        openingBalanceNote: supplier.openingBalanceNote,
      },
      totals: balanceTotals,
      statement,
      allocatedBills,
      aging,
    });
  } catch (error: any) {
    console.error('Supplier statement GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve supplier statement' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const supplierId = params.id;

    const body = await req.json();
    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: body.name !== undefined ? body.name.trim() : undefined,
        contactPerson: body.contactPerson !== undefined ? body.contactPerson?.trim() || null : undefined,
        mobile: body.mobile !== undefined ? body.mobile?.trim() || null : undefined,
        email: body.email !== undefined ? body.email?.trim() || null : undefined,
        address: body.address !== undefined ? body.address?.trim() || null : undefined,
        gstNumber: body.gstNumber !== undefined ? body.gstNumber?.trim() || null : undefined,
        status: body.status !== undefined ? body.status : undefined,
        openingBalance: body.openingBalance !== undefined ? Number(body.openingBalance) : undefined,
        openingBalanceDate: body.openingBalanceDate ? new Date(body.openingBalanceDate) : undefined,
        openingBalanceNote: body.openingBalanceNote !== undefined ? body.openingBalanceNote?.trim() || null : undefined,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'Supplier',
      entityId: updated.id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
      details: formatAuditDetails('UPDATE', 'Supplier', {
        name: updated.name,
        amount: updated.openingBalance,
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      supplier: updated,
      message: 'Supplier profile updated successfully',
    });
  } catch (error: any) {
    console.error('Supplier PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const supplierId = params.id;

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, organizationId: orgId, deletedAt: null },
      include: {
        purchaseBills: { where: { deletedAt: null } },
        supplierPayments: { where: { deletedAt: null } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    if (existing.purchaseBills.length > 0 || existing.supplierPayments.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete supplier "${existing.name}" because they have ${existing.purchaseBills.length} active bills and ${existing.supplierPayments.length} payments. Mark status as INACTIVE instead.`,
        },
        { status: 400 }
      );
    }

    const deleted = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'Supplier',
      entityId: deleted.id,
      action: 'DELETE',
      oldValue: existing,
      newValue: deleted,
      details: formatAuditDetails('DELETE', 'Supplier', { name: existing.name }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Supplier "${existing.name}" deleted successfully (48-hour Undo available).`,
    });
  } catch (error: any) {
    console.error('Supplier DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete supplier' }, { status: 500 });
  }
}
