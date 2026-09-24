import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { signJWT } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      mobile,
      name,
      fatherName,
      siteName,
      location,
      saveSession = false,
    } = body;

    const trimmedMobile = (mobile || '').toString().trim();
    const cleanDigits = trimmedMobile.replace(/\D/g, '');
    const last10Digits = cleanDigits.slice(-10);

    const trimmedName = (name || '').trim();
    const trimmedFather = (fatherName || '').trim();
    const trimmedSite = (siteName || '').trim();
    const trimmedLoc = (location || '').trim();

    if (!last10Digits && !trimmedName) {
      return NextResponse.json(
        {
          error:
            'कृपया मोबाइल नंबर या मज़दूर का नाम दर्ज करें (Please provide Mobile number or Worker Name).',
        },
        { status: 400 }
      );
    }

    // Build potential match candidates
    let candidates: any[] = [];

    // Priority 1: Match by mobile number if 10 digits given
    if (last10Digits.length >= 10) {
      candidates = await prisma.worker.findMany({
        where: {
          deletedAt: null,
          mobile: {
            contains: last10Digits,
          },
        },
      });
    }

    // Priority 2: If no candidate yet or mobile was partial, match by name and father name
    if (candidates.length === 0 && trimmedName) {
      const orConditions: any[] = [
        { name: { contains: trimmedName, mode: 'insensitive' } },
      ];

      // If father name given, check both or combine
      if (trimmedFather) {
        candidates = await prisma.worker.findMany({
          where: {
            deletedAt: null,
            AND: [
              { name: { contains: trimmedName, mode: 'insensitive' } },
              {
                fatherOrHusbandName: {
                  contains: trimmedFather,
                  mode: 'insensitive',
                },
              },
            ],
          },
        });
      }

      if (candidates.length === 0) {
        candidates = await prisma.worker.findMany({
          where: {
            deletedAt: null,
            OR: orConditions,
          },
        });
      }
    }

    // Priority 3: Fallback broad search if user supplied phone with non-digits
    if (candidates.length === 0 && trimmedMobile) {
      candidates = await prisma.worker.findMany({
        where: {
          deletedAt: null,
          mobile: { contains: trimmedMobile },
        },
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error:
            'रिकॉर्ड नहीं मिला। कृपया मोबाइल नंबर या नाम की स्पेलिंग जांचें अथवा अपने साइट सुपरवाइजर से संपर्क करें। (No worker record found. Please verify details or contact your site supervisor.)',
        },
        { status: 404 }
      );
    }

    // If multiple workers match, refine using father name or site/location
    let matchedWorker = candidates[0];

    if (candidates.length > 1) {
      if (trimmedFather) {
        const fatherMatch = candidates.find(
          (c) =>
            c.fatherOrHusbandName &&
            c.fatherOrHusbandName
              .toLowerCase()
              .includes(trimmedFather.toLowerCase())
        );
        if (fatherMatch) matchedWorker = fatherMatch;
      }
    }

    // Now fetch full details of the matched worker
    const worker = await prisma.worker.findUnique({
      where: { id: matchedWorker.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            ownerName: true,
            mobile: true,
            email: true,
            address: true,
            city: true,
            state: true,
          },
        },
        attendance: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
                location: true,
              },
            },
            site: {
              select: {
                id: true,
                name: true,
                location: true,
                supervisorName: true,
                supervisorMobile: true,
              },
            },
          },
          orderBy: { date: 'desc' },
        },
        payments: {
          where: { deletedAt: null },
          include: {
            project: {
              select: { id: true, name: true },
            },
            site: {
              select: { id: true, name: true },
            },
          },
          orderBy: { date: 'desc' },
        },
        workRecords: {
          include: {
            project: {
              select: { id: true, name: true, location: true },
            },
            site: {
              select: { id: true, name: true },
            },
          },
          orderBy: { date: 'desc' },
        },
        allowances: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Calculate detailed aggregates
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let overtimeHours = 0;
    let attendanceWages = 0;

    worker.attendance.forEach((att) => {
      if (att.status === 'PRESENT') {
        presentDays += 1;
      } else if (att.status === 'HALF_DAY') {
        halfDays += 1;
      } else if (att.status === 'ABSENT') {
        absentDays += 1;
      }
      overtimeHours += att.overtimeHours || 0;
      attendanceWages += att.wageForDay || 0;
    });

    const totalDaysWorked = presentDays + halfDays * 0.5;

    // Work records total
    let workRecordWages = 0;
    worker.workRecords.forEach((wr) => {
      const val = wr.totalWorkValue || wr.quantity * wr.rate || 0;
      workRecordWages += val;
    });

    // Payments and advances
    let totalPaid = 0;
    let totalAdvances = 0;
    worker.payments.forEach((p) => {
      if (p.transactionType === 'ADVANCE') {
        totalAdvances += p.amount || 0;
      } else {
        totalPaid += p.amount || 0;
      }
    });

    // Allowances
    let totalAllowances = 0;
    worker.allowances.forEach((al) => {
      totalAllowances += al.amount || 0;
    });

    const totalReceived = totalPaid + totalAdvances;
    const baseDailyWageTotal =
      attendanceWages > 0
        ? attendanceWages
        : totalDaysWorked * (worker.dailyWage || 0);

    const totalEarned = baseDailyWageTotal + workRecordWages + totalAllowances;
    const remainingPayable = totalEarned - totalReceived;

    // Distinct sites and locations
    const sitesMap = new Map();
    worker.attendance.forEach((att) => {
      if (att.project) {
        sitesMap.set(att.project.id, {
          projectId: att.project.id,
          projectName: att.project.name,
          projectCode: att.project.projectCode,
          location: att.project.location || 'Site Location',
          siteName: att.site?.name || null,
          supervisorName: att.site?.supervisorName || null,
          supervisorMobile: att.site?.supervisorMobile || null,
        });
      }
    });
    worker.workRecords.forEach((wr) => {
      if (wr.project && !sitesMap.has(wr.project.id)) {
        sitesMap.set(wr.project.id, {
          projectId: wr.project.id,
          projectName: wr.project.name,
          location: wr.project.location || 'Site Location',
          siteName: wr.site?.name || null,
        });
      }
    });

    const sitesList = Array.from(sitesMap.values());

    const responsePayload = {
      success: true,
      worker: {
        id: worker.id,
        workerCode: worker.workerCode,
        name: worker.name,
        fatherOrHusbandName: worker.fatherOrHusbandName,
        mobile: worker.mobile,
        address: worker.address,
        category: worker.category,
        dailyWage: worker.dailyWage,
        wageUnit: worker.wageUnit,
        status: worker.status,
        joiningDate: worker.joiningDate,
      },
      organization: {
        name: worker.organization?.name || 'Modern Way Civil Solution',
        ownerName: worker.organization?.ownerName || 'Govind Malviya',
        mobile: worker.organization?.mobile || '9876543210',
        city: worker.organization?.city || '',
      },
      summary: {
        totalDaysWorked,
        presentDays,
        halfDays,
        absentDays,
        overtimeHours,
        attendanceWages,
        workRecordWages,
        totalAllowances,
        totalEarned,
        totalPaid,
        totalAdvances,
        totalReceived,
        remainingPayable,
      },
      attendance: worker.attendance.map((att) => ({
        id: att.id,
        date: att.date,
        status: att.status,
        shift: att.shift,
        overtimeHours: att.overtimeHours,
        wageForDay: att.wageForDay,
        notes: att.notes,
        projectName: att.project?.name || 'Main Site',
        location: att.project?.location || '',
        siteName: att.site?.name || '',
      })),
      payments: worker.payments.map((p) => ({
        id: p.id,
        date: p.date,
        amount: p.amount,
        transactionType: p.transactionType,
        paymentMethod: p.paymentMethod,
        reference: p.reference,
        notes: p.notes,
        projectName: p.project?.name || 'Company Account',
      })),
      workRecords: worker.workRecords.map((wr) => ({
        id: wr.id,
        date: wr.date,
        task: wr.task,
        description: wr.description,
        quantity: wr.quantity,
        unit: wr.unit,
        rate: wr.rate,
        totalWorkValue: wr.totalWorkValue || wr.quantity * wr.rate,
        projectName: wr.project?.name || '',
        siteName: wr.site?.name || '',
      })),
      sites: sitesList,
    };

    const res = NextResponse.json(responsePayload);

    // Optional: save session cookie for labour role
    if (saveSession) {
      try {
        const token = await signJWT({
          userId: `worker_${worker.id}`,
          email: `${worker.workerCode.toLowerCase()}@modernway.com`,
          name: worker.name,
          organizationId: worker.organizationId,
          role: 'LABOUR',
          workerId: worker.id,
        });

        res.cookies.set(AUTH_COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: '/',
        });
      } catch (tokenErr) {
        console.warn('Failed to issue cookie for worker portal:', tokenErr);
      }
    }

    return res;
  } catch (error: any) {
    console.error('Worker lookup API error:', error);
    return NextResponse.json(
      {
        error:
          'सर्वर से जानकारी लाने में समस्या हुई। कृपया पुनः प्रयास करें। (Server error while fetching report)',
      },
      { status: 500 }
    );
  }
}
