import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updatePurchaseBillSchema } from '@/lib/validations/purchases';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';
import { allocateBillsFIFO } from '@/lib/supplierBalance';

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
    const billId = params.id;

    const bill = await prisma.purchaseBill.findFirst({
      where: { id: billId, organizationId: orgId, deletedAt: null },
      include: {
        supplier: true,
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: true,
        payments: { where: { deletedAt: null } },
        returns: { where: { deletedAt: null } },
      },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Purchase bill not found' }, { status: 404 });
    }

    const { allocatedBills } = allocateBillsFIFO([bill], bill.payments, bill.returns);
    const allocated = allocatedBills[0];

    return NextResponse.json({
      bill: {
        ...bill,
        derivedPaidAmount: allocated ? allocated.paidAmount : 0,
        derivedReturnAmount: allocated ? allocated.returnAmount : 0,
        derivedNetDue: allocated ? allocated.netDue : bill.totalAmount,
        derivedStatus: allocated ? allocated.status : bill.status,
      },
    });
  } catch (error: any) {
    console.error('Purchase Bill GET by ID error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve bill' }, { status: 500 });
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
    const billId = params.id;

    const body = await req.json();
    const validated = updatePurchaseBillSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid bill update data' },
        { status: 400 }
      );
    }

    const existing = await prisma.purchaseBill.findFirst({
      where: { id: billId, organizationId: orgId, deletedAt: null },
      include: { items: true, payments: { where: { deletedAt: null } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Purchase bill not found' }, { status: 404 });
    }

    // Permission enforcement: OWNER anything, MANAGER/ACCOUNTANT own entries within 48h
    const isOwner = session.role === 'OWNER';
    if (!isOwner) {
      if (existing.createdById !== session.userId) {
        return NextResponse.json(
          { error: 'Forbidden: You can only edit purchase bills created by yourself.' },
          { status: 403 }
        );
      }
      const ageHours = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours > 48) {
        return NextResponse.json(
          { error: 'Forbidden: Purchase bills older than 48 hours can only be modified by an OWNER.' },
          { status: 403 }
        );
      }
    }

    const data = validated.data;

    // Atomic update of bill and items
    const updatedBill = await prisma.$transaction(async (tx) => {
      // If new items provided, replace items
      if (data.items && data.items.length > 0) {
        await tx.purchaseItem.deleteMany({ where: { billId } });
        await tx.purchaseItem.createMany({
          data: data.items.map((item) => ({
            organizationId: orgId,
            billId,
            materialId: item.materialId || null,
            materialName: item.materialName.trim(),
            quantity: item.quantity,
            unit: item.unit.trim(),
            rate: item.rate,
            amount: Math.round(item.quantity * item.rate * 100) / 100,
          })),
        });
      }

      return await tx.purchaseBill.update({
        where: { id: billId },
        data: {
          billDate: data.billDate ? new Date(data.billDate) : undefined,
          billNumber: data.billNumber !== undefined ? data.billNumber?.trim() || null : undefined,
          projectId: data.projectId !== undefined ? data.projectId || null : undefined,
          siteId: data.siteId !== undefined ? data.siteId || null : undefined,
          vehicleNumber: data.vehicleNumber !== undefined ? data.vehicleNumber?.trim() || null : undefined,
          receivedBy: data.receivedBy !== undefined ? data.receivedBy?.trim() || null : undefined,
          notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
          attachmentUrl: data.attachmentUrl !== undefined ? data.attachmentUrl : undefined,
          subtotal: data.subtotal !== undefined ? data.subtotal : undefined,
          gstAmount: data.gstAmount !== undefined ? data.gstAmount : undefined,
          transportCharges: data.transportCharges !== undefined ? data.transportCharges : undefined,
          discount: data.discount !== undefined ? data.discount : undefined,
          totalAmount: data.totalAmount !== undefined ? data.totalAmount : undefined,
          isEdited: true,
          editReason: data.editReason?.trim() || 'Purchase bill details edited',
        },
        include: { items: true, supplier: true, project: true },
      });
    });

    // Record Audit Surveillance Entry
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'PurchaseBill',
      entityId: updatedBill.id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updatedBill,
      details: formatAuditDetails('UPDATE', 'PurchaseBill', {
        name: updatedBill.supplier.name,
        amount: updatedBill.totalAmount,
        category: `Bill #${updatedBill.billNumber || updatedBill.id.slice(-6)}`,
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      bill: updatedBill,
      message: 'Purchase bill updated successfully',
    });
  } catch (error: any) {
    console.error('Purchase Bill PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update purchase bill' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const billId = params.id;

    const body = await req.json().catch(() => ({}));
    const deleteReason = body.deleteReason?.trim() || 'Purchase bill soft-deleted';

    const existing = await prisma.purchaseBill.findFirst({
      where: { id: billId, organizationId: orgId, deletedAt: null },
      include: {
        supplier: true,
        payments: { where: { deletedAt: null } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Purchase bill not found' }, { status: 404 });
    }

    // Role check: OWNER anything, MANAGER/ACCOUNTANT own entries within 48h
    const isOwner = session.role === 'OWNER';
    if (!isOwner) {
      if (existing.createdById !== session.userId) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete purchase bills created by yourself.' },
          { status: 403 }
        );
      }
      const ageHours = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours > 48) {
        return NextResponse.json(
          { error: 'Forbidden: Purchase bills older than 48 hours can only be deleted by an OWNER.' },
          { status: 403 }
        );
      }
    }

    // If bill has linked active payments, reject deletion until payments are unlinked or deleted
    if (existing.payments && existing.payments.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete bill #${existing.billNumber || existing.id.slice(-6)} because it has ${existing.payments.length} active payments linked to it. Please delete or reassign those payments first.`,
        },
        { status: 400 }
      );
    }

    // Soft delete
    const deleted = await prisma.purchaseBill.update({
      where: { id: billId },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
        deleteReason,
      },
    });

    // Record Audit Surveillance Entry
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'PurchaseBill',
      entityId: deleted.id,
      action: 'DELETE',
      oldValue: existing,
      newValue: deleted,
      details: formatAuditDetails('DELETE', 'PurchaseBill', {
        name: existing.supplier.name,
        amount: existing.totalAmount,
        category: `Bill #${existing.billNumber || existing.id.slice(-6)}`,
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: 'Purchase bill deleted successfully (48-hour Undo available)',
    });
  } catch (error: any) {
    console.error('Purchase Bill DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete purchase bill' }, { status: 500 });
  }
}
