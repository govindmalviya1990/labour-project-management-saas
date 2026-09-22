import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { calculateProjectCost, calculateCostPerUnit } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
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
        estimatedLabourCost: p.estimatedLabourCost,
        estimatedMaterialCost: p.estimatedMaterialCost,
        estimatedOtherExpense: p.estimatedOtherExpense,
      });

      const costPerUnit = calculateCostPerUnit({
        completedQuantity: completedQuantity || p.targetQuantity || 0,
        totalLabourCost: actualLabourCost,
        totalMaterialCost: actualMaterialCost,
        totalOtherCost: actualOtherExpense,
        unitName: p.targetUnit || 'sq.ft.',
      });

      portfolioValue += p.projectValue;
      portfolioEstimatedBudget += financials.estimatedTotalCost;
      portfolioActualCost += financials.actualTotalCost;

      if (financials.isBudgetExceeded) {
        overBudgetProjectsCount++;
      }

      return {
        id: p.id,
        name: p.name,
        projectCode: p.projectCode,
        status: p.status,
        projectValue: p.projectValue,
        targetQuantity: p.targetQuantity,
        targetUnit: p.targetUnit || 'sq.ft.',
        completedQuantity,
        financials: {
          ...financials,
          variance: financials.costVariance,
          isOverBudget: financials.isBudgetExceeded,
          projectedProfit: financials.actualProfit,
        },
        costPerUnit: {
          ...costPerUnit,
          costPerUnit: costPerUnit.totalCostPerUnit,
        },
      };
    });

    const portfolioProjectedProfit = portfolioValue - portfolioActualCost;
    const portfolioMarginPct =
      portfolioValue > 0
        ? Math.round((portfolioProjectedProfit / portfolioValue) * 10000) / 100
        : 0;

    return NextResponse.json({
      projects: projectFinancials,
      portfolio: {
        totalProjects: projects.length,
        portfolioValue,
        portfolioEstimatedBudget,
        portfolioActualCost,
        portfolioProjectedProfit,
        portfolioMarginPct,
        overBudgetProjectsCount,
      },
    });
  } catch (error: any) {
    console.error('Projects Financials GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve project financials' },
      { status: 500 }
    );
  }
}
