import { NextResponse } from 'next/server';
import { checkRolePermission } from '@/lib/auth/session';
import { undoAuditAction } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Strictly OWNER can trigger Undo / Revert
    const auth = await checkRolePermission(['OWNER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const auditId = params.id;

    const revertedAudit = await undoAuditAction({
      auditId,
      organizationId: orgId,
      ownerUserId: session.userId,
      ownerName: session.name,
    });

    return NextResponse.json({
      success: true,
      message: 'कार्रवाई सफलतापूर्वक पूर्ववत (Undo) कर दी गई है। (Action successfully reverted)',
      audit: revertedAudit,
    });
  } catch (error: any) {
    console.error('Audit undo error:', error);
    return NextResponse.json(
      { error: error?.message || 'कार्रवाई पूर्ववत करने में त्रुटि (Failed to undo action)' },
      { status: 400 }
    );
  }
}
