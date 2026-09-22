import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { calculateWorkerBalance } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get('workerId');
    const projectId = searchParams.get('projectId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!workerId) {
      return NextResponse.json({ error: 'Worker ID is required for Khata ledger' }, { status: 400 });
    }

    const worker = await prisma.worker.findFirst({
      where: { id: workerId, organizationId: orgId, deletedAt: null },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    const dateFilter: any = {};
    if (startDateStr) dateFilter.gte = new Date(startDateStr);
    if (endDateStr) {
      const end = new Date(endDateStr);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // 1. Fetch Attendance (Wages Earned - Credits)
    const attendance = await prisma.attendance.findMany({
      where: {
        workerId,
        organizationId: orgId,
        wageForDay: { gt: 0 },
        ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
        ...(startDateStr || endDateStr ? { date: dateFilter } : {}),
      },
      include: {
        project: { select: { name: true, projectCode: true } },
        site: { select: { name: true } },
      },
    });

    // 2. Fetch Allowances (Credits)
    const allowances = await prisma.allowance.findMany({
      where: {
        workerId,
        organizationId: orgId,
        deletedAt: null,
        ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
        ...(startDateStr || endDateStr ? { date: dateFilter } : {}),
      },
      include: {
        project: { select: { name: true } },
        site: { select: { name: true } },
      },
    });

    // 3. Fetch Payments & Advances (Debits)
    const payments = await prisma.payment.findMany({
      where: {
        workerId,
        organizationId: orgId,
        deletedAt: null,
        ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
        ...(startDateStr || endDateStr ? { date: dateFilter } : {}),
      },
      include: {
        project: { select: { name: true } },
        site: { select: { name: true } },
      },
    });

    // Unify all ledger line items
    interface LedgerLineItem {
      id: string;
      date: Date;
      type: 'SALARY' | 'ALLOWANCE' | 'ADVANCE' | 'PAYMENT' | 'ADJUSTMENT';
      description: string;
      project?: string | null;
      site?: string | null;
      debit: number;
      credit: number;
      balance: number;
      method?: string | null;
      reference?: string | null;
    }

    const lineItems: LedgerLineItem[] = [];

    // Map Attendance to Credit
    attendance.forEach((att) => {
      const statusLabel = att.status === 'HALF_DAY' ? 'Half Day Wage' : 'Full Day Wage';
      const otText = att.overtimeHours > 0 ? ` + ${att.overtimeHours}h OT` : '';
      lineItems.push({
        id: `att-${att.id}`,
        date: new Date(att.date),
        type: 'SALARY',
        description: `Daily Turnout: ${statusLabel}${otText}`,
        project: att.project?.name,
        site: att.site?.name,
        debit: 0,
        credit: att.wageForDay,
        balance: 0,
      });
    });

    // Map Allowances to Credit
    allowances.forEach((alw) => {
      lineItems.push({
        id: `alw-${alw.id}`,
        date: new Date(alw.date),
        type: 'ALLOWANCE',
        description: `Allowance: ${alw.type}${alw.description ? ` (${alw.description})` : ''}`,
        project: alw.project?.name,
        site: alw.site?.name,
        debit: 0,
        credit: alw.amount,
        balance: 0,
      });
    });

    // Map Payments / Advances to Debit
    payments.forEach((pmt) => {
      const isAdvance = pmt.transactionType === 'ADVANCE';
      lineItems.push({
        id: `pmt-${pmt.id}`,
        date: new Date(pmt.date),
        type: isAdvance ? 'ADVANCE' : 'PAYMENT',
        description: isAdvance
          ? `Cash Advance Given${pmt.notes ? ` - ${pmt.notes}` : ''}`
          : `Wage Payment Settled (${pmt.paymentMethod})${pmt.reference ? ` Ref: ${pmt.reference}` : ''}`,
        project: pmt.project?.name,
        site: pmt.site?.name,
        debit: pmt.amount,
        credit: 0,
        balance: 0,
        method: pmt.paymentMethod,
        reference: pmt.reference,
      });
    });

    // Sort chronologically ascending to compute running balance
    lineItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    lineItems.forEach((item) => {
      runningBalance += item.credit - item.debit;
      item.balance = Math.round(runningBalance * 100) / 100;
    });

    // Totals for Worker Summary (Section 20 & 66)
    const totalEarnedSalary = attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
    const totalAllowances = allowances.reduce((sum, a) => sum + (a.amount || 0), 0);
    const totalAdvances = payments
      .filter((p) => p.transactionType === 'ADVANCE')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPayments = payments
      .filter((p) => p.transactionType !== 'ADVANCE')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const summary = calculateWorkerBalance({
      totalEarnedSalary,
      totalAllowances,
      totalAdvances,
      totalPayments,
    });

    return NextResponse.json({
      worker: {
        id: worker.id,
        workerCode: worker.workerCode,
        name: worker.name,
        category: worker.category,
        dailyWage: worker.dailyWage,
        mobile: worker.mobile,
      },
      summary: {
        totalEarned: totalEarnedSalary,
        totalAllowances,
        totalAdvances,
        totalPaid: totalPayments,
        remainingPayable: summary.remainingPayable,
        paymentStatus: summary.paymentStatus,
        totalCredits: summary.totalCredits,
        totalDebits: summary.totalDebits,
      },
      ledger: lineItems.reverse(), // Most recent first for ledger table display
    });
  } catch (error: any) {
    console.error('Khata GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve Khata ledger' }, { status: 500 });
  }
}
