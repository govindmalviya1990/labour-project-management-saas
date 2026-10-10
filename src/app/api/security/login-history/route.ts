import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Only OWNER and MANAGER can view security login history
    const auth = await checkRolePermission(['OWNER', 'MANAGER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {
      OR: [
        { organizationId: orgId },
        { organizationId: null }, // for failed login attempts where org was not resolved yet
      ],
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.AND = [
        {
          OR: [
            { userEmail: { contains: q, mode: 'insensitive' } },
            { userName: { contains: q, mode: 'insensitive' } },
            { ipAddress: { contains: q } },
            { portal: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const logins = await prisma.loginHistory.findMany({
      where,
      orderBy: { loginAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
          },
        },
      },
    });

    // Summary statistics
    const totalCount = await prisma.loginHistory.count({ where });
    const successCount = await prisma.loginHistory.count({
      where: { ...where, status: 'SUCCESS' },
    });
    const failedCount = await prisma.loginHistory.count({
      where: { ...where, status: 'FAILED' },
    });

    return NextResponse.json({
      success: true,
      logins,
      summary: {
        total: totalCount,
        success: successCount,
        failed: failedCount,
      },
    });
  } catch (error: any) {
    console.error('Login history GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve login history' },
      { status: 500 }
    );
  }
}
