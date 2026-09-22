import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']).optional(),
  mobile: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const targetUserId = params.id;

    if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateUserSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid update data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    const targetMembership = await prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: 'Team member not found in organization' }, { status: 404 });
    }

    if (targetMembership.role === 'OWNER' && session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can modify owner accounts' }, { status: 403 });
    }

    // Update role / status on membership
    const updatedMembership = await prisma.organizationUser.update({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUserId,
        },
      },
      data: {
        ...(data.role ? { role: data.role } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });

    // Update name / mobile on User if provided
    if (data.name || data.mobile) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.mobile ? { mobile: data.mobile } : {}),
        },
      });
    }

    return NextResponse.json({
      success: true,
      membership: updatedMembership,
      message: 'User profile updated successfully',
    });
  } catch (error: any) {
    console.error('User PUT error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const targetUserId = params.id;

    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can remove team members' }, { status: 403 });
    }

    if (session.userId === targetUserId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const targetMembership = await prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: 'User not found in this organization' }, { status: 404 });
    }

    await prisma.organizationUser.delete({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUserId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Team member removed from organization successfully.',
    });
  } catch (error: any) {
    console.error('User DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
