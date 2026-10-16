import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { executeExpense } from '@/lib/finance/executeExpense';
import { getPartnerWalletBalance } from '@/lib/finance/partnerWallet';
import { calculateWalletBalance, calculateBankBalance } from '@/lib/calculations';
import { formatAuditDetails } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

const bulkExpenseItemSchema = z.object({
  category: z.string().min(1, 'Expense category is required'),
  description: z.string().optional().default(''),
  vendor: z.string().optional().nullable(),
  amount: z.number().positive('Amount must be greater than 0'),
});

const bulkExpenseSchema = z.object({
  sourceType: z.enum(['PARTNER', 'BANK']),
  sourceId: z.string().min(1, 'Source account is required'),
  method: z.string().default('CASH'),
  date: z.string().min(1, 'Expense date is required'),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  items: z
    .array(bulkExpenseItemSchema)
    .min(1, 'At least one expense item is required')
    .max(100, 'Maximum 100 expenses per batch allowed'),
});

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const userRole = normalizeRole(session.role);

    const rawBody = await req.json();
    const validated = bulkExpenseSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid bulk expense data' },
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

    // 1. Role Check: Only OWNER may spend from another partner's wallet
    if (sourceType === 'PARTNER') {
      if (sourceId !== session.userId && userRole !== 'OWNER') {
        return NextResponse.json(
          { error: "Only owners are permitted to record expenses from another partner's wallet." },
          { status: 403 }
        );
      }
    }

    // 2. Validate Date (not in the future in IST UTC+5:30)
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIST = nowIST.toISOString().split('T')[0];

    const txDate = new Date(date);
    if (isNaN(txDate.getTime())) {
      return NextResponse.json({ error: 'Invalid expense date' }, { status: 400 });
    }

    const inputDateIST = new Date(txDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const rawDateStr = date.includes('T') ? inputDateIST : date.split(' ')[0];
    if (rawDateStr > todayIST) {
      return NextResponse.json(
        { error: `Expense date cannot be in the future (Today IST: ${todayIST})` },
        { status: 400 }
      );
    }

    // 3. Validate description if category is custom/generic
    const GENERIC_CATEGORIES = ['miscellaneous', 'other', '__custom__'];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isGeneric = GENERIC_CATEGORIES.includes(item.category.trim().toLowerCase());
      if (isGeneric && !item.description?.trim()) {
        return NextResponse.json(
          { error: `Description is required for expense #${i + 1} under generic category "${item.category}".` },
          { status: 400 }
        );
      }
    }

    // 4. Atomic Transaction with fresh source balance check & row locking
    const totalAmount = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    const executionResults = await prisma.$transaction(
      async (tx) => {
        // 4a. Lock source row & fresh balance verification
        if (sourceType === 'PARTNER') {
          try {
            await tx.$queryRawUnsafe('SELECT id FROM "users" WHERE id = $1 FOR UPDATE', sourceId);
          } catch (e) {
            // Non-postgres / mock fallback
          }

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
          try {
            await tx.$queryRawUnsafe('SELECT id FROM "bank_accounts" WHERE id = $1 FOR UPDATE', sourceId);
          } catch (e) {
            // Non-postgres / mock fallback
          }

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

        // 4b. Execute each expense item sequentially inside the transaction
        const results = [];
        const now = new Date();
        const canUndoUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          try {
            const res = await executeExpense({
              tx,
              organizationId: orgId,
              sourceType,
              sourceId,
              category: item.category,
              description: item.description,
              vendorName: item.vendor || null,
              amount: item.amount,
              date: txDate,
              method,
              projectId: projectId || null,
              siteId: siteId || null,
              reference: reference || null,
              notes: reference || null,
              session: {
                userId: session.userId,
                name: session.name,
                email: session.email,
                role: session.role,
              },
            });

            // 4c. Create audit entry INSIDE the same transaction
            await tx.auditLog.create({
              data: {
                organizationId: orgId,
                userId: session.userId,
                userName: session.name,
                userEmail: session.email,
                userRole: session.role,
                entityType: 'Expense',
                entityId: res.expense.id,
                action: 'CREATE',
                newValue: JSON.stringify({
                  ...res.expense,
                  bankTransactionId: res.bankTransaction?.id || null,
                }),
                details: formatAuditDetails('CREATE', 'Expense', {
                  name: res.expense.description,
                  amount: res.expense.amount,
                  category: res.expense.category,
                }),
                ipAddress,
                canUndoUntil,
                status: 'ACTIVE',
              },
            });

            results.push(res);
          } catch (itemErr: any) {
            const err = new Error(
              `Failed to process expense item #${i + 1} (${item.category}): ${itemErr.message}`
            );
            (err as any).statusCode = 400;
            throw err;
          }
        }

        return results;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return NextResponse.json({
      success: true,
      count: executionResults.length,
      totalAmount,
      expenses: executionResults.map((r) => r.expense),
      message: `Successfully processed ${executionResults.length} expenses totaling ₹${totalAmount.toLocaleString('en-IN')}!`,
    });
  } catch (error: any) {
    console.error('Error in bulk expenses:', error);
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to process bulk expenses' },
      { status }
    );
  }
}
