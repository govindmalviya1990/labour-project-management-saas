import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';
import { executeWorkerPayment } from '@/lib/finance/executeWorkerPayment';
import { executeExpense } from '@/lib/finance/executeExpense';
import { getPartnerWalletBalance } from '@/lib/finance/partnerWallet';
import { calculateWalletBalance, calculateBankBalance } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

const workerItemSchema = z.object({
  workerId: z.string().min(1, 'Worker ID is required'),
  category: z.string().min(1, 'Payment category is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  remarks: z.string().optional().nullable(),
});

const expenseItemSchema = z.object({
  category: z.string().min(1, 'Expense category is required'),
  description: z.string().optional().default(''),
  vendor: z.string().optional().nullable(),
  amount: z.number().positive('Amount must be greater than 0'),
});

const siteFolderSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  siteName: z.string().default('General / Headquarter'),
  workers: z.array(workerItemSchema).default([]),
  expenses: z.array(expenseItemSchema).default([]),
});

const multiSitePayloadSchema = z.object({
  sourceType: z.enum(['PARTNER', 'BANK']),
  sourceId: z.string().min(1, 'Source account is required'),
  method: z.string().default('CASH'),
  date: z.string().min(1, 'Payment date is required'),
  reference: z.string().optional().nullable(),
  folders: z.array(siteFolderSchema).min(1, 'At least one site folder is required'),
});

export async function POST(req: Request) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'PARTNER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const userRole = normalizeRole(session.role);

    const rawBody = await req.json();
    const validated = multiSitePayloadSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || 'Invalid multi-site data format' },
        { status: 400 }
      );
    }

    const { sourceType, sourceId, method, date, reference, folders } = validated.data;

    // Flatten all items to compute grand total
    let grandTotal = 0;
    let totalWorkersCount = 0;
    let totalExpensesCount = 0;

    const allWorkerIds = new Set<string>();

    for (const folder of folders) {
      for (const w of folder.workers) {
        grandTotal += w.amount;
        totalWorkersCount++;
        allWorkerIds.add(w.workerId);
      }
      for (const e of folder.expenses) {
        grandTotal += e.amount;
        totalExpensesCount++;
      }
    }

    grandTotal = Math.round(grandTotal * 100) / 100;

    if (totalWorkersCount === 0 && totalExpensesCount === 0) {
      return NextResponse.json(
        { error: 'All site folders are empty. Please add at least one worker or expense.' },
        { status: 400 }
      );
    }

    // Role check: Only OWNER can spend from another partner's wallet
    if (sourceType === 'PARTNER') {
      if (sourceId !== session.userId && userRole !== 'OWNER') {
        return NextResponse.json(
          { error: "Only owners are permitted to record expenses from another partner's wallet." },
          { status: 403 }
        );
      }
    }

    // Validate Date (IST safe, not in future)
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIST = nowIST.toISOString().split('T')[0];
    const txDate = new Date(date);
    if (isNaN(txDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date provided' }, { status: 400 });
    }
    const inputDateIST = new Date(txDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const rawDateStr = date.includes('T') ? inputDateIST : date.split(' ')[0];
    if (rawDateStr > todayIST) {
      return NextResponse.json(
        { error: `Date cannot be in the future (Today IST: ${todayIST})` },
        { status: 400 }
      );
    }

    // Fetch all referenced workers
    const workersList =
      allWorkerIds.size > 0
        ? await prisma.worker.findMany({
            where: { id: { in: Array.from(allWorkerIds) }, organizationId: orgId },
          })
        : [];
    const workersMap = new Map(workersList.map((w) => [w.id, w]));

    // Execute everything in a single atomic database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate Balance
      if (sourceType === 'PARTNER') {
        const walletCalc = await getPartnerWalletBalance(tx, orgId, sourceId);
        if (grandTotal > walletCalc.balance) {
          const err = new Error(
            `Insufficient partner cash balance. Available: ₹${walletCalc.balance.toLocaleString('en-IN')}, Required: ₹${grandTotal.toLocaleString('en-IN')}`
          );
          (err as any).statusCode = 400;
          throw err;
        }
      } else {
        const bankAccount = await tx.bankAccount.findFirst({
          where: { id: sourceId, organizationId: orgId, deletedAt: null },
        });
        if (!bankAccount) {
          const err = new Error('Selected bank account not found or deactivated');
          (err as any).statusCode = 404;
          throw err;
        }

        const [
          depositsAgg,
          receiptsAgg,
          transferFromPartnerAgg,
          withdrawalsAgg,
          paymentsAgg,
          transferToPartnerAgg,
        ] = await Promise.all([
          tx.bankTransaction.aggregate({
            where: { bankAccountId: bankAccount.id, type: 'DEPOSIT', deletedAt: null },
            _sum: { amount: true },
          }),
          tx.bankTransaction.aggregate({
            where: { bankAccountId: bankAccount.id, type: 'RECEIPT', deletedAt: null },
            _sum: { amount: true },
          }),
          tx.bankTransaction.aggregate({
            where: { bankAccountId: bankAccount.id, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
            _sum: { amount: true },
          }),
          tx.bankTransaction.aggregate({
            where: { bankAccountId: bankAccount.id, type: 'WITHDRAWAL', deletedAt: null },
            _sum: { amount: true },
          }),
          tx.bankTransaction.aggregate({
            where: { bankAccountId: bankAccount.id, type: 'PAYMENT', deletedAt: null },
            _sum: { amount: true },
          }),
          tx.bankTransaction.aggregate({
            where: { bankAccountId: bankAccount.id, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
            _sum: { amount: true },
          }),
        ]);

        const bankCalc = calculateBankBalance({
          openingBalance: bankAccount.openingBalance,
          totalDeposits: depositsAgg._sum.amount || 0,
          totalReceipts: receiptsAgg._sum.amount || 0,
          totalTransfersFromPartner: transferFromPartnerAgg._sum.amount || 0,
          totalWithdrawals: withdrawalsAgg._sum.amount || 0,
          totalPayments: paymentsAgg._sum.amount || 0,
          totalTransfersToPartner: transferToPartnerAgg._sum.amount || 0,
        });

        if (grandTotal > bankCalc.balance) {
          const err = new Error(
            `Insufficient bank balance in ${bankAccount.bankName}. Available: ₹${bankCalc.balance.toLocaleString('en-IN')}, Required: ₹${grandTotal.toLocaleString('en-IN')}`
          );
          (err as any).statusCode = 400;
          throw err;
        }
      }

      // 2. Process each Site Folder
      const processedFolders = [];

      for (const folder of folders) {
        const folderProjectId = folder.projectId || null;
        const folderSiteId = folder.siteId || null;

        // Auto-persist custom categories to PurposeOption
        for (const exp of folder.expenses) {
          try {
            const cat = exp.category?.trim();
            if (cat && cat.length >= 2 && cat.length <= 50) {
              const exists = await tx.purposeOption.findFirst({
                where: { organizationId: orgId, type: 'EXPENSE', name: { equals: cat, mode: 'insensitive' }, deletedAt: null },
              });
              if (!exists) {
                await tx.purposeOption.create({
                  data: { organizationId: orgId, type: 'EXPENSE', name: cat, isSystem: false, isActive: true, createdById: session.userId },
                });
              }
            }
          } catch (e) {
            // ignore duplicate
          }
        }

        for (const w of folder.workers) {
          try {
            const cat = w.category?.trim();
            if (cat && cat.length >= 2 && cat.length <= 50) {
              const exists = await tx.purposeOption.findFirst({
                where: { organizationId: orgId, type: 'TRANSFER', name: { equals: cat, mode: 'insensitive' }, deletedAt: null },
              });
              if (!exists) {
                await tx.purposeOption.create({
                  data: { organizationId: orgId, type: 'TRANSFER', name: cat, isSystem: false, isActive: true, createdById: session.userId },
                });
              }
            }
          } catch (e) {
            // ignore duplicate
          }
        }

        // Process Workers for this folder
        for (const w of folder.workers) {
          const worker = workersMap.get(w.workerId);
          if (!worker) {
            const err = new Error(`Worker with ID "${w.workerId}" not found in organization`);
            (err as any).statusCode = 404;
            throw err;
          }

          await executeWorkerPayment({
            tx,
            organizationId: orgId,
            worker,
            sourceType,
            sourceId,
            category: w.category,
            amount: w.amount,
            date: txDate,
            method,
            projectId: folderProjectId,
            siteId: folderSiteId,
            reference: reference || null,
            remarks: w.remarks || null,
            session: {
              userId: session.userId,
              name: session.name,
              email: session.email,
              role: session.role,
            },
          });
        }

        // Process Expenses for this folder
        for (const exp of folder.expenses) {
          await executeExpense({
            tx,
            organizationId: orgId,
            sourceType,
            sourceId,
            category: exp.category,
            description: exp.description || exp.category,
            vendorName: exp.vendor || null,
            amount: exp.amount,
            date: txDate,
            method,
            projectId: folderProjectId,
            siteId: folderSiteId,
            reference: reference || null,
            notes: reference || null,
            session: {
              userId: session.userId,
              name: session.name,
              email: session.email,
              role: session.role,
            },
          });
        }

        processedFolders.push({
          siteName: folder.siteName,
          workersCount: folder.workers.length,
          expensesCount: folder.expenses.length,
        });
      }

      // Record Master Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId: session.userId,
          userName: session.name,
          userEmail: session.email,
          userRole: session.role,
          entityType: 'MultiSiteSendMoney',
          entityId: `batch_${Date.now()}`,
          action: 'CREATE',
          newValue: JSON.stringify({
            sourceType,
            sourceId,
            grandTotal,
            totalFolders: folders.length,
            totalWorkersCount,
            totalExpensesCount,
            folders: processedFolders,
          }),
        },
      });

      return {
        grandTotal,
        totalFolders: folders.length,
        totalWorkersCount,
        totalExpensesCount,
      };
    });

    return NextResponse.json(
      {
        success: true,
        message: `Successfully posted ₹${result.grandTotal.toLocaleString('en-IN')} across ${result.totalFolders} site folder(s)!`,
        ...result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('MultiSiteSendMoney error:', error);
    const status = error.statusCode || 500;
    return NextResponse.json({ error: error.message || 'Failed to process multi-site payments' }, { status });
  }
}
