import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { saveAttendanceSheetSchema } from '@/lib/validations/workers';
import { calculateSalary } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'SITE_SUPERVISOR',
      'ACCOUNTANT',
      'LABOUR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const isLabour = normalizeRole(session.role) === 'LABOUR';

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const projectId = searchParams.get('projectId') || undefined;
    const siteId = searchParams.get('siteId') || undefined;

    const queryDate = new Date(dateStr);
    queryDate.setUTCHours(0, 0, 0, 0);

    const endOfQueryDate = new Date(dateStr);
    endOfQueryDate.setUTCHours(23, 59, 59, 999);

    // 1. Get active workers (restricted to self for LABOUR)
    const activeWorkers = await prisma.worker.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(isLabour && session.workerId ? { id: session.workerId } : {}),
      },
      orderBy: { name: 'asc' },
    });

    // 2. Get existing attendance for this day
    const existingAttendance = await prisma.attendance.findMany({
      where: {
        organizationId: orgId,
        date: { gte: queryDate, lte: endOfQueryDate },
        ...(projectId ? { projectId } : {}),
        ...(siteId ? { siteId } : {}),
        ...(isLabour && session.workerId ? { workerId: session.workerId } : {}),
      },
      include: {
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
    });

    // Create lookup by workerId
    const attendanceMap = new Map();
    existingAttendance.forEach((att) => {
      attendanceMap.set(att.workerId, att);
    });

    // Merge active workers with attendance record
    const sheet = activeWorkers.map((worker) => {
      const att = attendanceMap.get(worker.id);
      return {
        workerId: worker.id,
        workerCode: worker.workerCode,
        name: worker.name,
        category: worker.category,
        dailyWage: worker.dailyWage,
        attendanceId: att?.id || null,
        status: att?.status || 'UNMARKED',
        shift: att?.shift || 'DAY',
        overtimeHours: att?.overtimeHours || 0,
        wageForDay: att?.wageForDay || 0,
        notes: att?.notes || '',
        projectId: att?.projectId || projectId || null,
        projectName: att?.project?.name || null,
        siteId: att?.siteId || siteId || null,
        siteName: att?.site?.name || null,
      };
    });

    // Aggregate summary for the date
    const totalPresent = existingAttendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'HALF_DAY'
    ).length;
    const totalAbsent = existingAttendance.filter((a) => a.status === 'ABSENT').length;
    const totalHalfDay = existingAttendance.filter((a) => a.status === 'HALF_DAY').length;
    const totalLeave = existingAttendance.filter((a) => a.status === 'LEAVE').length;
    const totalLabourCost = existingAttendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);

    return NextResponse.json({
      date: dateStr,
      sheet,
      summary: {
        totalWorkers: activeWorkers.length,
        markedCount: existingAttendance.length,
        unmarkedCount: activeWorkers.length - existingAttendance.length,
        present: totalPresent,
        halfDay: totalHalfDay,
        absent: totalAbsent,
        leave: totalLeave,
        totalLabourCost,
      },
    });
  } catch (error: any) {
    console.error('Attendance GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve attendance sheet' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Only OWNER, MANAGER, and SITE_SUPERVISOR can mark/save attendance
    // ACCOUNTANT and LABOUR are strictly forbidden
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'SITE_SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    const body = await req.json();
    const validated = saveAttendanceSheetSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid attendance payload' },
        { status: 400 }
      );
    }

    const { date: dateStr, projectId, siteId, records } = validated.data;

    // Verify project exists in tenant
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const attendanceDate = new Date(dateStr);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    // Fetch all worker daily wages for wage calculations
    const workerIds = records.map((r) => r.workerId);
    const workers = await prisma.worker.findMany({
      where: { id: { in: workerIds }, organizationId: orgId },
      select: { id: true, dailyWage: true },
    });
    const wageMap = new Map(workers.map((w) => [w.id, w.dailyWage]));

    // Atomic transaction for all records in the sheet
    const savedRecords = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of records) {
        const dailyWage = wageMap.get(item.workerId) || 0;

        // Run calculation engine for daily wage
        const isPresent = item.status === 'PRESENT';
        const isHalfDay = item.status === 'HALF_DAY';
        const salaryResult = calculateSalary({
          dailyWage,
          presentDays: isPresent ? 1 : 0,
          halfDays: isHalfDay ? 1 : 0,
          overtimeHours: item.overtimeHours || 0,
        });

        const wageForDay = salaryResult.grossSalary;

        // Upsert by composite unique key: [organizationId, projectId, workerId, date]
        const saved = await tx.attendance.upsert({
          where: {
            organizationId_projectId_workerId_date: {
              organizationId: orgId,
              projectId,
              workerId: item.workerId,
              date: attendanceDate,
            },
          },
          update: {
            siteId: siteId || null,
            status: item.status,
            shift: item.shift || 'DAY',
            overtimeHours: item.overtimeHours || 0,
            wageForDay,
            notes: item.notes || null,
          },
          create: {
            organizationId: orgId,
            projectId,
            siteId: siteId || null,
            workerId: item.workerId,
            date: attendanceDate,
            status: item.status,
            shift: item.shift || 'DAY',
            overtimeHours: item.overtimeHours || 0,
            wageForDay,
            notes: item.notes || null,
          },
        });

        results.push(saved);
      }

      return results;
    });

    return NextResponse.json({
      success: true,
      count: savedRecords.length,
      message: `Successfully saved attendance for ${savedRecords.length} workers.`,
    });
  } catch (error: any) {
    console.error('Attendance POST error:', error);
    return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 });
  }
}
