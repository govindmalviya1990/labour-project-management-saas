import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { comparePassword } from '@/lib/auth/password';
import { signJWT } from '@/lib/auth/jwt';
import { loginSchema } from '@/lib/validations/auth';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';

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

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { organization: true },
          take: 1,
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const passwordValid = await comparePassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const activeMembership = user.memberships[0];

    const token = await signJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: activeMembership?.organizationId,
      role: activeMembership?.role,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
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
