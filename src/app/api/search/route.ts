import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    if (!q) {
      return NextResponse.json({
        query: '',
        results: {
          projects: [],
          workers: [],
          materials: [],
          suppliers: [],
          expenses: [],
        },
        totalCount: 0,
      });
    }

    const [projects, workers, materials, suppliers, expenses] = await Promise.all([
      // 1. Projects
      prisma.project.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { name: { contains: q } },
            { projectCode: { contains: q } },
            { clientName: { contains: q } },
            { location: { contains: q } },
          ],
        },
        take: 10,
        select: { id: true, name: true, projectCode: true, status: true, projectValue: true },
      }),

      // 2. Workers
      prisma.worker.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { name: { contains: q } },
            { workerCode: { contains: q } },
            { mobile: { contains: q } },
            { category: { contains: q } },
          ],
        },
        take: 10,
        select: { id: true, name: true, workerCode: true, category: true, dailyWage: true, status: true },
      }),

      // 3. Materials
      prisma.material.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { name: { contains: q } },
            { materialCode: { contains: q } },
            { category: { contains: q } },
          ],
        },
        take: 10,
        select: { id: true, name: true, materialCode: true, category: true, unit: true, purchaseRate: true },
      }),

      // 4. Suppliers
      prisma.supplier.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { name: { contains: q } },
            { contactPerson: { contains: q } },
            { mobile: { contains: q } },
          ],
        },
        take: 10,
        select: { id: true, name: true, contactPerson: true, mobile: true },
      }),

      // 5. Expenses
      prisma.expense.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { description: { contains: q } },
            { vendorName: { contains: q } },
            { category: { contains: q } },
          ],
        },
        take: 10,
        select: { id: true, description: true, amount: true, date: true, category: true, vendorName: true },
      }),
    ]);

    const totalCount =
      projects.length + workers.length + materials.length + suppliers.length + expenses.length;

    return NextResponse.json({
      query: q,
      results: {
        projects,
        workers,
        materials,
        suppliers,
        expenses,
      },
      totalCount,
    });
  } catch (error: any) {
    console.error('Global Search GET error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
