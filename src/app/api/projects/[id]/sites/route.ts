import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { createSiteSchema } from '@/lib/validations/projects';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const projectId = params.id;

    const sites = await prisma.projectSite.findMany({
      where: { projectId, organizationId: orgId },
      include: {
        _count: {
          select: {
            attendance: true,
            expenses: true,
            materialReceipts: true,
            materialUsages: true,
            workRecords: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ sites });
  } catch (error: any) {
    console.error('Project sites GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const projectId = params.id;

    // Verify project exists in this tenant
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const validated = createSiteSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid site data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    const site = await prisma.projectSite.create({
      data: {
        organizationId: orgId,
        projectId,
        name: data.name,
        address: data.address || null,
        location: data.location || null,
        supervisorName: data.supervisorName || null,
        supervisorMobile: data.supervisorMobile || null,
        notes: data.notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      site,
      message: 'Site added successfully',
    });
  } catch (error: any) {
    console.error('Project sites POST error:', error);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}
