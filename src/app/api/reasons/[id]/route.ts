import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function sanitizeName(name: string): string {
  if (!name) return '';
  return name.replace(/<[^>]*>?/gm, '').trim();
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Only OWNER or PARTNER (or MANAGER) can rename
    const auth = await checkRolePermission(['OWNER', 'PARTNER', 'MANAGER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { id } = params;
    const body = await req.json();
    const { name } = body;

    const sanitized = sanitizeName(name);
    if (!sanitized || sanitized.length < 2 || sanitized.length > 50) {
      return NextResponse.json(
        { error: 'Reason name must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    const existingReason = await prisma.purposeOption.findUnique({
      where: { id },
    });

    if (!existingReason || existingReason.organizationId !== orgId || existingReason.deletedAt !== null) {
      return NextResponse.json({ error: 'Reason not found' }, { status: 404 });
    }

    if (existingReason.isSystem) {
      return NextResponse.json(
        { error: 'System reasons cannot be renamed or deleted' },
        { status: 403 }
      );
    }

    // Check duplicate name against other records
    const otherReasons = await prisma.purposeOption.findMany({
      where: {
        organizationId: orgId,
        type: existingReason.type,
        deletedAt: null,
        NOT: { id },
      },
    });

    const isDuplicate = otherReasons.some(
      (r) => r.name.toLowerCase() === sanitized.toLowerCase()
    );

    if (isDuplicate) {
      return NextResponse.json(
        { error: `Another reason with name "${sanitized}" already exists` },
        { status: 400 }
      );
    }

    const updated = await prisma.purposeOption.update({
      where: { id },
      data: { name: sanitized },
    });

    return NextResponse.json({ reason: updated });
  } catch (error: any) {
    console.error('Error updating reason:', error);
    return NextResponse.json({ error: error.message || 'Failed to update reason' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Only OWNER or PARTNER (or MANAGER) can delete
    const auth = await checkRolePermission(['OWNER', 'PARTNER', 'MANAGER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { id } = params;

    const existingReason = await prisma.purposeOption.findUnique({
      where: { id },
    });

    if (!existingReason || existingReason.organizationId !== orgId) {
      return NextResponse.json({ error: 'Reason not found' }, { status: 404 });
    }

    if (existingReason.isSystem) {
      return NextResponse.json(
        { error: 'System reasons cannot be renamed or deleted' },
        { status: 403 }
      );
    }

    // Soft delete: keep label intact for previous entries
    const deleted = await prisma.purposeOption.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return NextResponse.json({
      message: 'Reason deleted successfully',
      reason: deleted,
    });
  } catch (error: any) {
    console.error('Error deleting reason:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete reason' }, { status: 500 });
  }
}
