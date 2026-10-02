import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { getStartOfDayUTC } from '@/lib/auth/day-lock';
import { normalizeRole } from '@/lib/auth/roles';
import { DraftConfirmationPayload } from '@/lib/assistant/draft-types';

export const dynamic = 'force-dynamic';

// In-memory idempotency cache (stores draftIds processed in the last 15 minutes)
const processedDraftIds = new Map<string, number>();

function isAlreadyProcessed(draftId: string): boolean {
  const now = Date.now();
  // Clear entries older than 15 minutes
  for (const [id, time] of processedDraftIds.entries()) {
    if (now - time > 15 * 60 * 1000) {
      processedDraftIds.delete(id);
    }
  }
  return processedDraftIds.has(draftId);
}

function markProcessed(draftId: string) {
  processedDraftIds.set(draftId, Date.now());
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: DraftConfirmationPayload = await req.json();
    const {
      draftId,
      draftType,
      date,
      amount = 0,
      receiverId,
      receiverName,
      receiverType,
      projectId,
      projectName,
      purpose,
      notes,
      materialId,
      materialName,
      quantity = 1,
      unit = 'Bag',
      rate = 0,
      supplierName,
      attendanceRecords = [],
      workItem,
      receivedIn,
      bankAccountId,
    } = body;

    if (!draftId) {
      return NextResponse.json({ error: 'Draft ID is required' }, { status: 400 });
    }

    // 1. Idempotency Check: prevent double-clicks & duplicates
    if (isAlreadyProcessed(draftId)) {
      return NextResponse.json(
        { error: 'Yeh entry pehle hi save ho chuki hai (Duplicate blocked).', alreadySaved: true },
        { status: 409 }
      );
    }

    const orgId = session.organizationId;
    const userId = session.userId;
    const role = normalizeRole(session.role);
    const isOwner = ['OWNER', 'MANAGER'].includes(role);

    // 2. Day-Lock Verification
    const targetDate = new Date(date || new Date().toISOString().split('T')[0]);
    const dayStart = getStartOfDayUTC(targetDate);

    const closingRecord = await prisma.dailyClosing.findUnique({
      where: {
        organizationId_userId_date: {
          organizationId: orgId,
          userId,
          date: dayStart,
        },
      },
    });

    if (closingRecord?.isVerified && !isOwner) {
      return NextResponse.json(
        {
          error: 'Is din ka hisaab (Daily Closing) verify/lock ho chuka hai. Is din me entry karne ke liye Owner permission chahiye.',
          isLocked: true,
        },
        { status: 403 }
      );
    }

    // 3. Atomic Database Mutation inside Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      const sourceTag = '[AI_ASSISTANT]';

      // Find a default project if needed
      let defaultProjectId = projectId;
      if (!defaultProjectId) {
        const defP = await tx.project.findFirst({ where: { organizationId: orgId } });
        defaultProjectId = defP?.id || '';
      }

      switch (draftType) {
        // -----------------------------------------------------
        // FUND_TRANSFER (Give Money to Worker or User)
        // -----------------------------------------------------
        case 'FUND_TRANSFER': {
          if (!amount || amount <= 0) throw new Error('Valid amount is required');

          // If giving to a Worker -> Create Worker Payment + FundTransfer (toWorkerId)
          if (receiverType === 'WORKER') {
            let targetWorkerId = receiverId;
            if (!targetWorkerId && receiverName) {
              const w = await tx.worker.findFirst({
                where: { organizationId: orgId, name: { contains: receiverName }, deletedAt: null },
              });
              targetWorkerId = w?.id;
            }

            if (!targetWorkerId) throw new Error(`Worker "${receiverName || 'Worker'}" not found`);

            const isAdvance = purpose?.toLowerCase().includes('advance') || purpose?.toLowerCase().includes('dinner');

            // Create FundTransfer to worker
            const transfer = await tx.fundTransfer.create({
              data: {
                organizationId: orgId,
                transferType: 'PARTNER_TO_WORKER',
                fromUserId: userId,
                toWorkerId: targetWorkerId,
                amount,
                date: targetDate,
                purpose: isAdvance ? 'ADVANCE' : 'SITE_EXPENSE',
                notes: `${purpose || 'Worker Payout'}${notes ? ' - ' + notes : ''} ${sourceTag}`,
              },
            });

            // Also create Payment record so Worker Khata ledger reflects payout
            const payment = await tx.payment.create({
              data: {
                organizationId: orgId,
                workerId: targetWorkerId,
                amount,
                date: targetDate,
                paymentMethod: 'CASH',
                transactionType: isAdvance ? 'ADVANCE' : 'SALARY',
                fundTransferId: transfer.id,
                notes: `${purpose || 'Worker Advance'}${notes ? ' - ' + notes : ''} ${sourceTag}`,
              },
            });

            return { id: payment.id, type: 'PAYMENT', message: `${receiverName} ko ₹${amount} successfully de diye gaye aur Khata update ho gaya.` };
          }

          // If transferring to another User / Partner / Supervisor
          let targetUserId = receiverId;
          if (!targetUserId && receiverName) {
            const u = await tx.user.findFirst({
              where: { name: { contains: receiverName } },
            });
            targetUserId = u?.id;
          }

          if (!targetUserId) throw new Error(`User "${receiverName || 'Team Member'}" not found`);

          const transfer = await tx.fundTransfer.create({
            data: {
              organizationId: orgId,
              transferType: 'PARTNER_TO_SUPERVISOR',
              fromUserId: userId,
              toUserId: targetUserId,
              amount,
              date: targetDate,
              purpose: purpose || 'SITE_EXPENSE',
              notes: notes ? `${notes} ${sourceTag}` : sourceTag,
            },
          });

          return { id: transfer.id, type: 'FUND_TRANSFER', message: `${receiverName} ko ₹${amount} cash transfer successfully save ho gaya.` };
        }

        // -----------------------------------------------------
        // EXPENSE (Daily Site or Personal Expense)
        // -----------------------------------------------------
        case 'EXPENSE': {
          if (!amount || amount <= 0) throw new Error('Valid amount is required');

          const expense = await tx.expense.create({
            data: {
              organizationId: orgId,
              amount,
              category: purpose || 'Site Expense',
              description: notes || purpose || 'Daily Expense',
              date: targetDate,
              walletOwnerId: userId,
              spentById: userId,
              projectId: projectId || (defaultProjectId || null),
              notes: notes ? `${notes} ${sourceTag}` : sourceTag,
            },
          });

          return { id: expense.id, type: 'EXPENSE', message: `₹${amount} (${purpose || 'Expense'}) Cash Book me add ho gaya.` };
        }

        // -----------------------------------------------------
        // MONEY_IN (Client Project Payment)
        // -----------------------------------------------------
        case 'MONEY_IN': {
          if (!amount || amount <= 0) throw new Error('Valid amount is required');

          let targetProjectId = projectId;
          if (!targetProjectId && projectName) {
            const p = await tx.project.findFirst({
              where: { organizationId: orgId, name: { contains: projectName } },
            });
            targetProjectId = p?.id;
          }

          if (!targetProjectId) {
            targetProjectId = defaultProjectId;
          }

          if (!targetProjectId) throw new Error('No project found for Money In entry');

          const receipt = await tx.projectReceipt.create({
            data: {
              organizationId: orgId,
              projectId: targetProjectId,
              clientName: projectName || 'Client',
              amount,
              date: targetDate,
              receivedById: userId,
              receivedIn: receivedIn || 'WALLET',
              bankAccountId: receivedIn === 'BANK' ? bankAccountId || null : null,
              notes: notes ? `${notes} ${sourceTag}` : sourceTag,
            },
          });

          if (receivedIn === 'BANK' && bankAccountId) {
            await tx.bankTransaction.create({
              data: {
                organizationId: orgId,
                bankAccountId,
                type: 'RECEIPT',
                amount,
                date: targetDate,
                partnerId: userId,
                projectId: targetProjectId || null,
                reference: 'AI_ASSISTANT',
                notes: `Client payment ${sourceTag}`,
                createdById: userId,
              },
            });
          }

          return { id: receipt.id, type: 'MONEY_IN', message: `₹${amount} Money In entry successfully save ho gayi.` };
        }

        // -----------------------------------------------------
        // GOODS_PURCHASE (Materials Purchase: Stock + Expense)
        // -----------------------------------------------------
        case 'GOODS_PURCHASE': {
          const totalAmt = amount || (quantity * rate);
          if (!totalAmt || totalAmt <= 0) throw new Error('Valid purchase amount is required');

          // Find or create material
          let targetMaterialId = materialId;
          if (!targetMaterialId && materialName) {
            let m = await tx.material.findFirst({
              where: { organizationId: orgId, name: { contains: materialName } },
            });
            if (!m) {
              m = await tx.material.create({
                data: {
                  organizationId: orgId,
                  materialCode: `MAT-${Date.now().toString().slice(-6)}`,
                  name: materialName,
                  unit: unit || 'Bag',
                  minimumStock: 5,
                },
              });
            }
            targetMaterialId = m.id;
          }

          if (!targetMaterialId) throw new Error('Material not found');

          // 1. Material Inward Receipt
          const matReceipt = await tx.materialReceipt.create({
            data: {
              organizationId: orgId,
              materialId: targetMaterialId,
              projectId: projectId || defaultProjectId || '',
              purchasedById: userId,
              quantity: quantity || 1,
              purchaseRate: rate || (totalAmt / (quantity || 1)),
              totalCost: totalAmt,
              date: targetDate,
              notes: `${sourceTag} Purchased via AI Assistant`,
            },
          });

          // 2. Corresponding cash expense
          await tx.expense.create({
            data: {
              organizationId: orgId,
              amount: totalAmt,
              category: 'Goods Purchase',
              description: `${quantity || 1} ${unit || 'Bag'} ${materialName || 'Material'}`,
              date: targetDate,
              walletOwnerId: userId,
              spentById: userId,
              projectId: projectId || (defaultProjectId || null),
              notes: `${sourceTag} Goods Purchase`,
            },
          });

          return { id: matReceipt.id, type: 'GOODS_PURCHASE', message: `${quantity} ${unit} ${materialName} (₹${totalAmt}) ka Stock aur Expense dono update ho gaye.` };
        }

        // -----------------------------------------------------
        // ATTENDANCE (Worker Daily Attendance)
        // -----------------------------------------------------
        case 'ATTENDANCE': {
          if (attendanceRecords.length === 0) throw new Error('No attendance records provided');

          for (const rec of attendanceRecords) {
            let targetWorkerId = rec.workerId;
            if (!targetWorkerId && rec.workerName) {
              const w = await tx.worker.findFirst({
                where: { organizationId: orgId, name: { contains: rec.workerName }, deletedAt: null },
              });
              targetWorkerId = w?.id;
            }

            if (targetWorkerId && defaultProjectId) {
              await tx.attendance.upsert({
                where: {
                  organizationId_projectId_workerId_date: {
                    organizationId: orgId,
                    projectId: defaultProjectId,
                    workerId: targetWorkerId,
                    date: dayStart,
                  },
                },
                update: {
                  status: rec.status || 'PRESENT',
                  overtimeHours: rec.overtimeHours || 0,
                },
                create: {
                  organizationId: orgId,
                  projectId: defaultProjectId,
                  workerId: targetWorkerId,
                  date: dayStart,
                  status: rec.status || 'PRESENT',
                  overtimeHours: rec.overtimeHours || 0,
                },
              });
            }
          }

          return { type: 'ATTENDANCE', message: `${attendanceRecords.length} workers ki attendance successfully mark ho gayi.` };
        }

        // -----------------------------------------------------
        // WORK_RECORD (Worker Daily Work)
        // -----------------------------------------------------
        case 'WORK_RECORD': {
          let targetWorkerId = receiverId;
          if (!targetWorkerId && receiverName) {
            const w = await tx.worker.findFirst({
              where: { organizationId: orgId, name: { contains: receiverName }, deletedAt: null },
            });
            targetWorkerId = w?.id;
          }

          if (!targetWorkerId) throw new Error('Worker not found');

          const wr = await tx.workRecord.create({
            data: {
              organizationId: orgId,
              workerId: targetWorkerId,
              projectId: projectId || defaultProjectId || '',
              task: workItem || 'Waterproofing Work',
              description: workItem || 'Waterproofing Work',
              quantity: quantity || 1,
              unit: unit || 'sqft',
              rate: rate || (amount / (quantity || 1)),
              totalWorkValue: amount,
              date: targetDate,
            },
          });

          return { id: wr.id, type: 'WORK_RECORD', message: `${receiverName} ka kaam (${quantity} ${unit}) successfully record ho gaya.` };
        }

        // -----------------------------------------------------
        // WORKER_PAYMENT (Direct Khata Payout)
        // -----------------------------------------------------
        case 'WORKER_PAYMENT': {
          if (!amount || amount <= 0) throw new Error('Valid amount is required');

          let targetWorkerId = receiverId;
          if (!targetWorkerId && receiverName) {
            const w = await tx.worker.findFirst({
              where: { organizationId: orgId, name: { contains: receiverName }, deletedAt: null },
            });
            targetWorkerId = w?.id;
          }

          if (!targetWorkerId) throw new Error('Worker not found');

          const payment = await tx.payment.create({
            data: {
              organizationId: orgId,
              workerId: targetWorkerId,
              amount,
              date: targetDate,
              paymentMethod: 'CASH',
              transactionType: purpose?.toLowerCase().includes('advance') ? 'ADVANCE' : 'SALARY',
              notes: `${purpose || 'Salary Payout'} ${sourceTag}`,
            },
          });

          return { id: payment.id, type: 'WORKER_PAYMENT', message: `${receiverName} ko ₹${amount} payment save ho gayi.` };
        }

        // -----------------------------------------------------
        // BANK_DEPOSIT ("Cash Bank mein Jama")
        // -----------------------------------------------------
        case 'BANK_DEPOSIT': {
          if (!amount || amount <= 0) throw new Error('Valid amount is required');

          let targetBankId = bankAccountId;
          if (!targetBankId) {
            const b = await tx.bankAccount.findFirst({ where: { organizationId: orgId, isActive: true, deletedAt: null } });
            targetBankId = b?.id;
          }

          if (!targetBankId) throw new Error('Active bank account not found');

          const txRecord = await tx.bankTransaction.create({
            data: {
              organizationId: orgId,
              bankAccountId: targetBankId,
              type: 'TRANSFER_FROM_PARTNER',
              amount,
              partnerId: userId,
              date: targetDate,
              reference: 'AI_ASSISTANT',
              notes: notes ? `${notes} ${sourceTag}` : `Cash Bank mein Jama ${sourceTag}`,
              createdById: userId,
            },
          });

          return { id: txRecord.id, type: 'BANK_DEPOSIT', message: `₹${amount} Cash Bank me jama hone ki entry ho gayi.` };
        }

        // -----------------------------------------------------
        // BANK_WITHDRAWAL ("Bank se Cash Nikala")
        // -----------------------------------------------------
        case 'BANK_WITHDRAWAL': {
          if (!amount || amount <= 0) throw new Error('Valid amount is required');

          let targetBankId = bankAccountId;
          if (!targetBankId) {
            const b = await tx.bankAccount.findFirst({ where: { organizationId: orgId, isActive: true, deletedAt: null } });
            targetBankId = b?.id;
          }

          if (!targetBankId) throw new Error('Active bank account not found');

          const txRecord = await tx.bankTransaction.create({
            data: {
              organizationId: orgId,
              bankAccountId: targetBankId,
              type: 'TRANSFER_TO_PARTNER',
              amount,
              partnerId: userId,
              date: targetDate,
              reference: 'AI_ASSISTANT',
              notes: notes ? `${notes} ${sourceTag}` : `Bank se Cash Nikala ${sourceTag}`,
              createdById: userId,
            },
          });

          return { id: txRecord.id, type: 'BANK_WITHDRAWAL', message: `₹${amount} Bank se cash nikalne ki entry ho gayi.` };
        }

        default:
          throw new Error(`Unsupported draft type: ${draftType}`);
      }
    });

    // Mark as processed in idempotency map
    markProcessed(draftId);

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error: any) {
    console.error('Assistant Confirm Error:', error);
    return NextResponse.json(
      { error: error.message || 'Entry save karne me error aayi. Kripya dobara try karein.' },
      { status: 500 }
    );
  }
}
