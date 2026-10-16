import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { recordAudit, formatAuditDetails } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const returnId = params.id;

    const body = await req.json().catch(() => ({}));
    const deleteReason = body.deleteReason?.trim() || 'Purchase return deleted';

    const existing = await prisma.purchaseReturn.findFirst({
      where: { id: returnId, organizationId: orgId, deletedAt: null },
      include: { supplier: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 });
    }

    const isOwner = session.role === 'OWNER';
    if (!isOwner) {
      if (existing.createdById !== session.userId) {
        return NextResponse.json({ error: 'Forbidden: You can only delete returns recorded by yourself.' }, { status: 403 });
      }
      const ageHours = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours > 48) {
        return NextResponse.json({ error: 'Forbidden: Returns older than 48 hours can only be deleted by an OWNER.' }, { status: 403 });
      }
    }

    const deleted = await prisma.purchaseReturn.update({
      where: { id: returnId },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
        deleteReason,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await recordAudit({
      organizationId: orgId,
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      entityType: 'PurchaseReturn',
      entityId: deleted.id,
      action: 'DELETE',
      oldValue: existing,
      newValue: deleted,
      details: formatAuditDetails('DELETE', 'PurchaseReturn', {
        name: existing.supplier.name,
        amount: existing.amount,
        category: existing.reason || 'Purchase Return',
      }),
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: 'Purchase return deleted successfully (48-hour Undo available)',
    });
  } catch (error: any) {
    console.error('Purchase Return DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete return' }, { status: 500 });
  }
}
