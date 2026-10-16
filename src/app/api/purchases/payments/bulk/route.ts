import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { bulkSupplierPaymentSchema } from '@/lib/validations/purchases';
import { executeSupplierPayment } from '@/lib/finance/executeSupplierPayment';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';
import { getPartnerWalletBalance } from '@/lib/finance/partnerWallet';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = bulkSupplierPaymentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid bulk supplier payment data' },
        { status: 400 }
      );
    }

    const { sourceType, sourceId, method, date, items } = validated.data;
    const paymentDate = new Date(date);
    const totalAmount = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;

    // 1. Pre-check role permission for partner wallet
    if (sourceType === 'PARTNER') {
      const isOwner = session.role === 'OWNER';
      if (!isOwner && sourceId !== session.userId) {
        return NextResponse.json(
          { error: 'Forbidden: Only OWNER can authorize bulk payments from another partner\'s wallet.' },
          { status: 403 }
        );
      }
    }

    // 2. Load suppliers
    const supplierIds = Array.from(new Set(items.map((i) => i.supplierId)));
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds }, organizationId: orgId, deletedAt: null },
    });
    const suppliersMap = new Map(suppliers.map((s) => [s.id, s]));

    for (const item of items) {
      if (!suppliersMap.has(item.supplierId)) {
        return NextResponse.json(
          { error: `Supplier with ID ${item.supplierId} not found in this organization.` },
          { status: 404 }
        );
      }
    }

    // 3. Atomic execution of all queued supplier payments in ONE transaction
    const executionResults = await prisma.$transaction(
      async (tx) => {
        // Fresh balance check on the total batch amount
        if (sourceType === 'PARTNER') {
          const partnerMembership = await tx.organizationUser.findFirst({
            where: { organizationId: orgId, userId: sourceId, status: 'ACTIVE' },
            include: { user: true },
          });
          if (!partnerMembership) {
            const err = new Error('Paying partner not found in this organization.');
            (err as any).statusCode = 404;
            throw err;
          }

          const walletCalc = await getPartnerWalletBalance(tx, orgId, sourceId);
          if (totalAmount > walletCalc.balance) {
            const err = new Error(
              `Insufficient wallet balance for ${partnerMembership.user.name}. Available: ₹${walletCalc.balance.toLocaleString('en-IN')}, Total Bulk Required: ₹${totalAmount.toLocaleString('en-IN')}. Batch aborted to prevent negative balance.`
            );
            (err as any).statusCode = 400;
            throw err;
          }
        } else {
          // Source is BANK
          const bankAccount = await tx.bankAccount.findFirst({
            where: { id: sourceId, organizationId: orgId, deletedAt: null },
          });
          if (!bankAccount) {
            const err = new Error('Selected bank account not found.');
            (err as any).statusCode = 404;
            throw err;
          }

          const [deposits, receipts, tfp, withdrawals, payments, ttp] = await Promise.all([
            tx.bankTransaction.aggregate({
              where: { bankAccountId: bankAccount.id, type: 'DEPOSIT', deletedAt: null },
              _sum: { amount: true },
            }),
            tx.bankTransaction.aggregate({
              where: { bankAccountId: bankAccount.id, type: 'RECEIPT', deletedAt: null },
              _sum: { amount: true },
            }),
            tx.bankTransaction.aggregate({
              where: { bankAccountId: bankAccount.id, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
              _sum: { amount: true },
            }),
            tx.bankTransaction.aggregate({
              where: { bankAccountId: bankAccount.id, type: 'WITHDRAWAL', deletedAt: null },
              _sum: { amount: true },
            }),
            tx.bankTransaction.aggregate({
              where: { bankAccountId: bankAccount.id, type: 'PAYMENT', deletedAt: null },
              _sum: { amount: true },
            }),
            tx.bankTransaction.aggregate({
              where: { bankAccountId: bankAccount.id, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
              _sum: { amount: true },
            }),
          ]);

          const opening = Number(bankAccount.openingBalance) || 0;
          const currentBankBalance =
            opening +
            (deposits._sum.amount || 0) +
            (receipts._sum.amount || 0) +
            (tfp._sum.amount || 0) -
            (withdrawals._sum.amount || 0) -
            (payments._sum.amount || 0) -
            (ttp._sum.amount || 0);

          if (totalAmount > currentBankBalance) {
            const err = new Error(
              `Insufficient bank balance in ${bankAccount.bankName} (${bankAccount.name}). Available: ₹${currentBankBalance.toLocaleString('en-IN')}, Total Bulk Required: ₹${totalAmount.toLocaleString('en-IN')}. Batch aborted to prevent negative balance.`
            );
            (err as any).statusCode = 400;
            throw err;
          }
        }

        // Execute each payment sequentially inside the transaction
        const results = [];
        for (const item of items) {
          const supplier = suppliersMap.get(item.supplierId)!;
          const res = await executeSupplierPayment({
            tx,
            organizationId: orgId,
            supplier,
            billId: item.billId || null,
            sourceType,
            sourceId,
            amount: item.amount,
            date: paymentDate,
            method,
            projectId: item.projectId || null,
            siteId: item.siteId || null,
            reference: item.reference?.trim() || null,
            notes: item.notes?.trim() || null,
            session,
          });
          results.push(res);
        }

        return results;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Record Audit Surveillance Entry for each payment
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    for (const res of executionResults) {
      await recordAudit({
        organizationId: orgId,
        userId: session.userId,
        userName: session.name,
        userRole: session.role,
        entityType: 'SupplierPayment',
        entityId: res.supplierPayment.id,
        action: 'CREATE',
        newValue: res.supplierPayment,
        details: formatAuditDetails('CREATE', 'SupplierPayment', {
          name: res.supplierName,
          amount: res.supplierPayment.amount,
          category: `Bulk Payment via ${sourceType}`,
        }),
        ipAddress,
      });
    }

    return NextResponse.json(
      {
        success: true,
        count: executionResults.length,
        totalAmount,
        message: `Successfully processed bulk payment of ₹${totalAmount.toLocaleString('en-IN')} across ${executionResults.length} suppliers!`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Bulk Supplier Payment POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process bulk supplier payments' },
      { status: error.statusCode || 500 }
    );
  }
}
