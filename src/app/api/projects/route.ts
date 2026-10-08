import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { createProjectSchema } from '@/lib/validations/projects';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const projectType = searchParams.get('type');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (projectType && projectType !== 'ALL') {
      where.projectType = projectType;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { projectCode: { contains: q } },
        { clientName: { contains: q } },
        { location: { contains: q } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        sites: {
          select: { id: true, name: true, supervisorName: true },
        },
        _count: {
          select: {
            attendance: true,
            expenses: true,
            materialReceipts: true,
            workRecords: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Overview counters for tabs
    const allOrgProjects = await prisma.project.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { status: true, projectValue: true },
    });

    const statusCounts = {
      ALL: allOrgProjects.length,
      ENQUIRY: allOrgProjects.filter((p) => p.status === 'ENQUIRY').length,
      COMING_SOON: allOrgProjects.filter((p) => p.status === 'COMING_SOON').length,
      RUNNING: allOrgProjects.filter((p) => p.status === 'RUNNING').length,
      COMPLETED: allOrgProjects.filter((p) => p.status === 'COMPLETED').length,
      ON_HOLD: allOrgProjects.filter((p) => p.status === 'ON_HOLD').length,
      CANCELLED: allOrgProjects.filter((p) => p.status === 'CANCELLED').length,
    };

    const totalPortfolioValue = allOrgProjects.reduce((sum, p) => sum + (p.projectValue || 0), 0);

    // Fetch all active ProjectReceipts in this organization
    const allOrgReceipts = await prisma.projectReceipt.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        projectId: true,
        siteId: true,
        amount: true,
      },
    });

    // Total received across whole portfolio
    const totalPaymentReceived = allOrgReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalRemainingPayment = Math.max(0, totalPortfolioValue - totalPaymentReceived);
    const overallCollectionPercentage = totalPortfolioValue > 0
      ? Math.round(((totalPaymentReceived / totalPortfolioValue) * 100) * 10) / 10
      : 0;

    // Fetch all active Expenses to compute project-level cash flow
    const allOrgExpenses = await prisma.expense.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { amount: true, projectId: true },
    });
    const totalProjectExpenses = allOrgExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalNetCashInHand = totalPaymentReceived - totalProjectExpenses;

    // Map receipts & expenses per project
    const projectReceiptMap: Record<string, { totalReceived: number; receiptsCount: number }> = {};
    for (const r of allOrgReceipts) {
      if (r.projectId) {
        if (!projectReceiptMap[r.projectId]) {
          projectReceiptMap[r.projectId] = { totalReceived: 0, receiptsCount: 0 };
        }
        projectReceiptMap[r.projectId].totalReceived += (r.amount || 0);
        projectReceiptMap[r.projectId].receiptsCount += 1;
      }
    }

    const projectExpenseMap: Record<string, number> = {};
    for (const e of allOrgExpenses) {
      if (e.projectId) {
        projectExpenseMap[e.projectId] = (projectExpenseMap[e.projectId] || 0) + (e.amount || 0);
      }
    }

    // Enrich projects list with received & remaining payment
    const enrichedProjects = projects.map((p) => {
      const received = projectReceiptMap[p.id]?.totalReceived || 0;
      const count = projectReceiptMap[p.id]?.receiptsCount || 0;
      const expenses = projectExpenseMap[p.id] || 0;
      const val = p.projectValue || 0;
      const remaining = Math.max(0, val - received);
      const collectionPct = val > 0 ? Math.round(((received / val) * 100) * 10) / 10 : 0;
      return {
        ...p,
        totalReceived: received,
        receiptsCount: count,
        totalExpenses: expenses,
        remainingPayment: remaining,
        collectionPercentage: collectionPct,
        netCashInHand: received - expenses,
      };
    });

    return NextResponse.json({
      projects: enrichedProjects,
      statusCounts,
      totalPortfolioValue,
      totalPaymentReceived,
      totalRemainingPayment,
      overallCollectionPercentage,
      totalProjectExpenses,
      totalNetCashInHand,
    });
  } catch (error: any) {
    console.error('Projects GET error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'NO_ORGANIZATION') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to retrieve projects list' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const validated = createProjectSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid project data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Check code uniqueness within this organization
    const existing = await prisma.project.findFirst({
      where: {
        organizationId: orgId,
        projectCode: data.projectCode,
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Project code '${data.projectCode}' is already in use by another project in your organization.` },
        { status: 409 }
      );
    }

    const estimatedTotal =
      (data.estimatedLabourCost || 0) +
      (data.estimatedMaterialCost || 0) +
      (data.estimatedOtherExpense || 0);

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          organizationId: orgId,
          projectCode: data.projectCode,
          name: data.name,
          projectType: data.projectType,
          status: data.status,
          location: data.location || null,
          fullAddress: data.fullAddress || null,
          clientName: data.clientName || null,
          clientMobile: data.clientMobile || null,
          clientEmail: data.clientEmail || null,
          referenceSource: data.referenceSource || null,
          engineerName: data.engineerName || null,
          engineerMobile: data.engineerMobile || null,
          architectName: data.architectName || null,
          architectMobile: data.architectMobile || null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
          projectValue: data.projectValue || 0,
          estimatedLabourCost: data.estimatedLabourCost || 0,
          estimatedMaterialCost: data.estimatedMaterialCost || 0,
          estimatedOtherExpense: data.estimatedOtherExpense || 0,
          estimatedTotalCost: estimatedTotal,
          targetUnit: data.targetUnit || 'sq.ft.',
          targetQuantity: data.targetQuantity || 0,
          notes: data.notes || null,
        },
      });

      // Optionally create initial site (e.g. "Main Site" or "Tower A")
      if (data.initialSiteName && data.initialSiteName.trim()) {
        await tx.projectSite.create({
          data: {
            organizationId: orgId,
            projectId: created.id,
            name: data.initialSiteName.trim(),
            location: data.location || null,
          },
        });
      }

      return created;
    });

    return NextResponse.json({
      success: true,
      project,
      message: 'Project created successfully',
    });
  } catch (error: any) {
    console.error('Projects POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create project. Please verify inputs.' },
      { status: 500 }
    );
  }
}
