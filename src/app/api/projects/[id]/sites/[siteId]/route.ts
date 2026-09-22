import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { updateSiteSchema } from '@/lib/validations/projects';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: { id: string; siteId: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const { id: projectId, siteId } = params;

    const body = await req.json();
    const validated = updateSiteSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid site data' },
        { status: 400 }
      );
    }

    const existing = await prisma.projectSite.findFirst({
      where: { id: siteId, projectId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const updated = await prisma.projectSite.update({
      where: { id: siteId },
      data: validated.data,
    });

    return NextResponse.json({
      success: true,
      site: updated,
      message: 'Site updated successfully',
    });
  } catch (error: any) {
    console.error('Site PUT error:', error);
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; siteId: string } }
) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;
    const { id: projectId, siteId } = params;

    const existing = await prisma.projectSite.findFirst({
      where: { id: siteId, projectId, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    await prisma.projectSite.delete({
      where: { id: siteId },
    });

    return NextResponse.json({
      success: true,
      message: 'Site deleted successfully',
    });
  } catch (error: any) {
    console.error('Site DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}
