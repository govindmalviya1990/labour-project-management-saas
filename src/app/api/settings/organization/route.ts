import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateOrgSchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  currency: z.string().default('INR'),
  timezone: z.string().default('Asia/Kolkata'),
});

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
            workers: true,
            materials: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organization });
  } catch (error: any) {
    console.error('Organization GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    if (session.role !== 'OWNER' && session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Only owners can modify company settings' }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateOrgSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid settings data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    const updateData: any = {
      name: data.name,
      currency: data.currency,
      timezone: data.timezone,
    };
    if (data.mobile || data.phone) updateData.mobile = data.mobile || data.phone;
    if (data.email) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.gstNumber !== undefined) updateData.gstNumber = data.gstNumber || null;

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      organization: updated,
      message: 'Company settings updated successfully',
    });
  } catch (error: any) {
    console.error('Organization PUT error:', error);
    return NextResponse.json({ error: 'Failed to update organization settings' }, { status: 500 });
  }
}
