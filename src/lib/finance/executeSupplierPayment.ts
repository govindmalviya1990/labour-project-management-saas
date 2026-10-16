import { Prisma } from '@prisma/client';
import { getPartnerWalletBalance } from '@/lib/finance/partnerWallet';

export interface ExecuteSupplierPaymentParams {
  tx: Prisma.TransactionClient;
  organizationId: string;
  supplier: { id: string; name: string };
  billId?: string | null;
  sourceType: 'PARTNER' | 'BANK';
  sourceId: string; // userId if PARTNER, bankAccountId if BANK
  amount: number;
  date: Date;
  method?: string;
  projectId?: string | null;
  siteId?: string | null;
  reference?: string | null;
  notes?: string | null;
  session: {
    userId: string;
    name: string;
    email?: string;
    role: string;
  };
}

export interface SupplierPaymentExecutionResult {
  supplierPayment: any;
  fundTransfer?: any;
  bankTransaction?: any;
  supplierName: string;
  sourceBalanceAfter: number;
}

/**
 * Atomic supplier payment executor inside a Prisma transaction.
 * 
 * Rules enforced:
 * 1. Fresh balance verification inside $transaction.
 * 2. Blocks any payment that would make source wallet or bank negative.
 * 3. Role check: Only OWNER may pay from another partner's wallet.
 *    MANAGER / ACCOUNTANT only from their own wallet or a bank.
 * 4. Zero double-counting: Debits source exactly once via:
 *    - FundTransfer (transferType: 'PARTNER_TO_SUPPLIER') for PARTNER
 *    - BankTransaction (type: 'PAYMENT') for BANK
 *    Does NOT create an Expense row (the bill already counts in material cost).
 */
export async function executeSupplierPayment(
  params: ExecuteSupplierPaymentParams
): Promise<SupplierPaymentExecutionResult> {
  const {
    tx,
    organizationId,
    supplier,
    billId,
    sourceType,
    sourceId,
    amount,
    date,
    method = 'CASH',
    projectId,
    siteId,
    reference,
    notes,
    session,
  } = params;

  if (amount <= 0) {
    const err = new Error('Payment amount must be greater than zero.');
    (err as any).statusCode = 400;
    throw err;
  }

  // 1. Role Authorization Check for Partner Wallets
  if (sourceType === 'PARTNER') {
    const isOwner = session.role === 'OWNER';
    if (!isOwner && sourceId !== session.userId) {
      const err = new Error('Only OWNER can authorize payments from another partner\'s wallet. You may only pay from your own wallet or a bank account.');
      (err as any).statusCode = 403;
      throw err;
    }
  }

  // 2. Fresh Balance Verification & Negative Balance Rejection
  let sourceBalanceAfter = 0;

  if (sourceType === 'PARTNER') {
    const partnerMembership = await tx.organizationUser.findFirst({
      where: { organizationId, userId: sourceId, status: 'ACTIVE' },
      include: { user: true },
    });
    if (!partnerMembership) {
      const err = new Error('Paying partner not found in this organization.');
      (err as any).statusCode = 404;
      throw err;
    }

    const walletCalc = await getPartnerWalletBalance(tx, organizationId, sourceId);
    if (amount > walletCalc.balance) {
      const err = new Error(
        `Insufficient wallet balance for ${partnerMembership.user.name}. Available: ₹${walletCalc.balance.toLocaleString('en-IN')}, Required: ₹${amount.toLocaleString('en-IN')}. Payment blocked to prevent negative balance.`
      );
      (err as any).statusCode = 400;
      throw err;
    }
    sourceBalanceAfter = Math.round((walletCalc.balance - amount) * 100) / 100;
  } else {
    // Source is BANK
    const bankAccount = await tx.bankAccount.findFirst({
      where: { id: sourceId, organizationId, deletedAt: null },
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

    if (amount > currentBankBalance) {
      const err = new Error(
        `Insufficient bank balance in ${bankAccount.bankName} (${bankAccount.name}). Available: ₹${currentBankBalance.toLocaleString('en-IN')}, Required: ₹${amount.toLocaleString('en-IN')}. Payment blocked to prevent negative balance.`
      );
      (err as any).statusCode = 400;
      throw err;
    }
    sourceBalanceAfter = Math.round((currentBankBalance - amount) * 100) / 100;
  }

  // 3. Create Source Debit Record (FundTransfer for Partner, BankTransaction for Bank)
  let fundTransfer: any = null;
  let bankTransaction: any = null;

  const paymentMethod = sourceType === 'BANK' ? 'BANK' : method;
  const paymentNotes = notes?.trim() || `Supplier Payment: ${supplier.name}`;

  if (sourceType === 'PARTNER') {
    fundTransfer = await tx.fundTransfer.create({
      data: {
        organizationId,
        transferType: 'PARTNER_TO_SUPPLIER',
        fromUserId: sourceId,
        toUserId: null,
        toWorkerId: null,
        projectId: projectId || null,
        siteId: siteId || null,
        amount,
        date,
        paymentMethod,
        purpose: `Supplier Payment: ${supplier.name}`,
        reference: reference?.trim() || null,
        notes: paymentNotes,
      },
    });
  } else {
    bankTransaction = await tx.bankTransaction.create({
      data: {
        organizationId,
        bankAccountId: sourceId,
        type: 'PAYMENT',
        amount,
        date,
        projectId: projectId || null,
        reference: reference?.trim() || null,
        notes: `Supplier Payment: ${supplier.name}${notes ? ` • ${notes}` : ''}`,
        createdById: session.userId,
      },
    });
  }

  // 4. Create SupplierPayment record linking the debit
  const supplierPayment = await tx.supplierPayment.create({
    data: {
      organizationId,
      supplierId: supplier.id,
      billId: billId || null,
      date,
      amount,
      method: paymentMethod,
      sourceType,
      sourceId,
      fundTransferId: fundTransfer?.id || null,
      bankTransactionId: bankTransaction?.id || null,
      reference: reference?.trim() || null,
      notes: notes?.trim() || null,
      projectId: projectId || null,
      siteId: siteId || null,
      createdById: session.userId,
    },
    include: {
      supplier: { select: { id: true, name: true, mobile: true } },
      bill: { select: { id: true, billNumber: true, totalAmount: true } },
    },
  });

  return {
    supplierPayment,
    fundTransfer,
    bankTransaction,
    supplierName: supplier.name,
    sourceBalanceAfter,
  };
}
