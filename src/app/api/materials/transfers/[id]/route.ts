import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const transfer = await prisma.materialTransfer.findFirst({
      where: { id: params.id, organizationId: orgId },
      include: {
        material: true,
        sourceProject: true,
        destinationProject: true,
      },
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Material transfer not found' }, { status: 404 });
    }

    return NextResponse.json({ transfer });
  } catch (error: any) {
    console.error('Material transfer GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve material transfer' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const existing = await prisma.materialTransfer.findFirst({
      where: { id: params.id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Material transfer not found' }, { status: 404 });
    }

    await prisma.materialTransfer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Material transfer deleted successfully' });
  } catch (error: any) {
    console.error('Material transfer DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete material transfer' }, { status: 500 });
  }
}
