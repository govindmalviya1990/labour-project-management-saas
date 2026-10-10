import { NextResponse } from 'next/server';
import { checkRolePermission } from '@/lib/auth/session';
import { purgePermanentExpired } from '@/lib/audit/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Strictly OWNER can trigger permanent purge
    const auth = await checkRolePermission(['OWNER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const result = await purgePermanentExpired(orgId);

    return NextResponse.json({
      success: true,
      message: '48 घंटे से पुराने हटाए गए रिकॉर्ड स्थायी रूप से नष्ट कर दिए गए। (Expired records permanently purged)',
      ...result,
    });
  } catch (error: any) {
    console.error('Permanent purge error:', error);
    return NextResponse.json(
      { error: error?.message || 'स्थायी रूप से हटाने में विफल (Failed to purge expired records)' },
      { status: 500 }
    );
  }
}
