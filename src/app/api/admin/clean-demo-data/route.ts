import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER']);
    if (!auth.authorized) return auth.response;
    const orgId = auth.session.organizationId;

    // Purge all operational business and demo data
    const [
      att,
      work,
      txs,
      pays,
      allow,
      sals,
      exp,
      mTrans,
      mUsage,
      mRec,
      mat,
      sup,
      pBud,
      pSites,
      workers,
      qItems,
      quotes,
      projects,
      notifs,
      logs,
    ] = await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { organizationId: orgId } }),
      prisma.workRecord.deleteMany({ where: { organizationId: orgId } }),
      prisma.transaction.deleteMany({ where: { organizationId: orgId } }),
      prisma.payment.deleteMany({ where: { organizationId: orgId } }),
      prisma.allowance.deleteMany({ where: { organizationId: orgId } }),
      prisma.salaryRecord.deleteMany({ where: { organizationId: orgId } }),
      prisma.expense.deleteMany({ where: { organizationId: orgId } }),
      prisma.materialTransfer.deleteMany({ where: { organizationId: orgId } }),
      prisma.materialUsage.deleteMany({ where: { organizationId: orgId } }),
      prisma.materialReceipt.deleteMany({ where: { organizationId: orgId } }),
      prisma.material.deleteMany({ where: { organizationId: orgId } }),
      prisma.supplier.deleteMany({ where: { organizationId: orgId } }),
      prisma.projectBudget.deleteMany({ where: { organizationId: orgId } }),
      prisma.projectSite.deleteMany({ where: { organizationId: orgId } }),
      prisma.worker.deleteMany({ where: { organizationId: orgId } }),
      prisma.quotationItem.deleteMany({ where: { quotation: { organizationId: orgId } } }),
      prisma.quotation.deleteMany({ where: { organizationId: orgId } }),
      prisma.project.deleteMany({ where: { organizationId: orgId } }),
      prisma.notification.deleteMany({ where: { organizationId: orgId } }),
      prisma.auditLog.deleteMany({ where: { organizationId: orgId } }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'All demo and test entries have been wiped clean! System is ready for fresh entries.',
      cleared: {
        projects: projects.count,
        sites: pSites.count,
        workers: workers.count,
        attendance: att.count,
        workRecords: work.count,
        expenses: exp.count,
        payments: pays.count,
        allowances: allow.count,
        salaryRecords: sals.count,
        transactions: txs.count,
        materials: mat.count,
        receipts: mRec.count,
        usages: mUsage.count,
        transfers: mTrans.count,
        suppliers: sup.count,
        quotations: quotes.count,
      },
    });
  } catch (error: any) {
    console.error('Clean demo data error:', error);
    return NextResponse.json({ error: error.message || 'Failed to clean demo data' }, { status: 500 });
  }
}
