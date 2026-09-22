import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { calculateProductivity } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || undefined;

    // Get all active workers
    const workers = await prisma.worker.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: {
        attendance: {
          where: {
            organizationId: orgId,
            ...(projectId ? { projectId } : {}),
            status: { in: ['PRESENT', 'HALF_DAY'] },
          },
        },
        workRecords: {
          where: {
            organizationId: orgId,
            ...(projectId ? { projectId } : {}),
          },
        },
      },
    });

    const productivityList = workers.map((w) => {
      const fullDays = w.attendance.filter((a) => a.status === 'PRESENT').length;
      const halfDays = w.attendance.filter((a) => a.status === 'HALF_DAY').length;
      const totalDaysWorked = fullDays + (halfDays * 0.5);

      const totalQuantity = w.workRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
      const totalWorkValue = w.workRecords.reduce((sum, r) => sum + (r.totalWorkValue || 0), 0);

      const primaryUnit = w.workRecords[0]?.unit || 'units';

      const metrics = calculateProductivity({
        totalQuantity,
        daysWorked: totalDaysWorked,
        totalWorkValue,
      });

      return {
        workerId: w.id,
        workerCode: w.workerCode,
        name: w.name,
        category: w.category,
        dailyWage: w.dailyWage,
        daysWorked: totalDaysWorked,
        totalQuantity,
        unit: primaryUnit,
        averageQuantityPerDay: metrics.averageQuantityPerDay,
        workValue: metrics.workValue,
        costPerUnit: metrics.costPerUnit,
        tasksCount: w.workRecords.length,
      };
    });

    // Sort by total quantity or output descending
    productivityList.sort((a, b) => b.totalQuantity - a.totalQuantity);

    const overallTotalUnits = productivityList.reduce((sum, p) => sum + p.totalQuantity, 0);
    const overallTotalWorkValue = productivityList.reduce((sum, p) => sum + p.workValue, 0);

    return NextResponse.json({
      productivity: productivityList,
      summary: {
        totalWorkersTracked: productivityList.length,
        overallTotalUnits,
        overallTotalWorkValue,
      },
    });
  } catch (error: any) {
    console.error('Productivity GET error:', error);
    return NextResponse.json({ error: 'Failed to calculate productivity' }, { status: 500 });
  }
}
