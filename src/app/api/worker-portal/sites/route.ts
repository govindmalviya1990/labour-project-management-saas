import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        location: true,
        sites: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        location: p.location || '',
        sites: p.sites.map((s) => ({ id: s.id, name: s.name, location: s.location || '' })),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, projects: [] });
  }
}
