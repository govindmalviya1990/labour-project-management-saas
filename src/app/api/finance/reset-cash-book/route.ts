import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/finance/reset-cash-book
 * Safely wipes all Cash Book transactions for the tenant:
 * - Project Receipts (Money In)
 * - Fund Transfers (Partner / Supervisor cash movement)
 * - Daily Expenses
 * - Daily Cash Closings & physical verifications
 * - Bank Transactions
 * 
 * Preserves:
 * - Projects & Sites
 * - Workers & Attendance
 * - Bank Account configs
 * - Organization users & settings
 * - Custom Reasons / Purpose options
 * 
 * Authorization: OWNER or PARTNER only.
 */
export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'PARTNER']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const [
      receipts,
      transfers,
      expenses,
      closings,
      bankTxs,
    ] = await prisma.$transaction([
      prisma.projectReceipt.deleteMany({ where: { organizationId: orgId } }),
      prisma.fundTransfer.deleteMany({ where: { organizationId: orgId } }),
      prisma.expense.deleteMany({ where: { organizationId: orgId } }),
      prisma.dailyClosing.deleteMany({ where: { organizationId: orgId } }),
      prisma.bankTransaction.deleteMany({ where: { organizationId: orgId } }),
    ]);

    // Record Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: auth.session.userId,
          entityType: 'CashBook',
          entityId: orgId,
          action: 'DELETE',
          newValue: JSON.stringify({
            action: 'RESET_CASH_BOOK',
            clearedBy: auth.session.name,
            role: auth.session.role,
            clearedCounts: {
              receipts: receipts.count,
              transfers: transfers.count,
              expenses: expenses.count,
              closings: closings.count,
              bankTransactions: bankTxs.count,
            },
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (auditErr) {
      console.warn('Failed to write audit log for Cash Book reset:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Cash Book successfully reset! All transactions have been cleared and wallet balances reset to ₹0.',
      cleared: {
        receipts: receipts.count,
        transfers: transfers.count,
        expenses: expenses.count,
        closings: closings.count,
        bankTransactions: bankTxs.count,
        total: receipts.count + transfers.count + expenses.count + closings.count + bankTxs.count,
      },
    });
  } catch (error: any) {
    console.error('Reset Cash Book error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset Cash Book' },
      { status: 500 }
    );
  }
}
