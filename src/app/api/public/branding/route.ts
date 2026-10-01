import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const org = await prisma.organization.findFirst({
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
    });

    return NextResponse.json({
      name: org?.name || 'Modern Way Civil Solution',
      logoUrl: org?.logoUrl || null,
    });
  } catch (error) {
    console.error('Error fetching public branding:', error);
    return NextResponse.json({
      name: 'Modern Way Civil Solution',
      logoUrl: null,
    });
  }
}
