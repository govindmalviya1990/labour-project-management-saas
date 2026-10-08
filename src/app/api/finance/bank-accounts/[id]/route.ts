import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'ACCOUNTANT',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;

    const account = await prisma.bankAccount.findFirst({
      where: { id: params.id, organizationId: session.organizationId, deletedAt: null },
      include: {
        transactions: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
          take: 50,
          include: {
            partner: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    return NextResponse.json({ bankAccount: account });
  } catch (error: any) {
    console.error('Error fetching bank account:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch bank account' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'ACCOUNTANT',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const bankAccountId = params.id;

    const existing = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, bankName, accountLast4, openingBalance, isActive } = body;

    const updated = await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        bankName: bankName !== undefined ? bankName.trim() : existing.bankName,
        accountLast4:
          accountLast4 !== undefined
            ? accountLast4 ? accountLast4.trim().slice(-4) : null
            : existing.accountLast4,
        openingBalance:
          openingBalance !== undefined
            ? Math.max(0, parseFloat(openingBalance) || 0)
            : existing.openingBalance,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      bankAccount: updated,
      message: 'Bank account updated successfully',
    });
  } catch (error: any) {
    console.error('Bank account PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update bank account' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'ACCOUNTANT',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const bankAccountId = params.id;

    const existing = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // Soft delete
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Bank account removed successfully',
    });
  } catch (error: any) {
    console.error('Bank account DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete bank account' }, { status: 500 });
  }
}
