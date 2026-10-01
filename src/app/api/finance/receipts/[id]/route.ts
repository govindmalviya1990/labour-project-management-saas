import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;

    const receipt = await prisma.projectReceipt.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      include: {
        project: { select: { id: true, name: true, projectCode: true, projectValue: true } },
        site: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    return NextResponse.json({ receipt });
  } catch (error: any) {
    console.error('Error fetching receipt:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch receipt' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const receipt = await prisma.projectReceipt.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const body = await req.json();

    // Check Day Lock on existing receipt date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: receipt.receivedById,
      date: receipt.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'ProjectReceipt',
      entityId: receipt.id,
      action: 'UPDATE',
      details: { oldAmount: receipt.amount, oldClient: receipt.clientName },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.projectReceipt.update({
        where: { id: params.id },
        data: {
          clientName: body.clientName !== undefined ? body.clientName.trim() : receipt.clientName,
          amount: body.amount !== undefined ? parseFloat(body.amount) : receipt.amount,
          date: body.date ? new Date(body.date) : receipt.date,
          paymentMethod: body.paymentMethod || receipt.paymentMethod,
          purpose: body.purpose || receipt.purpose,
          reference: body.reference !== undefined ? body.reference : receipt.reference,
          notes: body.notes !== undefined ? body.notes : receipt.notes,
        },
      });

      return up;
    });

    return NextResponse.json({
      receipt: updated,
      warning: lockCheck.isVerifiedDay ? 'Modified entry on a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Error updating receipt:', error);
    return NextResponse.json({ error: error.message || 'Failed to update receipt' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const receipt = await prisma.projectReceipt.findFirst({
      where: { id: params.id, organizationId: orgId, deletedAt: null },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Check Day Lock on receipt date
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: receipt.receivedById,
      date: receipt.date,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'ProjectReceipt',
      entityId: receipt.id,
      action: 'DELETE',
      details: { amount: receipt.amount, clientName: receipt.clientName },
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    await prisma.projectReceipt.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Receipt deleted successfully',
      warning: lockCheck.isVerifiedDay ? 'Deleted entry from a verified closed day (Audit logged)' : undefined,
    });
  } catch (error: any) {
    console.error('Error deleting receipt:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete receipt' }, { status: 500 });
  }
}
