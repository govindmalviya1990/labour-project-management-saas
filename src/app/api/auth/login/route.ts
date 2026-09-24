import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { comparePassword, hashPassword } from '@/lib/auth/password';
import { signJWT } from '@/lib/auth/jwt';
import { loginSchema } from '@/lib/validations/auth';
import { AUTH_COOKIE_NAME, normalizeRole } from '@/lib/auth/session';

// Standard demo test accounts for each role
const DEMO_ACCOUNTS: Record<string, { name: string; role: string; mobile?: string }> = {
  'owner@modernway.com': {
    name: 'Modern Way Owner',
    role: 'OWNER',
    mobile: '9876543210',
  },
  'supervisor@modernway.com': {
    name: 'Sonu Yadav (Site Supervisor)',
    role: 'SITE_SUPERVISOR',
    mobile: '9876543212',
  },
  'accountant@modernway.com': {
    name: 'Priya Verma (Accountant)',
    role: 'ACCOUNTANT',
    mobile: '9876543213',
  },
  'labour@modernway.com': {
    name: 'Ramesh (Rajmistri)',
    role: 'LABOUR',
    mobile: '9812345678',
  },
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid login details' },
        { status: 400 }
      );
    }

    const { email, password } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { organization: true },
          take: 1,
        },
      },
    });

    // Auto-provision demo account if requested and missing
    if (!user && DEMO_ACCOUNTS[normalizedEmail] && password === 'password123') {
      const demoConfig = DEMO_ACCOUNTS[normalizedEmail];
      const defaultOrg = await prisma.organization.findFirst();

      if (defaultOrg) {
        const passwordHash = await hashPassword('password123');
        user = await prisma.user.create({
          data: {
            name: demoConfig.name,
            email: normalizedEmail,
            passwordHash,
            mobile: demoConfig.mobile || null,
            status: 'ACTIVE',
            memberships: {
              create: {
                organizationId: defaultOrg.id,
                role: demoConfig.role,
                status: 'ACTIVE',
              },
            },
          },
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              include: { organization: true },
              take: 1,
            },
          },
        });
      }
    }

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const passwordValid = await comparePassword(password, user.passwordHash);
    if (!passwordValid) {
      // Also allow default password for demo accounts in case of hash mismatch
      if (DEMO_ACCOUNTS[normalizedEmail] && password === 'password123') {
        const updatedHash = await hashPassword('password123');
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: updatedHash },
        });
      } else {
        return NextResponse.json(
          { error: 'Invalid email address or password.' },
          { status: 401 }
        );
      }
    }

    let activeMembership = user.memberships[0];

    // If user exists but has no membership, associate with first org
    if (!activeMembership) {
      const defaultOrg = await prisma.organization.findFirst();
      if (defaultOrg) {
        const demoRole = DEMO_ACCOUNTS[normalizedEmail]?.role || 'SITE_SUPERVISOR';
        activeMembership = await prisma.organizationUser.create({
          data: {
            organizationId: defaultOrg.id,
            userId: user.id,
            role: demoRole,
            status: 'ACTIVE',
          },
          include: { organization: true },
        });
      }
    }

    const userRole = activeMembership?.role || 'OWNER';

    // Check if workerId exists for LABOUR
    let workerId: string | undefined;
    if (normalizeRole(userRole) === 'LABOUR' && activeMembership?.organizationId) {
      const matchedWorker = await prisma.worker.findFirst({
        where: {
          organizationId: activeMembership.organizationId,
          deletedAt: null,
          OR: [
            ...(user.mobile ? [{ mobile: user.mobile }] : []),
            { name: { contains: user.name } },
          ],
        },
      });
      workerId = matchedWorker?.id;
    }

    const token = await signJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: activeMembership?.organizationId,
      role: userRole,
      workerId,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: userRole,
        workerId,
      },
      organization: activeMembership
        ? {
            id: activeMembership.organization.id,
            name: activeMembership.organization.name,
            role: activeMembership.role,
          }
        : null,
      hasOrganization: Boolean(activeMembership),
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
