import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
      'ACCOUNTANT',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const role = normalizeRole(session.role);

    const { searchParams } = new URL(req.url);
    const fromUserId = searchParams.get('fromUserId');
    const toUserId = searchParams.get('toUserId');
    const toWorkerId = searchParams.get('toWorkerId');
    const transferType = searchParams.get('transferType');
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    // If Partner or Supervisor, filter to transfers where they are sender or receiver
    if (role === 'PARTNER' || role === 'SITE_SUPERVISOR') {
      where.OR = [{ fromUserId: session.userId }, { toUserId: session.userId }];
    }

    if (fromUserId && fromUserId !== 'ALL') where.fromUserId = fromUserId;
    if (toUserId && toUserId !== 'ALL') where.toUserId = toUserId;
    if (toWorkerId && toWorkerId !== 'ALL') where.toWorkerId = toWorkerId;
    if (transferType && transferType !== 'ALL') where.transferType = transferType;
    if (projectId && projectId !== 'ALL') where.projectId = projectId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transfers = await prisma.fundTransfer.findMany({
      where,
      include: {
        fromUser: { select: { id: true, name: true, email: true, mobile: true } },
        toUser: { select: { id: true, name: true, email: true, mobile: true } },
        toWorker: { select: { id: true, name: true, workerCode: true, category: true, mobile: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalTransferred = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);

    return NextResponse.json({
      transfers,
      summary: {
        totalTransferred,
        count: transfers.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching fund transfers:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch transfers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'SUPERVISOR']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(normalizeRole(session.role));

    const body = await req.json();
    const {
      transferType, // PARTNER_TO_SUPERVISOR, PARTNER_TO_WORKER, PARTNER_TO_PARTNER, SUPERVISOR_TO_WORKER, PARTNER_DRAWING
      fromUserId: inputFromUserId,
      toUserId,
      toWorkerId,
      projectId,
      siteId,
      amount,
      date,
      paymentMethod = 'CASH',
      purpose = 'SITE_EXPENSE',
      notes,
      reference,
    } = body;

    if (!transferType || !amount || amount <= 0 || !date) {
      return NextResponse.json(
        { error: 'Transfer type, valid amount (> 0), and date are required' },
        { status: 400 }
      );
    }

    const fromUserId = (isOwnerOrManager && inputFromUserId) ? inputFromUserId : session.userId;
    const transferDate = new Date(date);

    // Validate recipient based on type
    const isWorkerTransfer =
      transferType === 'PARTNER_TO_WORKER' ||
      transferType === 'SUPERVISOR_TO_WORKER' ||
      Boolean(toWorkerId);

    if (isWorkerTransfer && !toWorkerId) {
      return NextResponse.json({ error: 'Worker must be specified for worker payment transfer' }, { status: 400 });
    }

    if (
      !isWorkerTransfer &&
      transferType !== 'PARTNER_DRAWING' &&
      !toUserId
    ) {
      return NextResponse.json({ error: 'Recipient user must be specified for transfer' }, { status: 400 });
    }

    // Check Day Lock on date for the sender
    const lockCheck = await verifyDayLock({
      organizationId: orgId,
      userId: fromUserId,
      date: transferDate,
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'FundTransfer',
      entityId: 'NEW',
      action: 'UPDATE',
    });

    if (lockCheck.locked) {
      return NextResponse.json({ error: lockCheck.message }, { status: 403 });
    }

    // Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create FundTransfer record
      const transfer = await tx.fundTransfer.create({
        data: {
          organizationId: orgId,
          transferType,
          fromUserId,
          toUserId: isWorkerTransfer ? null : toUserId || null,
          toWorkerId: isWorkerTransfer ? toWorkerId : null,
          projectId: projectId || null,
          siteId: siteId || null,
          amount: parseFloat(amount),
          date: transferDate,
          paymentMethod,
          purpose,
          notes: notes?.trim() || null,
          reference: reference?.trim() || null,
        },
      });

      // 2. If transfer is to a worker, create linked Payment & Transaction in worker Khata
      let createdPayment = null;
      if (isWorkerTransfer && toWorkerId) {
        const isAdvance =
          purpose === 'ADVANCE' ||
          purpose === 'Worker Advance' ||
          purpose?.toLowerCase().includes('advance') ||
          purpose?.toLowerCase().includes('kharcha');
        const paymentType = isAdvance ? 'ADVANCE' : 'PAYMENT';

        createdPayment = await tx.payment.create({
          data: {
            organizationId: orgId,
            workerId: toWorkerId,
            projectId: projectId || null,
            siteId: siteId || null,
            fundTransferId: transfer.id,
            date: transferDate,
            transactionType: paymentType,
            amount: parseFloat(amount),
            paymentMethod,
            reference: reference || `Transfer #${transfer.id.slice(-6)}`,
            notes: `Paid by ${session.name} via Cash Book transfer. ${notes || ''}`.trim(),
          },
        });

        // Update transfer with linkedPaymentId
        await tx.fundTransfer.update({
          where: { id: transfer.id },
          data: { linkedPaymentId: createdPayment.id },
        });

        // Calculate latest worker balance for transaction ledger record
        const previousTransaction = await tx.transaction.findFirst({
          where: { organizationId: orgId, workerId: toWorkerId, deletedAt: null },
          orderBy: { date: 'desc' },
        });

        const prevBalance = previousTransaction ? previousTransaction.balanceAfter : 0;
        const newBalance = Math.round((prevBalance - parseFloat(amount)) * 100) / 100;

        await tx.transaction.create({
          data: {
            organizationId: orgId,
            workerId: toWorkerId,
            date: transferDate,
            description: `${paymentType === 'ADVANCE' ? 'Advance' : 'Payment'} received from ${session.name}`,
            sourceType: paymentType,
            sourceId: createdPayment.id,
            debit: parseFloat(amount),
            credit: 0,
            balanceAfter: newBalance,
          },
        });
      }

      return { transfer, payment: createdPayment };
    });

    return NextResponse.json(
      {
        transfer: result.transfer,
        payment: result.payment,
        message: isWorkerTransfer
          ? 'Payment transferred and worker Khata automatically updated'
          : 'Fund transfer recorded successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error recording fund transfer:', error);
    return NextResponse.json({ error: error.message || 'Failed to record fund transfer' }, { status: 500 });
  }
}
