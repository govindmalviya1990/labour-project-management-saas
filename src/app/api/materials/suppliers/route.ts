import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { createSupplierSchema } from '@/lib/validations/materials';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const where: any = {
      organizationId: orgId,
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { contactPerson: { contains: q } },
        { mobile: { contains: q } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            materials: true,
            receipts: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ suppliers });
  } catch (error: any) {
    console.error('Suppliers GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve suppliers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createSupplierSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid supplier data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        name: data.name,
        contactPerson: data.contactPerson || null,
        mobile: data.mobile || null,
        email: data.email || null,
        address: data.address || null,
        gstNumber: data.gstNumber || null,
      },
    });

    return NextResponse.json({
      success: true,
      supplier,
      message: 'Supplier registered successfully',
    });
  } catch (error: any) {
    console.error('Supplier POST error:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
