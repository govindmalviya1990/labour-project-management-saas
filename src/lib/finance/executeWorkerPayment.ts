import { Prisma } from '@prisma/client';

export interface ExecuteWorkerPaymentParams {
  tx: Prisma.TransactionClient;
  organizationId: string;
  worker: { id: string; name: string };
  sourceType: 'PARTNER' | 'BANK';
  sourceId: string;
  category: string;
  amount: number;
  date: Date;
  method?: string;
  projectId?: string | null;
  siteId?: string | null;
  reference?: string | null;
  remarks?: string | null;
  session: {
    userId: string;
    name: string;
    email?: string;
    role: string;
  };
}

export interface WorkerPaymentExecutionResult {
  payment: any;
  expense: any;
  fundTransfer?: any;
  bankTransaction?: any;
  workerName: string;
}

export function mapCategoryToTransactionType(category: string): 'SALARY' | 'ADVANCE' | 'PAYMENT' {
  const upper = (category || '').trim().toUpperCase();
  if (upper.includes('SALARY') || upper.includes('WAGE')) return 'SALARY';
  if (upper.includes('ADVANCE')) return 'ADVANCE';
  return 'PAYMENT';
}

/**
 * Atomic worker payment executor.
 * Reusable for both single and bulk payment flows inside a Prisma transaction.
 * Creates:
 * 1. Payment row
 * 2. 'LABOUR' Expense row (walletOwnerId: null to prevent double-debiting)
 * 3. FundTransfer (PARTNER) or BankTransaction (BANK) for source account debit
 */
export async function executeWorkerPayment(
  params: ExecuteWorkerPaymentParams
): Promise<WorkerPaymentExecutionResult> {
  const {
    tx,
    organizationId,
    worker,
    sourceType,
    sourceId,
    category,
    amount,
    date,
    method = 'CASH',
    projectId,
    siteId,
    reference,
    remarks,
    session,
  } = params;

  const txType = mapCategoryToTransactionType(category);
  const paymentMethod = sourceType === 'BANK' ? 'BANK' : method;
  const paymentNotes = remarks ? `${category} • ${remarks}` : category;

  // 1. Create Payment record
  const payment = await tx.payment.create({
    data: {
      organizationId,
      workerId: worker.id,
      projectId: projectId || null,
      siteId: siteId || null,
      date,
      transactionType: txType,
      amount,
      paymentMethod,
      reference: reference?.trim() || null,
      notes: paymentNotes,
    },
  });

  // 2. Create Expense ('LABOUR' category bridge)
  // walletOwnerId: null to avoid double-debiting partner wallet (FundTransfer handles wallet debit)
  const expense = await tx.expense.create({
    data: {
      organizationId,
      projectId: projectId || null,
      siteId: siteId || null,
      date,
      category: 'LABOUR',
      description: `Worker Payment: ${worker.name} (${category})`,
      amount,
      paidBy: session.name,
      spentById: session.userId,
      walletOwnerId: null,
      paymentMethod,
      notes: `Payment ID: ${payment.id}${remarks ? ` - ${remarks}` : ''}`,
    },
  });

  // 3. Source debit: FundTransfer (if PARTNER) or BankTransaction (if BANK)
  let fundTransfer: any = null;
  let bankTransaction: any = null;

  if (sourceType === 'PARTNER') {
    fundTransfer = await tx.fundTransfer.create({
      data: {
        organizationId,
        transferType: 'PARTNER_TO_WORKER',
        fromUserId: sourceId,
        toWorkerId: worker.id,
        linkedPaymentId: payment.id,
        projectId: projectId || null,
        siteId: siteId || null,
        amount,
        date,
        paymentMethod,
        purpose: category,
        reference: reference?.trim() || null,
        notes: remarks || `Payment to worker ${worker.name} (${category})`,
      },
    });

    // Link fundTransferId back to payment
    await tx.payment.update({
      where: { id: payment.id },
      data: { fundTransferId: fundTransfer.id },
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
        notes: `Worker Payment: ${worker.name} (${category}) • Payment ID: ${payment.id}${remarks ? ` • ${remarks}` : ''}`,
        createdById: session.userId,
      },
    });
  }

  return {
    payment,
    expense,
    fundTransfer,
    bankTransaction,
    workerName: worker.name,
  };
}
