import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { executeWorkerPayment } from '@/lib/finance/executeWorkerPayment';
import { getPartnerWalletBalance } from '@/lib/finance/partnerWallet';
import { calculateWalletBalance, calculateBankBalance } from '@/lib/calculations';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

const bulkWorkerPaymentItemSchema = z.object({
  workerId: z.string().min(1, 'Worker ID is required'),
  category: z.string().min(1, 'Payment category is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  remarks: z.string().optional(),
});

const bulkWorkerPaymentSchema = z.object({
  sourceType: z.enum(['PARTNER', 'BANK']),
  sourceId: z.string().min(1, 'Source account is required'),
  method: z.string().default('CASH'),
  date: z.string().min(1, 'Payment date is required'),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  items: z
    .array(bulkWorkerPaymentItemSchema)
    .min(1, 'At least one worker payment is required')
    .max(100, 'Maximum 100 payments per batch allowed'),
});

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const rawBody = await req.json();
    const validated = bulkWorkerPaymentSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid bulk payment data' },
        { status: 400 }
      );
    }

    const {
      sourceType,
      sourceId,
      method,
      date,
      projectId,
      siteId,
      reference,
      items,
    } = validated.data;

    // 1. Validate Date (not in the future in IST UTC+5:30)
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIST = nowIST.toISOString().split('T')[0];

    const txDate = new Date(date);
    if (isNaN(txDate.getTime())) {
      return NextResponse.json({ error: 'Invalid payment date' }, { status: 400 });
    }

    const inputDateIST = new Date(txDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const rawDateStr = date.includes('T') ? inputDateIST : date.split(' ')[0];
    if (rawDateStr > todayIST) {
      return NextResponse.json(
        { error: `Payment date cannot be in the future (Today IST: ${todayIST})` },
        { status: 400 }
      );
    }

    // 2. Fetch and Validate all Workers belong to Organization
    const uniqueWorkerIds = Array.from(new Set(items.map((i) => i.workerId)));
    const workers = await prisma.worker.findMany({
      where: {
        id: { in: uniqueWorkerIds },
        organizationId: orgId,
        deletedAt: null,
      },
      select: { id: true, name: true, workerCode: true },
    });

    const workersMap = new Map<string, { id: string; name: string; workerCode?: string }>(
      workers.map((w) => [w.id, w])
    );

    for (const item of items) {
      if (!workersMap.has(item.workerId)) {
        return NextResponse.json(
          { error: `Worker (${item.workerId}) not found in your organization.` },
          { status: 404 }
        );
      }
    }

    // 3. Block Duplicate Worker in the Same Category
    const seenWorkerCategories = new Set<string>();
    for (const item of items) {
      const normalizedCat = item.category.trim().toLowerCase();
      const key = `${item.workerId}___${normalizedCat}`;
      if (seenWorkerCategories.has(key)) {
        const worker = workersMap.get(item.workerId);
        return NextResponse.json(
          {
            error: `Duplicate payment entry for worker "${worker?.name || item.workerId}" under category "${item.category}". Same worker cannot appear twice under the same category in a single batch.`,
          },
          { status: 400 }
        );
      }
      seenWorkerCategories.add(key);
    }

    // 4. Atomic Transaction: Validate Fresh Source Balance & Execute All Payments in ONE prisma.$transaction
    const totalAmount = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    const executionResults = await prisma.$transaction(async (tx) => {
      // 4a. Fresh Source Account & Balance Verification inside Transaction
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
            `Insufficient wallet balance for ${partnerMembership.user.name}. Available: ₹${walletCalc.balance.toLocaleString('en-IN')}, Required: ₹${totalAmount.toLocaleString('en-IN')}`
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
          const err = new Error('Source bank account not found.');
          (err as any).statusCode = 404;
          throw err;
        }

        const [
          depositsAgg,
          receiptsAgg,
          transferFromPartnerAgg,
          withdrawalsAgg,
          paymentsAgg,
          transferToPartnerAgg,
        ] = await Promise.all([
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

        const bankCalc = calculateBankBalance({
          openingBalance: bankAccount.openingBalance,
          totalDeposits: depositsAgg._sum.amount || 0,
          totalReceipts: receiptsAgg._sum.amount || 0,
          totalTransfersFromPartner: transferFromPartnerAgg._sum.amount || 0,
          totalWithdrawals: withdrawalsAgg._sum.amount || 0,
          totalPayments: paymentsAgg._sum.amount || 0,
          totalTransfersToPartner: transferToPartnerAgg._sum.amount || 0,
        });

        if (totalAmount > bankCalc.balance) {
          const err = new Error(
            `Insufficient bank balance in ${bankAccount.bankName} (${bankAccount.name}). Available: ₹${bankCalc.balance.toLocaleString('en-IN')}, Required: ₹${totalAmount.toLocaleString('en-IN')}`
          );
          (err as any).statusCode = 400;
          throw err;
        }
      }

      // 4b. Execute each payment sequentially inside the transaction
      const results = [];
      for (const item of items) {
        const worker = workersMap.get(item.workerId)!;
        const res = await executeWorkerPayment({
          tx,
          organizationId: orgId,
          worker,
          sourceType,
          sourceId,
          category: item.category,
          amount: item.amount,
          date: txDate,
          method,
          projectId: projectId || null,
          siteId: siteId || null,
          reference: reference || null,
          remarks: item.remarks || null,
          session: {
            userId: session.userId,
            name: session.name,
            email: session.email,
            role: session.role,
          },
        });
        results.push(res);
      }
      return results;
    });

    // 5. Record Audit Surveillance Entry per payment (for individual 48h Undo)
    for (const res of executionResults) {
      await recordAudit({
        organizationId: orgId,
        userId: session.userId,
        userName: session.name,
        userEmail: session.email,
        userRole: session.role,
        entityType: 'Payment',
        entityId: res.payment.id,
        action: 'CREATE',
        newValue: res.payment,
        details: formatAuditDetails('CREATE', 'Payment', {
          name: res.workerName,
          amount: res.payment.amount,
          category: res.payment.transactionType,
        }),
        ipAddress,
      });
    }

    return NextResponse.json({
      success: true,
      count: executionResults.length,
      totalAmount,
      payments: executionResults.map((r) => r.payment),
      message: `Successfully processed ${executionResults.length} payments totaling ₹${totalAmount.toLocaleString('en-IN')}!`,
    });
  } catch (error: any) {
    console.error('Error in bulk worker payments:', error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to process bulk worker payments' },
      { status }
    );
  }
}
