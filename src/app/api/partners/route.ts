import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { calculateWalletBalance } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'ACCOUNTANT',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    // Get all users in the organization with their memberships
    const memberships = await prisma.organizationUser.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            status: true,
            partnerId: true,
          },
        },
      },
    });

    const partnerMemberships = memberships.filter(
      (m: any) => normalizeRole(m.role) === 'PARTNER' || normalizeRole(m.role) === 'OWNER'
    );
    const supervisorMemberships = memberships.filter(
      (m: any) => normalizeRole(m.role) === 'SITE_SUPERVISOR' || normalizeRole(m.role) === 'SUPERVISOR'
    );

    // For each partner, gather their assigned projects, sites, supervisors, and wallet balance
    const partnersData = await Promise.all(
      partnerMemberships.map(async (pm: any) => {
        const user = pm.user;

        // Assignments
        const assignments = await prisma.partnerAssignment.findMany({
          where: {
            organizationId: orgId,
            partnerId: user.id,
            deletedAt: null,
          },
          include: {
            project: { select: { id: true, name: true, projectCode: true } },
            site: { select: { id: true, name: true } },
          },
        });

        // Directly assigned projects & sites
        const directProjects = await prisma.project.findMany({
          where: {
            organizationId: orgId,
            partnerId: user.id,
            deletedAt: null,
          },
          select: { id: true, name: true, projectCode: true, projectValue: true },
        });

        const directSites = await prisma.projectSite.findMany({
          where: {
            organizationId: orgId,
            partnerId: user.id,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            projectId: true,
            project: { select: { id: true, name: true } },
          },
        });

        // Linked supervisors
        const assignedSupervisors = supervisorMemberships
          .filter((sm: any) => sm.user.partnerId === user.id)
          .map((sm: any) => ({
            id: sm.user.id,
            name: sm.user.name,
            email: sm.user.email,
            mobile: sm.user.mobile,
          }));

        // Wallet Balance calculation
        const [moneyInAgg, transfersInAgg, transfersOutAgg, expensesAgg] = await Promise.all([
          prisma.projectReceipt.aggregate({
            where: { organizationId: orgId, receivedById: user.id, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, toUserId: user.id, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, fromUserId: user.id, deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.expense.aggregate({
            where: { organizationId: orgId, walletOwnerId: user.id, deletedAt: null },
            _sum: { amount: true },
          }),
        ]);

        const wallet = calculateWalletBalance({
          totalMoneyIn: moneyInAgg._sum.amount || 0,
          totalTransfersIn: transfersInAgg._sum.amount || 0,
          totalTransfersOut: transfersOutAgg._sum.amount || 0,
          totalExpenses: expensesAgg._sum.amount || 0,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: pm.role,
          walletBalance: wallet.balance,
          totalCredits: wallet.totalCredits,
          totalDebits: wallet.totalDebits,
          assignments,
          directProjects,
          directSites,
          supervisors: assignedSupervisors,
        };
      })
    );

    // List of active supervisors (for assignment dropdown)
    const allSupervisors = supervisorMemberships.map((sm: any) => ({
      id: sm.user.id,
      name: sm.user.name,
      email: sm.user.email,
      mobile: sm.user.mobile,
      partnerId: sm.user.partnerId,
    }));

    return NextResponse.json({
      partners: partnersData,
      supervisors: allSupervisors,
    });
  } catch (error: any) {
    console.error('Error fetching partners:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const { action, partnerId, projectId, siteId, supervisorId } = body;

    if (action === 'ASSIGN_SITE') {
      if (!partnerId || !projectId) {
        return NextResponse.json({ error: 'partnerId and projectId are required' }, { status: 400 });
      }

      // Check if assignment exists
      const existing = await prisma.partnerAssignment.findFirst({
        where: {
          organizationId: orgId,
          partnerId,
          projectId,
          siteId: siteId || null,
        },
      });

      if (existing) {
        if (existing.deletedAt) {
          // Restore
          await prisma.partnerAssignment.update({
            where: { id: existing.id },
            data: { deletedAt: null, deletedById: null },
          });
        }
      } else {
        await prisma.partnerAssignment.create({
          data: {
            organizationId: orgId,
            partnerId,
            projectId,
            siteId: siteId || null,
          },
        });
      }

      // Also tag project/site directly if siteId is specified
      if (siteId) {
        await prisma.projectSite.update({
          where: { id: siteId },
          data: { partnerId },
        });
      } else {
        await prisma.project.update({
          where: { id: projectId },
          data: { partnerId },
        });
      }

      return NextResponse.json({ success: true, message: 'Partner assigned to site successfully' });
    }

    if (action === 'UNASSIGN_SITE') {
      const { assignmentId } = body;
      if (!assignmentId) {
        return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
      }

      const assignment = await prisma.partnerAssignment.findUnique({
        where: { id: assignmentId },
      });

      if (assignment) {
        await prisma.partnerAssignment.update({
          where: { id: assignmentId },
          data: { deletedAt: new Date(), deletedById: session.userId },
        });

        if (assignment.siteId) {
          await prisma.projectSite.update({
            where: { id: assignment.siteId },
            data: { partnerId: null },
          });
        }
      }

      return NextResponse.json({ success: true, message: 'Partner unassigned successfully' });
    }

    if (action === 'ASSIGN_SUPERVISOR') {
      if (!supervisorId || !partnerId) {
        return NextResponse.json({ error: 'supervisorId and partnerId are required' }, { status: 400 });
      }

      await prisma.user.update({
        where: { id: supervisorId },
        data: { partnerId },
      });

      return NextResponse.json({ success: true, message: 'Supervisor assigned to partner successfully' });
    }

    if (action === 'UNASSIGN_SUPERVISOR') {
      if (!supervisorId) {
        return NextResponse.json({ error: 'supervisorId is required' }, { status: 400 });
      }

      await prisma.user.update({
        where: { id: supervisorId },
        data: { partnerId: null },
      });

      return NextResponse.json({ success: true, message: 'Supervisor unassigned successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error modifying partner assignment:', error);
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 });
  }
}
