import prisma from '@/lib/db/prisma';

/**
 * Ensures all existing active worker payments have a corresponding Expense record.
 * This guarantees that worker payments/salaries are reflected across:
 * - The Dashboard (Total Expenses, Period Expenses, Today Expenses)
 * - Category-Wise Expense Breakdown (under 'LABOUR' / Labour & Workers)
 * - Expense Reports & Analytics
 */
export async function backfillWorkerPaymentsToExpenses(organizationId: string) {
  try {
    const activePayments = await prisma.payment.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        worker: { select: { name: true } },
      },
    });

    if (activePayments.length === 0) return;

    // Check which payments already have an expense created
    const existingExpenses = await prisma.expense.findMany({
      where: {
        organizationId,
        category: 'LABOUR',
        deletedAt: null,
      },
      select: { notes: true },
    });

    const existingPaymentIds = new Set<string>();
    existingExpenses.forEach((e) => {
      if (e.notes) {
        const match = e.notes.match(/Payment ID:\s*([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          existingPaymentIds.add(match[1]);
        }
      }
    });

    const toCreate = activePayments.filter((p) => !existingPaymentIds.has(p.id));

    if (toCreate.length > 0) {
      await prisma.$transaction(
        toCreate.map((p) =>
          prisma.expense.create({
            data: {
              organizationId,
              projectId: p.projectId || null,
              siteId: p.siteId || null,
              date: p.date,
              category: 'LABOUR',
              description: `Worker Payment: ${p.worker?.name || 'Worker'} (${p.transactionType})`,
              amount: p.amount,
              paymentMethod: p.paymentMethod || 'CASH',
              notes: `Payment ID: ${p.id}${p.notes ? ` - ${p.notes}` : ''}`,
            },
          })
        )
      );
    }
  } catch (error) {
    console.error('Error during worker payment to expense backfill:', error);
  }
}
