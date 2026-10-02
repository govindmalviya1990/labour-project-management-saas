import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
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

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;

    const account = await prisma.bankAccount.findFirst({
      where: { id: params.id, organizationId: session.organizationId, deletedAt: null },
    });

    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, bankName, accountLast4, isActive } = body;

    const updated = await prisma.bankAccount.update({
      where: { id: params.id },
      data: {
        name: name !== undefined ? name.trim() : account.name,
        bankName: bankName !== undefined ? bankName.trim() : account.bankName,
        accountLast4: accountLast4 !== undefined ? accountLast4?.trim().slice(-4) : account.accountLast4,
        isActive: isActive !== undefined ? Boolean(isActive) : account.isActive,
      },
    });

    return NextResponse.json({ bankAccount: updated, message: 'Bank account updated successfully' });
  } catch (error: any) {
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: error.message || 'Failed to update bank account' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;

    const account = await prisma.bankAccount.findFirst({
      where: { id: params.id, organizationId: session.organizationId, deletedAt: null },
    });

    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // Soft delete bank account
    await prisma.bankAccount.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Bank account removed successfully' });
  } catch (error: any) {
    console.error('Error deleting bank account:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete bank account' }, { status: 500 });
  }
}
