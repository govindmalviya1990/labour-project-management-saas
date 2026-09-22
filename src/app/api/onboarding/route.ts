import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/session';
import { signJWT } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const { organization, project, worker, attendance } = body;

    if (!organization || !organization.name || !organization.mobile) {
      return NextResponse.json(
        { error: 'Organization name and mobile are required.' },
        { status: 400 }
      );
    }

    // Atomic transaction for full onboarding
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: organization.name,
          ownerName: organization.ownerName || session.name,
          mobile: organization.mobile,
          email: organization.email || session.email,
          address: organization.address || null,
          city: organization.city || null,
          state: organization.state || null,
          country: organization.country || 'India',
          gstNumber: organization.gstNumber || null,
          currency: organization.currency || 'INR',
          timezone: organization.timezone || 'Asia/Kolkata',
        },
      });

      // 2. Link user as OWNER in OrganizationUser
      await tx.organizationUser.create({
        data: {
          organizationId: org.id,
          userId: session.userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      // 3. Create First Project (if provided)
      let createdProject = null;
      if (project && project.name) {
        createdProject = await tx.project.create({
          data: {
            organizationId: org.id,
            projectCode: project.projectCode || 'PRJ-001',
            name: project.name,
            projectType: project.projectType || 'Residential',
            status: project.status || 'RUNNING',
            location: project.location || null,
            projectValue: Number(project.projectValue) || 0,
            estimatedLabourCost: Number(project.estimatedLabourCost) || 0,
            estimatedMaterialCost: Number(project.estimatedMaterialCost) || 0,
            estimatedOtherExpense: Number(project.estimatedOtherExpense) || 0,
            estimatedTotalCost:
              (Number(project.estimatedLabourCost) || 0) +
              (Number(project.estimatedMaterialCost) || 0) +
              (Number(project.estimatedOtherExpense) || 0),
          },
        });
      }

      // 4. Create First Worker (if provided)
      let createdWorker = null;
      if (worker && worker.name) {
        createdWorker = await tx.worker.create({
          data: {
            organizationId: org.id,
            workerCode: worker.workerCode || 'WRK-001',
            name: worker.name,
            mobile: worker.mobile || null,
            category: worker.category || 'Helper',
            dailyWage: Number(worker.dailyWage) || 500,
            wageUnit: 'PER_DAY',
            status: 'ACTIVE',
          },
        });
      }

      // 5. Create First Attendance record (if project & worker exist and attendance requested)
      if (createdProject && createdWorker && attendance && attendance.date) {
        const attendanceDate = new Date(attendance.date);
        attendanceDate.setUTCHours(0, 0, 0, 0);

        await tx.attendance.create({
          data: {
            organizationId: org.id,
            projectId: createdProject.id,
            workerId: createdWorker.id,
            date: attendanceDate,
            status: attendance.status || 'PRESENT',
            wageForDay:
              attendance.status === 'HALF_DAY'
                ? createdWorker.dailyWage / 2
                : attendance.status === 'PRESENT'
                ? createdWorker.dailyWage
                : 0,
          },
        });
      }

      return { org, createdProject, createdWorker };
    });

    // Update JWT token with new organization ID and role OWNER
    const updatedToken = await signJWT({
      userId: session.userId,
      email: session.email,
      name: session.name,
      organizationId: result.org.id,
      role: 'OWNER',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Organization setup completed successfully!',
      organization: result.org,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: updatedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to complete organization onboarding. Please try again.' },
      { status: 500 }
    );
  }
}
