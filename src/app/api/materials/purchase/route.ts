import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

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

    const body = await req.json();
    const {
      materialId,
      projectId,
      siteId,
      supplierId,
      supplierName,
      quantity,
      purchaseRate,
      date,
      paymentMethod = 'CASH',
      invoiceNumber,
      notes,
    } = body;

    if (!materialId || !projectId || !quantity || quantity <= 0 || purchaseRate === undefined || purchaseRate < 0 || !date) {
      return NextResponse.json(
        { error: 'Material, project, valid quantity, purchase rate, and date are required' },
        { status: 400 }
      );
    }

    const purchaseDate = new Date(date);
    const parsedQty = parseFloat(quantity);
    const parsedRate = parseFloat(purchaseRate);
    const totalCost = Math.round(parsedQty * parsedRate * 100) / 100;

    // Verify material
    const material = await prisma.material.findFirst({
      where: { id: materialId, organizationId: orgId, deletedAt: null },
    });

    if (!material) {
      return NextResponse.json({ error: 'Selected material not found' }, { status: 404 });
    }

    // Check Day Lock on date for current user's wallet
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: session.userId,
      date: purchaseDate,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'MaterialReceipt',
      entityId: 'NEW',
      action: 'UPDATE',
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    // Find or create supplier name
    let vendor = supplierName;
    if (supplierId && !vendor) {
      const sup = await prisma.supplier.findUnique({ where: { id: supplierId } });
      vendor = sup?.name;
    }

    // Atomic transaction: 1-Click Goods Purchase
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create MaterialReceipt (Increases Site Stock)
      const receipt = await tx.materialReceipt.create({
        data: {
          organizationId: orgId,
          materialId,
          projectId,
          siteId: siteId || null,
          supplierId: supplierId || null,
          purchasedById: session.userId,
          paymentMethod,
          date: purchaseDate,
          quantity: parsedQty,
          purchaseRate: parsedRate,
          totalCost,
          invoiceNumber: invoiceNumber?.trim() || null,
          notes: notes?.trim() || null,
        },
        include: {
          material: { select: { id: true, name: true, unit: true, category: true } },
          project: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
      });

      // 2. Create linked Expense (Debits cash wallet & increases project actual cost)
      const expense = await tx.expense.create({
        data: {
          organizationId: orgId,
          projectId,
          siteId: siteId || null,
          date: purchaseDate,
          category: 'GOODS_PURCHASE',
          description: `Material Purchase: ${material.name} (${parsedQty} ${material.unit} @ ₹${parsedRate})`,
          amount: totalCost,
          paidBy: session.name,
          walletOwnerId: session.userId,
          spentById: session.userId,
          receiptId: receipt.id,
          paymentMethod,
          vendorName: vendor || null,
          notes: notes?.trim() || null,
        },
      });

      return { receipt, expense };
    });

    return NextResponse.json(
      {
        success: true,
        receipt: result.receipt,
        expense: result.expense,
        message: `Purchased ${parsedQty} ${material.unit} ${material.name} for ₹${totalCost}. Site stock and cash book updated!`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unified goods purchase error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process goods purchase' }, { status: 500 });
  }
}
