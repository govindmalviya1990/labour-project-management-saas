import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';
import { calculateProjectCost, calculateCostPerUnit } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Only OWNER, MANAGER, and ACCOUNTANT can view portfolio financials
    // SUPERVISOR and LABOUR are strictly forbidden
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        attendance: {
          select: { wageForDay: true },
        },
        materialReceipts: {
          where: { deletedAt: null },
          select: { totalCost: true },
        },
        expenses: {
          where: { deletedAt: null },
          select: { amount: true },
        },
        workRecords: {
          select: { quantity: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let portfolioValue = 0;
    let portfolioEstimatedBudget = 0;
    let portfolioActualCost = 0;
    let overBudgetProjectsCount = 0;

    const projectFinancials = projects.map((p) => {
      const actualLabourCost = p.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
      const actualMaterialCost = p.materialReceipts.reduce((sum, m) => sum + (m.totalCost || 0), 0);
      const actualOtherExpense = p.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const completedQuantity = p.workRecords.reduce((sum, w) => sum + (w.quantity || 0), 0);

      const financials = calculateProjectCost({
        projectValue: p.projectValue,
        labourCost: actualLabourCost,
        materialCost: actualMaterialCost,
        otherExpenses: actualOtherExpense,
      });

      const estimatedBudget = p.estimatedTotalCost || 0;
      const budgetVariance = estimatedBudget - financials.actualTotalCost;
      const isOverBudget = financials.actualTotalCost > estimatedBudget && estimatedBudget > 0;

      if (isOverBudget) overBudgetProjectsCount++;
      portfolioValue += p.projectValue || 0;
      portfolioEstimatedBudget += estimatedBudget;
      portfolioActualCost += financials.actualTotalCost;

      const unitMetrics = calculateCostPerUnit({
        completedQuantity: completedQuantity || p.targetQuantity || 1,
        totalLabourCost: actualLabourCost,
        totalMaterialCost: actualMaterialCost,
        totalOtherCost: actualOtherExpense,
        unitName: p.targetUnit || 'sq.ft.',
      });

      return {
        id: p.id,
        projectCode: p.projectCode,
        name: p.name,
        clientName: p.clientName,
        status: p.status,
        projectValue: p.projectValue,
        estimatedBudget,
        targetUnit: p.targetUnit,
        targetQuantity: p.targetQuantity,
        completedQuantity,
        financials: {
          actualLabourCost,
          actualMaterialCost,
          actualOtherExpense,
          totalActualCost: financials.actualTotalCost,
          grossProfit: financials.actualProfit,
          profitMarginPercent: financials.profitMarginPercentage,
          budgetVariance,
          isOverBudget,
          costPerUnit: unitMetrics.totalCostPerUnit,
        },
      };
    });

    const portfolioGrossProfit = portfolioValue - portfolioActualCost;
    const portfolioMargin = portfolioValue > 0 ? (portfolioGrossProfit / portfolioValue) * 100 : 0;

    return NextResponse.json({
      projects: projectFinancials,
      portfolioSummary: {
        totalProjects: projects.length,
        portfolioValue,
        portfolioEstimatedBudget,
        portfolioActualCost,
        portfolioGrossProfit,
        portfolioMargin: Math.round(portfolioMargin * 10) / 10,
        overBudgetProjectsCount,
      },
    });
  } catch (error: any) {
    console.error('Project financials GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve project financials' }, { status: 500 });
  }
}
