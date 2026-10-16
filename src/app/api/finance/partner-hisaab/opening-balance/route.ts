import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit/auditLogger';
import { getPartnerWalletBalance } from '@/lib/finance/partnerWallet';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const { partnerUserId, bankAccountId, amount, asOnDate, note } = body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
      return NextResponse.json({ error: 'Please enter a valid amount' }, { status: 400 });
    }

    const dateVal = asOnDate ? new Date(asOnDate) : new Date();
    if (isNaN(dateVal.getTime())) {
      return NextResponse.json({ error: 'Invalid as-on date' }, { status: 400 });
    }

    if (bankAccountId) {
      // 1. Bank Account Opening Balance
      const bank = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, organizationId: orgId, deletedAt: null },
      });
      if (!bank) {
        return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.bankAccount.update({
          where: { id: bank.id },
          data: {
            openingBalance: parsedAmount,
            openingBalanceDate: dateVal,
            openingBalanceNote: note?.trim() || null,
          },
        });

        await recordAudit({
          tx,
          organizationId: orgId,
          userId: session.userId,
          userName: session.name,
          userRole: 'OWNER',
          entityType: 'BankAccountOpeningBalance',
          entityId: bank.id,
          action: 'UPDATE',
          oldValue: {
            openingBalance: bank.openingBalance,
            openingBalanceDate: bank.openingBalanceDate,
            openingBalanceNote: bank.openingBalanceNote,
          },
          newValue: {
            openingBalance: parsedAmount,
            openingBalanceDate: dateVal,
            openingBalanceNote: note?.trim() || null,
          },
          details: `Owner ${session.name} updated opening balance for bank [${bank.bankName} - ${bank.name}] to ₹${parsedAmount}. Note: ${note || 'None'}`,
        });

        return res;
      });

      return NextResponse.json({ success: true, bankAccount: updated });
    }

    if (!partnerUserId) {
      return NextResponse.json({ error: 'Partner user ID is required' }, { status: 400 });
    }

    // 2. Partner User Opening Balance
    const orgUser = await prisma.organizationUser.findFirst({
      where: { organizationId: orgId, userId: partnerUserId },
      include: { user: true },
    });

    if (!orgUser) {
      return NextResponse.json({ error: 'Partner not found in organization' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.organizationUser.update({
        where: { id: orgUser.id },
        data: {
          openingBalance: parsedAmount,
          openingBalanceDate: dateVal,
          openingBalanceNote: note?.trim() || null,
        },
      });

      await recordAudit({
        tx,
        organizationId: orgId,
        userId: session.userId,
        userName: session.name,
        userRole: 'OWNER',
        entityType: 'PartnerOpeningBalance',
        entityId: orgUser.id,
        action: 'UPDATE',
        oldValue: {
          openingBalance: orgUser.openingBalance,
          openingBalanceDate: orgUser.openingBalanceDate,
          openingBalanceNote: orgUser.openingBalanceNote,
        },
        newValue: {
          openingBalance: parsedAmount,
          openingBalanceDate: dateVal,
          openingBalanceNote: note?.trim() || null,
        },
        details: `Owner ${session.name} updated opening balance for partner [${orgUser.user?.name || 'Partner'}] to ₹${parsedAmount}. Note: ${note || 'None'}`,
      });

      return res;
    });

    const freshWallet = await getPartnerWalletBalance(prisma, orgId, partnerUserId);

    return NextResponse.json({
      success: true,
      partner: updated,
      wallet: freshWallet,
    });
  } catch (error: any) {
    console.error('Error setting opening balance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update opening balance' },
      { status: 500 }
    );
  }
}
