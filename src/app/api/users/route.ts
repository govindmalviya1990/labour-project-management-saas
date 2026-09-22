import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['OWNER', 'MANAGER', 'SITE_SUPERVISOR', 'ACCOUNTANT']).default('SITE_SUPERVISOR'),
  mobile: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').default('password123'),
});

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const memberships = await prisma.organizationUser.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const users = memberships.map((m) => ({
      id: m.userId,
      membershipId: m.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      mobile: m.user.mobile,
      status: m.status,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve team members' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    // Only OWNER or MANAGER can invite users
    if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Only Owners and Managers can add users' }, { status: 403 });
    }

    const body = await req.json();
    const validated = createUserSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid user data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    let user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(data.password, 10);
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          passwordHash,
          mobile: data.mobile || null,
          status: 'ACTIVE',
        },
      });
    }

    // Check if user is already a member of this organization
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: `User with email '${data.email}' is already a member of this organization.` },
        { status: 409 }
      );
    }

    const membership = await prisma.organizationUser.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        role: data.role,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        mobile: user.mobile,
        status: membership.status,
      },
      message: `Team member ${user.name} added with ${membership.role} permissions.`,
    });
  } catch (error: any) {
    console.error('Users POST error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
