import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { verifyDayLock } from '@/lib/auth/day-lock';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const role = normalizeRole(session.role);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const siteId = searchParams.get('siteId');
    const receivedById = searchParams.get('receivedById');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    // If partner (and not owner/manager), can only see receipts for their assigned projects/sites or receipts they received
    if (role === 'PARTNER') {
      where.OR = [
        { receivedById: session.userId },
        { project: { partnerId: session.userId } },
        { site: { partnerId: session.userId } },
      ];
    }

    if (projectId && projectId !== 'ALL') where.projectId = projectId;
    if (siteId && siteId !== 'ALL') where.siteId = siteId;
    if (receivedById && receivedById !== 'ALL') where.receivedById = receivedById;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        ...(where.OR || []),
        { clientName: { contains: q } },
        { reference: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const receipts = await prisma.projectReceipt.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, projectCode: true, projectValue: true } },
        site: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);

    return NextResponse.json({
      receipts,
      summary: {
        totalAmount,
        count: receipts.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching project receipts:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch receipts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'SITE_SUPERVISOR', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const body = await req.json();
    const {
      projectId,
      siteId,
      receivedById: inputReceivedById,
      clientName,
      amount,
      date,
      paymentMethod = 'CASH',
      receivedIn = 'WALLET', // 'WALLET' or 'BANK'
      bankAccountId,
      purpose = 'RUNNING_BILL',
      reference,
      notes,
    } = body;

    if (!projectId || !clientName || !amount || amount <= 0 || !date) {
      return NextResponse.json(
        { error: 'Project, client name, valid amount, and date are required' },
        { status: 400 }
      );
    }

    if (receivedIn === 'BANK' && !bankAccountId) {
      return NextResponse.json(
        { error: 'Bank account is required when Money In is received in Bank' },
        { status: 400 }
      );
    }

    const receiptDate = new Date(date);

    // Resolve recipient partner/user (defaults to session.userId if not provided)
    let receivedById = session.userId;
    if (inputReceivedById && typeof inputReceivedById === 'string' && inputReceivedById.trim()) {
      const targetUser = await prisma.organizationUser.findFirst({
        where: {
          organizationId: orgId,
          userId: inputReceivedById.trim(),
          status: 'ACTIVE',
        },
      });
      if (targetUser) {
        receivedById = targetUser.userId;
      }
    }

    const isBank = receivedIn === 'BANK' && Boolean(bankAccountId);

    // Check Day Lock on date if crediting partner wallet
    if (!isBank) {
      const lockCheck = await verifyDayLock({
        organizationId: orgId,
        userId: receivedById,
        date: receiptDate,
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'ProjectReceipt',
        entityId: 'NEW',
        action: 'UPDATE',
      });

      if (lockCheck.locked) {
        return NextResponse.json({ error: lockCheck.message }, { status: 403 });
      }
    }

    const parsedAmount = Math.max(0, parseFloat(amount));

    // Atomic transaction: create receipt, bank transaction (if bank), & update project receivedAmount
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.projectReceipt.create({
        data: {
          organizationId: orgId,
          projectId,
          siteId: siteId || null,
          receivedById,
          clientName: clientName.trim(),
          amount: parsedAmount,
          date: receiptDate,
          paymentMethod: isBank ? (paymentMethod === 'CASH' ? 'BANK' : paymentMethod) : paymentMethod,
          receivedIn: isBank ? 'BANK' : 'WALLET',
          bankAccountId: isBank ? bankAccountId : null,
          purpose,
          reference: reference?.trim() || null,
          notes: notes?.trim() || null,
        },
        include: {
          project: { select: { id: true, name: true, projectCode: true } },
          site: { select: { id: true, name: true } },
          receivedBy: { select: { id: true, name: true } },
          bankAccount: { select: { id: true, name: true, bankName: true } },
        },
      });

      // If deposited directly in Bank, create linked BankTransaction
      if (isBank) {
        await tx.bankTransaction.create({
          data: {
            organizationId: orgId,
            bankAccountId,
            type: 'RECEIPT',
            amount: parsedAmount,
            date: receiptDate,
            partnerId: receivedById,
            projectId,
            reference: reference?.trim() || receipt.id,
            notes: notes?.trim() || `Client receipt from ${clientName.trim()}`,
            createdById: session.userId,
          },
        });
      }

      // Recalculate project received amount
      const allActiveReceipts = await tx.projectReceipt.aggregate({
        where: { projectId, deletedAt: null },
        _sum: { amount: true },
      });

      const updatedReceivedAmount = allActiveReceipts._sum.amount || 0;

      return { receipt, updatedReceivedAmount };
    });

    return NextResponse.json(
      {
        receipt: result.receipt,
        projectReceivedAmount: result.updatedReceivedAmount,
        message: 'Client payment received and credited to partner wallet successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating project receipt:', error);
    return NextResponse.json({ error: error.message || 'Failed to record receipt' }, { status: 500 });
  }
}
