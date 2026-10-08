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
    const userRole = normalizeRole(session.role);

    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId') || 'ALL';
    const period = searchParams.get('period') || 'all';
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');

    // 1. Calculate Date Range Filters
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    const now = new Date();
    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'weekly') {
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diffToMonday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'custom') {
      if (customStartDate) {
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
      }
      if (customEndDate) {
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;
    const hasDateFilter = startDate !== null || endDate !== null;

    // 2. Fetch all Partners & Owners in Organization
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
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const partnerMembers = memberships.filter((m) =>
      ['PARTNER', 'OWNER', 'MANAGER'].includes(normalizeRole(m.role))
    );

    // 3. For each partner/owner, compute live balance and period metrics
    const partnersSummary = await Promise.all(
      partnerMembers.map(async (m) => {
        const uId = m.userId;

        // All-Time Aggregates (Single source of truth for current live wallet balance)
        const [
          allReceiptsAgg,
          allTransfersInAgg,
          allBankWithdrawalsAgg,
          allTransfersOutAgg,
          allExpensesAgg,
          allBankDepositsAgg,
        ] = await Promise.all([
          // Inflow: Direct receipts in hand/cash
          prisma.projectReceipt.aggregate({
            where: {
              organizationId: orgId,
              receivedById: uId,
              deletedAt: null,
              OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
            },
            _sum: { amount: true },
          }),
          // Inflow: Transfers from other users
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, toUserId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          // Inflow: Bank transfers to partner
          prisma.bankTransaction.aggregate({
            where: {
              organizationId: orgId,
              partnerId: uId,
              type: 'TRANSFER_TO_PARTNER',
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
          // Outflow: Transfers to supervisors/workers/partners
          prisma.fundTransfer.aggregate({
            where: { organizationId: orgId, fromUserId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          // Outflow: Expenses paid from wallet
          prisma.expense.aggregate({
            where: { organizationId: orgId, walletOwnerId: uId, deletedAt: null },
            _sum: { amount: true },
          }),
          // Outflow: Bank deposits by partner
          prisma.bankTransaction.aggregate({
            where: {
              organizationId: orgId,
              partnerId: uId,
              type: 'TRANSFER_FROM_PARTNER',
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
        ]);

        const allTimeBalance = calculateWalletBalance({
          totalMoneyIn: allReceiptsAgg._sum.amount || 0,
          totalTransfersIn: allTransfersInAgg._sum.amount || 0,
          totalBankWithdrawals: allBankWithdrawalsAgg._sum.amount || 0,
          totalTransfersOut: allTransfersOutAgg._sum.amount || 0,
          totalExpenses: allExpensesAgg._sum.amount || 0,
          totalBankDeposits: allBankDepositsAgg._sum.amount || 0,
        });

        // Period-specific Aggregates
        const periodReceiptsWhere: any = {
          organizationId: orgId,
          receivedById: uId,
          deletedAt: null,
        };
        const periodTransfersInWhere: any = {
          organizationId: orgId,
          toUserId: uId,
          deletedAt: null,
        };
        const periodTransfersOutWhere: any = {
          organizationId: orgId,
          fromUserId: uId,
          deletedAt: null,
        };
        const periodExpensesWhere: any = {
          organizationId: orgId,
          walletOwnerId: uId,
          deletedAt: null,
        };

        if (hasDateFilter) {
          periodReceiptsWhere.date = dateFilter;
          periodTransfersInWhere.date = dateFilter;
          periodTransfersOutWhere.date = dateFilter;
          periodExpensesWhere.date = dateFilter;
        }

        const [pReceipts, pTransfersIn, pTransfersOut, pExpenses] = await Promise.all([
          prisma.projectReceipt.aggregate({
            where: periodReceiptsWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.fundTransfer.aggregate({
            where: periodTransfersInWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.fundTransfer.aggregate({
            where: periodTransfersOutWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.expense.aggregate({
            where: periodExpensesWhere,
            _sum: { amount: true },
            _count: { id: true },
          }),
        ]);

        return {
          id: uId,
          name: m.user.name,
          email: m.user.email,
          mobile: m.user.mobile,
          role: normalizeRole(m.role),
          // Live Cash Balance in hand
          currentBalance: allTimeBalance.balance,
          totalCredits: allTimeBalance.totalCredits,
          totalDebits: allTimeBalance.totalDebits,
          // Period Stats
          period: {
            receiptsTotal: pReceipts._sum.amount || 0,
            receiptsCount: pReceipts._count.id || 0,
            transfersInTotal: pTransfersIn._sum.amount || 0,
            transfersInCount: pTransfersIn._count.id || 0,
            transfersOutTotal: pTransfersOut._sum.amount || 0,
            transfersOutCount: pTransfersOut._count.id || 0,
            expensesTotal: pExpenses._sum.amount || 0,
            expensesCount: pExpenses._count.id || 0,
          },
        };
      })
    );

    // 4. If a specific partner or ledger query is requested
    let ledgerEntries: any[] = [];
    const targetPartnerId = partnerId !== 'ALL' ? partnerId : null;

    if (targetPartnerId) {
      // Build Ledger for this specific partner
      const receiptsWhere: any = {
        organizationId: orgId,
        receivedById: targetPartnerId,
        deletedAt: null,
      };
      const transfersInWhere: any = {
        organizationId: orgId,
        toUserId: targetPartnerId,
        deletedAt: null,
      };
      const bankTransfersInWhere: any = {
        organizationId: orgId,
        partnerId: targetPartnerId,
        type: 'TRANSFER_TO_PARTNER',
        deletedAt: null,
      };
      const transfersOutWhere: any = {
        organizationId: orgId,
        fromUserId: targetPartnerId,
        deletedAt: null,
      };
      const expensesWhere: any = {
        organizationId: orgId,
        walletOwnerId: targetPartnerId,
        deletedAt: null,
      };
      const bankDepositsWhere: any = {
        organizationId: orgId,
        partnerId: targetPartnerId,
        type: 'TRANSFER_FROM_PARTNER',
        deletedAt: null,
      };

      if (hasDateFilter) {
        receiptsWhere.date = dateFilter;
        transfersInWhere.date = dateFilter;
        bankTransfersInWhere.date = dateFilter;
        transfersOutWhere.date = dateFilter;
        expensesWhere.date = dateFilter;
        bankDepositsWhere.date = dateFilter;
      }

      const [receipts, transfersIn, bankTransfersIn, transfersOut, expenses, bankDeposits] =
        await Promise.all([
          prisma.projectReceipt.findMany({
            where: receiptsWhere,
            include: {
              project: { select: { id: true, name: true, projectCode: true } },
              site: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.fundTransfer.findMany({
            where: transfersInWhere,
            include: {
              fromUser: { select: { id: true, name: true, email: true } },
              project: { select: { id: true, name: true } },
              site: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.bankTransaction.findMany({
            where: bankTransfersInWhere,
            include: {
              bankAccount: { select: { id: true, name: true, bankName: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.fundTransfer.findMany({
            where: transfersOutWhere,
            include: {
              toUser: { select: { id: true, name: true, email: true } },
              toWorker: { select: { id: true, name: true, workerCode: true } },
              project: { select: { id: true, name: true } },
              site: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.expense.findMany({
            where: expensesWhere,
            include: {
              project: { select: { id: true, name: true } },
              site: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
          }),
          prisma.bankTransaction.findMany({
            where: bankDepositsWhere,
            include: {
              bankAccount: { select: { id: true, name: true, bankName: true } },
            },
            orderBy: { date: 'desc' },
          }),
        ]);

      // Normalize into unified ledger entries
      receipts.forEach((r) => {
        ledgerEntries.push({
          id: `rcpt-${r.id}`,
          rawId: r.id,
          date: r.date.toISOString(),
          type: 'RECEIPT',
          categoryLabel: 'Payment Received from Client',
          title: r.clientName,
          subtitle: r.project?.name + (r.site?.name ? ` • ${r.site.name}` : ''),
          credit: r.amount,
          debit: 0,
          paymentMethod: r.paymentMethod,
          receivedIn: r.receivedIn || 'WALLET',
          reference: r.reference,
          notes: r.notes,
        });
      });

      transfersIn.forEach((t) => {
        ledgerEntries.push({
          id: `trin-${t.id}`,
          rawId: t.id,
          date: t.date.toISOString(),
          type: 'TRANSFER_IN',
          categoryLabel: 'Transfer Received (Aaya hua Transfer)',
          title: `From: ${t.fromUser?.name || 'Owner/Partner'}`,
          subtitle: t.purpose + (t.project?.name ? ` • ${t.project.name}` : ''),
          credit: t.amount,
          debit: 0,
          paymentMethod: t.paymentMethod,
          reference: t.reference,
          notes: t.notes,
        });
      });

      bankTransfersIn.forEach((bt) => {
        ledgerEntries.push({
          id: `btin-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: 'BANK_WITHDRAWAL',
          categoryLabel: 'Bank Withdrawal (Bank se Nikala)',
          title: `Bank: ${bt.bankAccount?.bankName} (${bt.bankAccount?.name})`,
          subtitle: 'Cash withdrawn from company bank into wallet',
          credit: bt.amount,
          debit: 0,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
        });
      });

      transfersOut.forEach((t) => {
        const recipientName = t.toUser?.name || t.toWorker?.name || 'Partner/Supervisor';
        ledgerEntries.push({
          id: `trout-${t.id}`,
          rawId: t.id,
          date: t.date.toISOString(),
          type: 'TRANSFER_OUT',
          categoryLabel: 'Transfer Out (Diya hua Transfer)',
          title: `To: ${recipientName}`,
          subtitle: t.purpose + (t.project?.name ? ` • ${t.project.name}` : ''),
          credit: 0,
          debit: t.amount,
          paymentMethod: t.paymentMethod,
          reference: t.reference,
          notes: t.notes,
        });
      });

      expenses.forEach((e) => {
        ledgerEntries.push({
          id: `exp-${e.id}`,
          rawId: e.id,
          date: e.date.toISOString(),
          type: 'EXPENSE',
          categoryLabel: `Site Expense: ${e.category}`,
          title: e.description || e.notes || e.category,
          subtitle: e.project?.name + (e.site?.name ? ` • ${e.site.name}` : ''),
          credit: 0,
          debit: e.amount,
          paymentMethod: e.paymentMethod,
          reference: e.vendorName || null,
          notes: e.notes,
        });
      });

      bankDeposits.forEach((bt) => {
        ledgerEntries.push({
          id: `btdep-${bt.id}`,
          rawId: bt.id,
          date: bt.date.toISOString(),
          type: 'BANK_DEPOSIT',
          categoryLabel: 'Bank Deposit (Bank me Jama)',
          title: `Bank: ${bt.bankAccount?.bankName} (${bt.bankAccount?.name})`,
          subtitle: 'Partner deposited cash into bank account',
          credit: 0,
          debit: bt.amount,
          paymentMethod: 'BANK',
          reference: bt.reference,
          notes: bt.notes,
        });
      });

      // Sort chronological descending
      ledgerEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // 5. Fetch Recent Client Payment Receipts (for "Transfer from Received Payment" feature)
    const recentReceipts = await prisma.projectReceipt.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        project: { select: { id: true, name: true, projectCode: true } },
        site: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 25,
    });

    // 6. Fetch Projects for dropdown selection
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        projectCode: true,
        sites: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      partners: partnersSummary,
      selectedPartnerId: targetPartnerId,
      ledger: ledgerEntries,
      recentReceipts,
      projects,
      currentUserId: session.userId,
      userRole,
    });
  } catch (error: any) {
    console.error('Error fetching partner hisaab:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch partner hisaab' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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
    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(role);

    const body = await req.json();
    const {
      fromUserId: inputFromUserId,
      toUserId,
      amount,
      date,
      paymentMethod = 'CASH',
      purpose = 'PARTNER_TRANSFER',
      projectId,
      siteId,
      receiptId,
      reference,
      notes,
    } = body;

    if (!toUserId) {
      return NextResponse.json(
        { error: 'Please select the recipient partner or owner.' },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Please enter a valid transfer amount greater than ₹0.' },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: 'Please select a transfer date.' },
        { status: 400 }
      );
    }

    const fromUserId = isOwnerOrManager && inputFromUserId ? inputFromUserId : session.userId;
    const transferDate = new Date(date);

    // Verify recipient belongs to the same organization
    const recipientMembership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: toUserId,
        status: 'ACTIVE',
      },
      include: { user: true },
    });

    if (!recipientMembership) {
      return NextResponse.json(
        { error: 'Recipient partner not found in this organization.' },
        { status: 404 }
      );
    }

    // Optional receipt reference enrichment
    let enrichedNotes = notes?.trim() || '';
    if (receiptId) {
      const receipt = await prisma.projectReceipt.findFirst({
        where: { id: receiptId, organizationId: orgId, deletedAt: null },
        include: { project: true },
      });
      if (receipt) {
        const prefix = `[Transferred from Client Payment: ${receipt.clientName} (₹${receipt.amount}) - ${receipt.project.name}]`;
        enrichedNotes = enrichedNotes ? `${prefix} ${enrichedNotes}` : prefix;
      }
    }

    // Create FundTransfer
    const transfer = await prisma.fundTransfer.create({
      data: {
        organizationId: orgId,
        transferType: 'PARTNER_TO_PARTNER',
        fromUserId,
        toUserId,
        projectId: projectId || null,
        siteId: siteId || null,
        amount: parsedAmount,
        date: transferDate,
        paymentMethod,
        purpose,
        reference: reference?.trim() || null,
        notes: enrichedNotes || null,
      },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      transfer,
      message: `Successfully transferred ₹${parsedAmount.toLocaleString('en-IN')} to ${recipientMembership.user.name}!`,
    });
  } catch (error: any) {
    console.error('Error creating partner transfer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record partner transfer' },
      { status: 500 }
    );
  }
}
