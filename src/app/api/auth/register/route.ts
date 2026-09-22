import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { signJWT } from '@/lib/auth/jwt';
import { registerSchema } from '@/lib/validations/auth';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = registerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { email, password, name, mobile } = validated.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        mobile: mobile || null,
        status: 'ACTIVE',
      },
    });

    const token = await signJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: { id: user.id, email: user.email, name: user.name },
      hasOrganization: false,
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
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during registration. Please try again.' },
      { status: 500 }
    );
  }
}
