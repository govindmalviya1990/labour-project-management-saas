import { NextResponse } from 'next/server';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { editHisaabEntry, deleteHisaabEntry } from '@/lib/finance/partnerHisaabEntryService';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'ACCOUNTANT',
      'PARTNER',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const { id } = await params;

    const body = await req.json();
    const { entityType, ...data } = body;

    if (!entityType) {
      return NextResponse.json(
        { error: 'Entity type is required (Payment, FundTransfer, Expense, ProjectReceipt, BankTransaction)' },
        { status: 400 }
      );
    }

    const sessionUser = {
      userId: session.userId,
      name: session.name,
      email: session.email,
      role: normalizeRole(session.role),
      organizationId: orgId,
    };

    const result = await editHisaabEntry({
      organizationId: orgId,
      session: sessionUser,
      entityType,
      entryId: id,
      data,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error editing hisaab entry:', error);
    const status = error.message?.includes('Forbidden') ? 403 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to edit transaction entry' },
      { status }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'ACCOUNTANT',
      'PARTNER',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const { id } = await params;

    const body = await req.json();
    const { entityType, deleteReason } = body;

    if (!entityType) {
      return NextResponse.json(
        { error: 'Entity type is required (Payment, FundTransfer, Expense, ProjectReceipt, BankTransaction)' },
        { status: 400 }
      );
    }

    if (!deleteReason || !deleteReason.trim()) {
      return NextResponse.json(
        { error: 'A reason is required to delete this entry' },
        { status: 400 }
      );
    }

    const sessionUser = {
      userId: session.userId,
      name: session.name,
      email: session.email,
      role: normalizeRole(session.role),
      organizationId: orgId,
    };

    const result = await deleteHisaabEntry({
      organizationId: orgId,
      session: sessionUser,
      entityType,
      entryId: id,
      deleteReason,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting hisaab entry:', error);
    const status = error.message?.includes('Forbidden') ? 403 : 400;
    return NextResponse.json(
      { error: error.message || 'Failed to delete transaction entry' },
      { status }
    );
  }
}
