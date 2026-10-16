import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updateSupplierPaymentSchema } from '@/lib/validations/purchases';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';
import { getPartnerWalletBalance } from '@/lib/finance/partnerWallet';

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
    const paymentId = params.id;

    const payment = await prisma.supplierPayment.findFirst({
      where: { id: paymentId, organizationId: orgId, deletedAt: null },
      include: {
        supplier: true,
        bill: true,
        fundTransfer: { include: { fromUser: { select: { id: true, name: true } } } },
        bankTransaction: { include: { bankAccount: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Supplier payment record not found' }, { status: 404 });
    }

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error('Supplier Payment GET by ID error:', error);
    return NextResponse.json({ error: error.message || 'Failed to retrieve payment' }, { status: 500 });
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
    const paymentId = params.id;

    const body = await req.json();
    const validated = updateSupplierPaymentSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid payment update data' },
        { status: 400 }
      );
    }

    const existing = await prisma.supplierPayment.findFirst({
      where: { id: paymentId, organizationId: orgId, deletedAt: null },
      include: {
        supplier: true,
        fundTransfer: true,
        bankTransaction: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Supplier payment not found' }, { status: 404 });
    }

    // Role check: OWNER anything, MANAGER/ACCOUNTANT own entries within 48h
    const isOwner = session.role === 'OWNER';
    if (!isOwner) {
      if (existing.createdById !== session.userId) {
        return NextResponse.json(
          { error: 'Forbidden: You can only edit payments recorded by yourself.' },
          { status: 403 }
        );
      }
      const ageHours = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours > 48) {
        return NextResponse.json(
          { error: 'Forbidden: Payments older than 48 hours can only be modified by an OWNER.' },
          { status: 403 }
        );
      }
    }

    const data = validated.data;
    const oldAmount = existing.amount;
    const newAmount = data.amount !== undefined ? data.amount : oldAmount;
    const diff = Math.round((newAmount - oldAmount) * 100) / 100;

    const updatedPayment = await prisma.$transaction(async (tx) => {
      // If payment increased, verify source balance can cover the extra debit
      if (diff > 0) {
        if (existing.sourceType === 'PARTNER') {
          const walletCalc = await getPartnerWalletBalance(tx, orgId, existing.sourceId);
          if (diff > walletCalc.balance) {
            const err = new Error(
              `Cannot increase payment by ₹${diff.toLocaleString('en-IN')}. Paying partner wallet balance is ₹${walletCalc.balance.toLocaleString('en-IN')}. Increase blocked to prevent negative balance.`
            );
            (err as any).statusCode = 400;
            throw err;
          }
        } else {
          // BANK source check
          const bankAccount = await tx.bankAccount.findFirst({
            where: { id: existing.sourceId, organizationId: orgId, deletedAt: null },
          });
          if (bankAccount) {
            const [deposits, receipts, tfp, withdrawals, payments, ttp] = await Promise.all([
              tx.bankTransaction.aggregate({ where: { bankAccountId: bankAccount.id, type: 'DEPOSIT', deletedAt: null }, _sum: { amount: true } }),
              tx.bankTransaction.aggregate({ where: { bankAccountId: bankAccount.id, type: 'RECEIPT', deletedAt: null }, _sum: { amount: true } }),
              tx.bankTransaction.aggregate({ where: { bankAccountId: bankAccount.id, type: 'TRANSFER_FROM_PARTNER', deletedAt: null }, _sum: { amount: true } }),
              tx.bankTransaction.aggregate({ where: { bankAccountId: bankAccount.id, type: 'WITHDRAWAL', deletedAt: null }, _sum: { amount: true } }),
              tx.bankTransaction.aggregate({ where: { bankAccountId: bankAccount.id, type: 'PAYMENT', deletedAt: null }, _sum: { amount: true } }),
              tx.bankTransaction.aggregate({ where: { bankAccountId: bankAccount.id, type: 'TRANSFER_TO_PARTNER', deletedAt: null }, _sum: { amount: true } }),
            ]);
            const currentBankBalance =
              (Number(bankAccount.openingBalance) || 0) +
              (deposits._sum.amount || 0) +
              (receipts._sum.amount || 0) +
              (tfp._sum.amount || 0) -
              (withdrawals._sum.amount || 0) -
              (payments._sum.amount || 0) -
              (ttp._sum.amount || 0);

            if (diff > currentBankBalance) {
              const err = new Error(
                `Cannot increase payment by ₹${diff.toLocaleString('en-IN')}. Available bank balance is ₹${currentBankBalance.toLocaleString('en-IN')}. Increase blocked to prevent negative balance.`
              );
              (err as any).statusCode = 400;
              throw err;
            }
          }
        }
      }

      // Sync linked FundTransfer or BankTransaction atomically
      if (existing.fundTransferId) {
        await tx.fundTransfer.update({
          where: { id: existing.fundTransferId },
          data: {
            amount: newAmount,
            date: data.date ? new Date(data.date) : undefined,
            reference: data.reference !== undefined ? data.reference?.trim() || null : undefined,
            notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
            isEdited: true,
            editReason: data.editReason?.trim() || 'Linked supplier payment edited',
          },
        });
      }

      if (existing.bankTransactionId) {
        await tx.bankTransaction.update({
          where: { id: existing.bankTransactionId },
          data: {
            amount: newAmount,
            date: data.date ? new Date(data.date) : undefined,
            reference: data.reference !== undefined ? data.reference?.trim() || null : undefined,
            notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
            isEdited: true,
            editReason: data.editReason?.trim() || 'Linked supplier payment edited',
          },
        });
      }

      return await tx.supplierPayment.update({
        where: { id: paymentId },
        data: {
          date: data.date ? new Date(data.date) : undefined,
          amount: newAmount,
          method: data.method !== undefined ? data.method : undefined,
          reference: data.reference !== undefined ? data.reference?.trim() || null : undefined,
          notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
          projectId: data.projectId !== undefined ? data.projectId || null : undefined,
          siteId: data.siteId !== undefined ? data.siteId || null : undefined,
          isEdited: true,
          editReason: data.editReason?.trim() || 'Payment details updated',
        },
        include: { supplier: true, bill: true },
      });
    });

    // Record Audit Surveillance Entry
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'SupplierPayment',
      entityId: updatedPayment.id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updatedPayment,
      details: formatAuditDetails('UPDATE', 'SupplierPayment', {
        name: existing.supplier.name,
        amount: updatedPayment.amount,
        category: `Payment via ${existing.sourceType}`,
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      payment: updatedPayment,
      message: 'Supplier payment updated successfully',
    });
  } catch (error: any) {
    console.error('Supplier Payment PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: error.statusCode || 500 });
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
    const paymentId = params.id;

    const body = await req.json().catch(() => ({}));
    const deleteReason = body.deleteReason?.trim() || 'Supplier payment deleted';

    const existing = await prisma.supplierPayment.findFirst({
      where: { id: paymentId, organizationId: orgId, deletedAt: null },
      include: {
        supplier: true,
        bill: true,
        fundTransfer: true,
        bankTransaction: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Supplier payment not found' }, { status: 404 });
    }

    // Role check: OWNER anything, MANAGER/ACCOUNTANT own entries within 48h
    const isOwner = session.role === 'OWNER';
    if (!isOwner) {
      if (existing.createdById !== session.userId) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete payments recorded by yourself.' },
          { status: 403 }
        );
      }
      const ageHours = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours > 48) {
        return NextResponse.json(
          { error: 'Forbidden: Payments older than 48 hours can only be deleted by an OWNER.' },
          { status: 403 }
        );
      }
    }

    const now = new Date();

    // Soft delete SupplierPayment AND linked FundTransfer/BankTransaction atomically!
    // This immediately refunds the partner wallet or bank account!
    const deleted = await prisma.$transaction(async (tx) => {
      if (existing.fundTransferId) {
        await tx.fundTransfer.update({
          where: { id: existing.fundTransferId },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: `Deleted with linked supplier payment #${paymentId}`,
          },
        });
      }

      if (existing.bankTransactionId) {
        await tx.bankTransaction.update({
          where: { id: existing.bankTransactionId },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: `Deleted with linked supplier payment #${paymentId}`,
          },
        });
      }

      return await tx.supplierPayment.update({
        where: { id: paymentId },
        data: {
          deletedAt: now,
          deletedById: session.userId,
          deleteReason,
        },
      });
    });

    // Record Audit Surveillance Entry
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'SupplierPayment',
      entityId: deleted.id,
      action: 'DELETE',
      oldValue: existing,
      newValue: deleted,
      details: formatAuditDetails('DELETE', 'SupplierPayment', {
        name: existing.supplier.name,
        amount: existing.amount,
        category: `Refunded to ${existing.sourceType}`,
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Payment of ₹${existing.amount.toLocaleString('en-IN')} deleted. Source ${existing.sourceType} balance refunded (48-hour Undo available).`,
    });
  } catch (error: any) {
    console.error('Supplier Payment DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete payment' }, { status: 500 });
  }
}
