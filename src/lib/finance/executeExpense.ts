import { Prisma } from '@prisma/client';

export interface ExecuteExpenseParams {
  tx: Prisma.TransactionClient;
  organizationId: string;
  sourceType: 'PARTNER' | 'BANK';
  sourceId: string; // partner userId or bankAccountId
  category: string;
  description: string;
  vendorName?: string | null;
  amount: number;
  date: Date;
  method?: string; // 'CASH', 'BANK', 'UPI', 'CHEQUE', etc.
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

export interface ExpenseExecutionResult {
  expense: any;
  bankTransaction?: any;
}

/**
 * Atomic expense executor.
 * Reusable for both single and bulk expense flows inside a Prisma transaction.
 * Creates:
 * 1. Expense row with walletOwnerId = selected partner (if PARTNER) or null (if BANK)
 * 2. BankTransaction (type: 'PAYMENT') if source is BANK
 */
export async function executeExpense(
  params: ExecuteExpenseParams
): Promise<ExpenseExecutionResult> {
  const {
    tx,
    organizationId,
    sourceType,
    sourceId,
    category,
    description,
    vendorName,
    amount,
    date,
    method = 'CASH',
    projectId,
    siteId,
    reference,
    notes,
    session,
  } = params;

  const normalizedCategory = category.trim() || 'MISCELLANEOUS';
  const normalizedDesc = description.trim() || normalizedCategory;
  const paymentMethod = sourceType === 'BANK' ? 'BANK' : method || 'CASH';
  const expenseNotes = notes || reference?.trim() || null;

  // Persist custom category to purposeOption if not exists (ignore duplicates safely)
  try {
    const catExists = await tx.purposeOption.findFirst({
      where: {
        organizationId,
        type: 'EXPENSE',
        name: normalizedCategory,
      },
    });
    if (!catExists) {
      await tx.purposeOption.create({
        data: {
          organizationId,
          type: 'EXPENSE',
          name: normalizedCategory,
          isSystem: false,
        },
      });
    }
  } catch (e) {
    // Ignore duplicate constraint or conflict
  }

  // 1. Create Expense record
  const expense = await tx.expense.create({
    data: {
      organizationId,
      projectId: projectId || null,
      siteId: siteId || null,
      date,
      category: normalizedCategory,
      description: normalizedDesc,
      amount,
      vendorName: vendorName?.trim() || null,
      paymentMethod,
      paidBy: session.name,
      spentById: session.userId,
      // If source is PARTNER, walletOwnerId debits that partner's wallet ONCE.
      // If source is BANK, walletOwnerId is null so partner wallet is NOT debited.
      walletOwnerId: sourceType === 'PARTNER' ? sourceId : null,
      notes: expenseNotes,
    },
  });

  // 2. If source is BANK, create matching BankTransaction
  let bankTransaction: any = null;
  if (sourceType === 'BANK') {
    bankTransaction = await tx.bankTransaction.create({
      data: {
        organizationId,
        bankAccountId: sourceId,
        type: 'PAYMENT',
        amount,
        date,
        projectId: projectId || null,
        reference: vendorName?.trim() || reference?.trim() || null,
        notes: `Expense: ${normalizedCategory} - ${normalizedDesc}${expenseNotes ? ` • ${expenseNotes}` : ''}`,
        createdById: session.userId,
      },
    });
  }

  return {
    expense,
    bankTransaction,
  };
}
