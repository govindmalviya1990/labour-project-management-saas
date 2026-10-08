import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { updateProjectSchema } from '@/lib/validations/projects';
import { calculateProjectCost, calculateCostPerUnit } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const projectId = params.id;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        sites: {
          include: {
            _count: {
              select: {
                attendance: true,
                expenses: true,
                materialUsages: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Calculate Actual Labour Cost from Attendance
    const attendanceRecords = await prisma.attendance.findMany({
      where: { projectId, organizationId: orgId },
      include: { worker: { select: { name: true, category: true } } },
      orderBy: { date: 'desc' },
      take: 10,
    });
    const totalAttendanceCount = await prisma.attendance.count({
      where: { projectId, organizationId: orgId },
    });
    const allProjectAttendance = await prisma.attendance.findMany({
      where: { projectId, organizationId: orgId },
      select: { wageForDay: true },
    });
    const actualLabourCost = allProjectAttendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);

    // 2. Calculate Actual Material Cost from Material Receipts
    const allMaterialReceipts = await prisma.materialReceipt.findMany({
      where: { projectId, organizationId: orgId, deletedAt: null },
      include: { material: { select: { name: true, unit: true } } },
      orderBy: { date: 'desc' },
    });
    const actualMaterialCost = allMaterialReceipts.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    // 3. Calculate Actual Other Expenses
    const allExpenses = await prisma.expense.findMany({
      where: { projectId, organizationId: orgId, deletedAt: null },
      orderBy: { date: 'desc' },
    });
    const actualOtherExpense = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // 4. Completed Work Quantity from Work Records
    const workRecords = await prisma.workRecord.findMany({
      where: { projectId, organizationId: orgId },
    });
    const totalCompletedQuantity = workRecords.reduce((sum, w) => sum + (w.quantity || 0), 0);

    // 5. Run Calculation Engine for Project Financials
    const financials = calculateProjectCost({
      projectValue: project.projectValue,
      labourCost: actualLabourCost,
      materialCost: actualMaterialCost,
      otherExpenses: actualOtherExpense,
      estimatedLabourCost: project.estimatedLabourCost,
      estimatedMaterialCost: project.estimatedMaterialCost,
      estimatedOtherExpense: project.estimatedOtherExpense,
    });

    // 6. Cost per Unit (e.g. sq.ft.)
    const costPerUnit = calculateCostPerUnit({
      completedQuantity: totalCompletedQuantity || project.targetQuantity || 0,
      totalLabourCost: actualLabourCost,
      totalMaterialCost: actualMaterialCost,
      totalOtherCost: actualOtherExpense,
      unitName: project.targetUnit || 'sq.ft.',
    });

    return NextResponse.json({
      project,
      financials,
      costPerUnit,
      stats: {
        totalAttendanceCount,
        recentAttendance: attendanceRecords,
        materialReceiptsCount: allMaterialReceipts.length,
        recentMaterialReceipts: allMaterialReceipts.slice(0, 5),
        expensesCount: allExpenses.length,
        recentExpenses: allExpenses.slice(0, 5),
      },
    });
  } catch (error: any) {
    console.error('Project details GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve project details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const projectId = params.id;

    const body = await req.json();
    const validated = updateProjectSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Verify project exists in this tenant
    const existing = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Strip out fields not belonging to Project model in Prisma
    const { initialSiteName, ...cleanData } = data as any;

    // Check projectCode uniqueness if updated
    if (cleanData.projectCode && cleanData.projectCode !== existing.projectCode) {
      const codeExists = await prisma.project.findFirst({
        where: {
          organizationId: orgId,
          projectCode: cleanData.projectCode,
          id: { not: projectId },
          deletedAt: null,
        },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: `Project code '${cleanData.projectCode}' is already in use by another project in your organization.` },
          { status: 409 }
        );
      }
    }

    const parseDateOrNull = (d: any) => {
      if (!d || d === '' || d === 'null') return null;
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const estLabour = cleanData.estimatedLabourCost !== undefined ? cleanData.estimatedLabourCost : existing.estimatedLabourCost;
    const estMaterial = cleanData.estimatedMaterialCost !== undefined ? cleanData.estimatedMaterialCost : existing.estimatedMaterialCost;
    const estOther = cleanData.estimatedOtherExpense !== undefined ? cleanData.estimatedOtherExpense : existing.estimatedOtherExpense;
    const estimatedTotal = (estLabour || 0) + (estMaterial || 0) + (estOther || 0);

    const updatePayload: any = {
      ...cleanData,
      estimatedTotalCost: estimatedTotal,
    };

    if (cleanData.startDate !== undefined) {
      updatePayload.startDate = parseDateOrNull(cleanData.startDate);
    }
    if (cleanData.expectedCompletionDate !== undefined) {
      updatePayload.expectedCompletionDate = parseDateOrNull(cleanData.expectedCompletionDate);
    }
    if (cleanData.actualCompletionDate !== undefined) {
      updatePayload.actualCompletionDate = parseDateOrNull(cleanData.actualCompletionDate);
    }
    if (cleanData.clientEmail === '') {
      updatePayload.clientEmail = null;
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: updatePayload,
    });

    return NextResponse.json({
      success: true,
      project: updated,
      message: 'Project updated successfully',
    });
  } catch (error: any) {
    console.error('Project PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const projectId = params.id;

    // Check project exists
    const existing = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Soft delete
    await prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Project archived successfully',
    });
  } catch (error: any) {
    console.error('Project DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
