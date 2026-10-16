import prisma from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getPartnerWalletBalance } from '@/lib/finance/partnerWallet';
import { calculateBankBalance } from '@/lib/calculations';
import { recordAudit } from '@/lib/audit/auditLogger';
import { mapCategoryToTransactionType } from '@/lib/finance/executeWorkerPayment';

export interface EntrySessionUser {
  userId: string;
  name: string;
  email?: string;
  role: string;
  organizationId: string;
}

export interface EditEntryInput {
  amount?: number;
  date?: string | Date;
  category?: string;
  description?: string;
  remarks?: string;
  paymentMethod?: string;
  workerId?: string;
  projectId?: string | null;
  siteId?: string | null;
  reference?: string | null;
  editReason?: string;
}

/**
 * Validates permission for editing or deleting a Hisaab entry:
 * - OWNER can edit/delete anything.
 * - MANAGER and ACCOUNTANT can only edit/delete their own entries within 48 hours.
 * - All others are forbidden.
 */
function validateEntryPermission(
  session: EntrySessionUser,
  record: {
    createdAt: Date;
    createdById?: string | null;
    userId?: string | null;
    fromUserId?: string | null;
    receivedById?: string | null;
    walletOwnerId?: string | null;
    spentById?: string | null;
  }
) {
  const role = (session.role || '').toUpperCase();
  if (role === 'OWNER') return true;

  if (role === 'MANAGER' || role === 'ACCOUNTANT') {
    // Check ownership
    const isOwnerOfRecord =
      record.createdById === session.userId ||
      record.userId === session.userId ||
      record.fromUserId === session.userId ||
      record.receivedById === session.userId ||
      record.walletOwnerId === session.userId ||
      record.spentById === session.userId;

    if (!isOwnerOfRecord) {
      throw new Error('Forbidden: You can only edit or delete your own entries');
    }

    // Check 48-hour window
    const now = new Date();
    const ageMs = now.getTime() - new Date(record.createdAt).getTime();
    if (ageMs > 48 * 60 * 60 * 1000) {
      throw new Error('Forbidden: You can only edit or delete entries within 48 hours of creation');
    }

    return true;
  }

  throw new Error('Forbidden: Insufficient permissions to modify this entry');
}

/**
 * Validates date is not in future (IST)
 */
function validateDateNotFuture(dateInput: Date | string): Date {
  const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date provided');
  }

  // Current time in IST + 10 minutes tolerance for clock skew
  const now = new Date();
  if (dateObj.getTime() > now.getTime() + 10 * 60 * 1000) {
    throw new Error('Transaction date cannot be in the future');
  }
  return dateObj;
}

/**
 * EDIT a Hisaab Entry atomically with safety checks, balance locking, and audit logging.
 */
export async function editHisaabEntry(params: {
  organizationId: string;
  session: EntrySessionUser;
  entityType: 'Payment' | 'FundTransfer' | 'Expense' | 'ProjectReceipt' | 'BankTransaction';
  entryId: string;
  data: EditEntryInput;
}): Promise<any> {
  const { organizationId, session, entityType, entryId, data } = params;

  return await prisma.$transaction(async (tx): Promise<any> => {
    switch (entityType) {
      // =========================================================================
      // 1. WORKER PAYMENT OR PAYMENT RECORD
      // =========================================================================
      case 'Payment': {
        let payment = await tx.payment.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { worker: true },
        });

        if (!payment) {
          // Check if entryId is linked FundTransfer
          const linkedFt = await tx.fundTransfer.findFirst({
            where: { id: entryId, organizationId, deletedAt: null },
          });
          if (linkedFt) {
            const pId = linkedFt.linkedPaymentId;
            if (pId) {
              payment = await tx.payment.findFirst({
                where: { id: pId, organizationId, deletedAt: null },
                include: { worker: true },
              });
            } else {
              payment = await tx.payment.findFirst({
                where: { fundTransferId: linkedFt.id, organizationId, deletedAt: null },
                include: { worker: true },
              });
            }
          }
        }

        if (!payment) {
          // Check if entryId is linked Expense
          const linkedExp = await tx.expense.findFirst({
            where: { id: entryId, organizationId, deletedAt: null },
          });
          if (linkedExp && linkedExp.notes?.includes('Payment ID:')) {
            const match = linkedExp.notes.match(/Payment ID:\s*([^\s•]+)/);
            if (match && match[1]) {
              payment = await tx.payment.findFirst({
                where: { id: match[1], organizationId, deletedAt: null },
                include: { worker: true },
              });
            }
          }
        }

        if (!payment) {
          throw new Error('Worker payment record not found or already deleted');
        }

        validateEntryPermission(session, {
          createdAt: payment.createdAt,
          createdById: payment.deletedById, // fallback
        });

        const newAmount = data.amount !== undefined ? Number(data.amount) : payment.amount;
        if (newAmount <= 0) throw new Error('Payment amount must be greater than zero');

        const newDate = data.date ? validateDateNotFuture(data.date) : payment.date;
        const newCategory = data.category || payment.notes || 'Salary / Wages';
        const newTxType = mapCategoryToTransactionType(newCategory);
        const newMethod = data.paymentMethod || payment.paymentMethod;
        const newWorkerId = data.workerId || payment.workerId;
        const newWorker = newWorkerId !== payment.workerId
          ? await tx.worker.findFirst({ where: { id: newWorkerId, organizationId } })
          : payment.worker;

        if (!newWorker) throw new Error('Worker not found');

        const amountDiff = newAmount - payment.amount;

        // Find linked FundTransfer, BankTransaction, and Expense
        let linkedFundTransfer = payment.fundTransferId
          ? await tx.fundTransfer.findUnique({ where: { id: payment.fundTransferId } })
          : await tx.fundTransfer.findFirst({ where: { linkedPaymentId: payment.id, deletedAt: null } });

        // Fallback for old-style records: search by notes "Payment ID: ${payment.id}"
        if (!linkedFundTransfer) {
          linkedFundTransfer = await tx.fundTransfer.findFirst({
            where: {
              organizationId,
              toWorkerId: payment.workerId,
              notes: { contains: payment.id },
              deletedAt: null,
            },
          });
        }

        let linkedBankTx = await tx.bankTransaction.findFirst({
          where: {
            organizationId,
            notes: { contains: payment.id },
            deletedAt: null,
          },
        });

        let linkedExpense = await tx.expense.findFirst({
          where: {
            organizationId,
            category: 'LABOUR',
            notes: { contains: payment.id },
            deletedAt: null,
          },
        });

        // Balance Safety Check: If amount increased, ensure source account has enough funds
        if (amountDiff > 0) {
          if (linkedFundTransfer) {
            const payerWallet = await getPartnerWalletBalance(tx, organizationId, linkedFundTransfer.fromUserId);
            if (payerWallet.balance < amountDiff) {
              const payer = await tx.user.findUnique({ where: { id: linkedFundTransfer.fromUserId }, select: { name: true } });
              throw new Error(
                `Insufficient balance in partner wallet (${payer?.name || 'Partner'}). Available: ₹${payerWallet.balance.toLocaleString('en-IN')}, Required: ₹${amountDiff.toLocaleString('en-IN')}`
              );
            }
          } else if (linkedBankTx) {
            const bankAcc = await tx.bankAccount.findUnique({ where: { id: linkedBankTx.bankAccountId } });
            if (bankAcc) {
              const currentBankBal = await getFreshBankBalance(tx, organizationId, bankAcc.id, bankAcc.openingBalance);
              if (currentBankBal < amountDiff) {
                throw new Error(
                  `Insufficient balance in bank account (${bankAcc.name}). Available: ₹${currentBankBal.toLocaleString('en-IN')}, Required: ₹${amountDiff.toLocaleString('en-IN')}`
                );
              }
            }
          }
        }

        const paymentNotes = data.remarks ? `${newCategory} • ${data.remarks}` : newCategory;

        // 1. Update Payment
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            amount: newAmount,
            date: newDate,
            transactionType: newTxType,
            paymentMethod: newMethod,
            workerId: newWorkerId,
            projectId: data.projectId !== undefined ? data.projectId : payment.projectId,
            siteId: data.siteId !== undefined ? data.siteId : payment.siteId,
            reference: data.reference !== undefined ? data.reference : payment.reference,
            notes: paymentNotes,
            isEdited: true,
            editReason: data.editReason || 'Edited via Partner Hisaab',
          },
        });

        // 2. Update linked FundTransfer if present
        if (linkedFundTransfer) {
          await tx.fundTransfer.update({
            where: { id: linkedFundTransfer.id },
            data: {
              amount: newAmount,
              date: newDate,
              paymentMethod: newMethod,
              toWorkerId: newWorkerId,
              purpose: newCategory,
              projectId: data.projectId !== undefined ? data.projectId : linkedFundTransfer.projectId,
              siteId: data.siteId !== undefined ? data.siteId : linkedFundTransfer.siteId,
              notes: data.remarks || `Payment to worker ${newWorker.name} (${newCategory})`,
              reference: data.reference !== undefined ? data.reference : linkedFundTransfer.reference,
              isEdited: true,
              editReason: data.editReason || 'Edited via Partner Hisaab',
            },
          });
        }

        // 3. Update linked BankTransaction if present
        if (linkedBankTx) {
          await tx.bankTransaction.update({
            where: { id: linkedBankTx.id },
            data: {
              amount: newAmount,
              date: newDate,
              projectId: data.projectId !== undefined ? data.projectId : linkedBankTx.projectId,
              reference: data.reference !== undefined ? data.reference : linkedBankTx.reference,
              notes: `Worker Payment: ${newWorker.name} (${newCategory}) • Payment ID: ${payment.id}${data.remarks ? ` • ${data.remarks}` : ''}`,
              isEdited: true,
              editReason: data.editReason || 'Edited via Partner Hisaab',
            },
          });
        }

        // 4. Update linked Expense if present
        if (linkedExpense) {
          await tx.expense.update({
            where: { id: linkedExpense.id },
            data: {
              amount: newAmount,
              date: newDate,
              description: `Worker Payment: ${newWorker.name} (${newCategory})`,
              paymentMethod: newMethod,
              projectId: data.projectId !== undefined ? data.projectId : linkedExpense.projectId,
              siteId: data.siteId !== undefined ? data.siteId : linkedExpense.siteId,
              notes: `Payment ID: ${payment.id}${data.remarks ? ` - ${data.remarks}` : ''}`,
              isEdited: true,
              editReason: data.editReason || 'Edited via Partner Hisaab',
            },
          });
        }

        // 5. Audit Log
        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'Payment',
          entityId: payment.id,
          action: 'UPDATE',
          oldValue: {
            amount: payment.amount,
            date: payment.date,
            workerId: payment.workerId,
            transactionType: payment.transactionType,
            notes: payment.notes,
          },
          newValue: {
            amount: newAmount,
            date: newDate,
            workerId: newWorkerId,
            transactionType: newTxType,
            notes: paymentNotes,
          },
          details: `Worker payment for ${newWorker.name} edited from ₹${payment.amount} to ₹${newAmount}. Reason: ${data.editReason || 'No reason provided'}`,
        });

        return { success: true, updated: updatedPayment };
      }

      // =========================================================================
      // 2. FUND TRANSFER (Partner-to-Partner, Partner-to-Worker, etc.)
      // =========================================================================
      case 'FundTransfer': {
        const transfer = await tx.fundTransfer.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { fromUser: true, toUser: true, toWorker: true },
        });

        if (!transfer) {
          throw new Error('Fund transfer record not found or already deleted');
        }

        // If this transfer is actually linked to a worker payment, delegate to worker payment handler!
        if (transfer.linkedPaymentId || transfer.toWorkerId) {
          const paymentId = transfer.linkedPaymentId || (await tx.payment.findFirst({
            where: { fundTransferId: transfer.id, deletedAt: null },
            select: { id: true },
          }))?.id;

          if (paymentId) {
            return await editHisaabEntry({
              organizationId,
              session,
              entityType: 'Payment',
              entryId: paymentId,
              data,
            });
          }
        }

        validateEntryPermission(session, {
          createdAt: transfer.createdAt,
          fromUserId: transfer.fromUserId,
        });

        const newAmount = data.amount !== undefined ? Number(data.amount) : transfer.amount;
        if (newAmount <= 0) throw new Error('Transfer amount must be greater than zero');

        const newDate = data.date ? validateDateNotFuture(data.date) : transfer.date;
        const newMethod = data.paymentMethod || transfer.paymentMethod;
        const amountDiff = newAmount - transfer.amount;

        // If transfer increased, fromUser must have enough wallet balance
        if (amountDiff > 0) {
          const senderWallet = await getPartnerWalletBalance(tx, organizationId, transfer.fromUserId);
          if (senderWallet.balance < amountDiff) {
            throw new Error(
              `Insufficient balance in sender partner wallet (${transfer.fromUser?.name || 'Partner'}). Available: ₹${senderWallet.balance.toLocaleString('en-IN')}, Required: ₹${amountDiff.toLocaleString('en-IN')}`
            );
          }
        }

        // If transfer decreased, toUser's wallet balance cannot drop below zero
        if (amountDiff < 0 && transfer.toUserId) {
          const recipientWallet = await getPartnerWalletBalance(tx, organizationId, transfer.toUserId);
          if (recipientWallet.balance < Math.abs(amountDiff)) {
            throw new Error(
              `Cannot reduce transfer amount: recipient partner (${transfer.toUser?.name || 'Partner'}) has already spent these funds and wallet would become negative (₹${(recipientWallet.balance - Math.abs(amountDiff)).toLocaleString('en-IN')}).`
            );
          }
        }

        const updatedTransfer = await tx.fundTransfer.update({
          where: { id: transfer.id },
          data: {
            amount: newAmount,
            date: newDate,
            paymentMethod: newMethod,
            purpose: data.category || transfer.purpose,
            notes: data.remarks !== undefined ? data.remarks : transfer.notes,
            reference: data.reference !== undefined ? data.reference : transfer.reference,
            projectId: data.projectId !== undefined ? data.projectId : transfer.projectId,
            siteId: data.siteId !== undefined ? data.siteId : transfer.siteId,
            isEdited: true,
            editReason: data.editReason || 'Edited via Partner Hisaab',
          },
        });

        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'FundTransfer',
          entityId: transfer.id,
          action: 'UPDATE',
          oldValue: {
            amount: transfer.amount,
            date: transfer.date,
            purpose: transfer.purpose,
            notes: transfer.notes,
          },
          newValue: {
            amount: newAmount,
            date: newDate,
            purpose: data.category || transfer.purpose,
            notes: data.remarks !== undefined ? data.remarks : transfer.notes,
          },
          details: `Partner transfer edited from ₹${transfer.amount} to ₹${newAmount}. Reason: ${data.editReason || 'No reason provided'}`,
        });

        return { success: true, updated: updatedTransfer };
      }

      // =========================================================================
      // 3. PROJECT RECEIPT (Client Payment Received)
      // =========================================================================
      case 'ProjectReceipt': {
        const receipt = await tx.projectReceipt.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { receivedBy: true, bankAccount: true },
        });

        if (!receipt) {
          throw new Error('Project receipt record not found or already deleted');
        }

        validateEntryPermission(session, {
          createdAt: receipt.createdAt,
          receivedById: receipt.receivedById,
        });

        const newAmount = data.amount !== undefined ? Number(data.amount) : receipt.amount;
        if (newAmount <= 0) throw new Error('Receipt amount must be greater than zero');

        const newDate = data.date ? validateDateNotFuture(data.date) : receipt.date;
        const amountDiff = newAmount - receipt.amount;

        // If receipt amount reduced, recipient wallet or bank cannot drop below zero
        if (amountDiff < 0) {
          const reduction = Math.abs(amountDiff);
          if (receipt.receivedIn === 'BANK' && receipt.bankAccountId) {
            const currentBankBal = await getFreshBankBalance(tx, organizationId, receipt.bankAccountId, receipt.bankAccount?.openingBalance || 0);
            if (currentBankBal < reduction) {
              throw new Error(
                `Cannot reduce receipt amount: bank account (${receipt.bankAccount?.name}) balance would become negative (₹${(currentBankBal - reduction).toLocaleString('en-IN')}).`
              );
            }
          } else {
            const receiverWallet = await getPartnerWalletBalance(tx, organizationId, receipt.receivedById);
            if (receiverWallet.balance < reduction) {
              throw new Error(
                `Cannot reduce receipt amount: partner (${receipt.receivedBy?.name}) wallet balance would become negative (₹${(receiverWallet.balance - reduction).toLocaleString('en-IN')}).`
              );
            }
          }
        }

        const updatedReceipt = await tx.projectReceipt.update({
          where: { id: receipt.id },
          data: {
            amount: newAmount,
            date: newDate,
            clientName: data.description || receipt.clientName,
            paymentMethod: data.paymentMethod || receipt.paymentMethod,
            purpose: data.category || receipt.purpose,
            notes: data.remarks !== undefined ? data.remarks : receipt.notes,
            reference: data.reference !== undefined ? data.reference : receipt.reference,
            projectId: data.projectId ? data.projectId : receipt.projectId,
            siteId: data.siteId !== undefined ? data.siteId : receipt.siteId,
            isEdited: true,
            editReason: data.editReason || 'Edited via Partner Hisaab',
          },
        });

        // Also update linked BankTransaction if receipt was into bank
        if (receipt.receivedIn === 'BANK' && receipt.bankAccountId) {
          await tx.bankTransaction.updateMany({
            where: {
              organizationId,
              bankAccountId: receipt.bankAccountId,
              reference: receipt.reference || receipt.id,
              deletedAt: null,
            },
            data: {
              amount: newAmount,
              date: newDate,
              isEdited: true,
              editReason: data.editReason || 'Edited via Partner Hisaab',
            },
          });
        }

        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'ProjectReceipt',
          entityId: receipt.id,
          action: 'UPDATE',
          oldValue: {
            amount: receipt.amount,
            date: receipt.date,
            clientName: receipt.clientName,
            notes: receipt.notes,
          },
          newValue: {
            amount: newAmount,
            date: newDate,
            clientName: data.description || receipt.clientName,
            notes: data.remarks !== undefined ? data.remarks : receipt.notes,
          },
          details: `Client receipt for ${receipt.clientName} edited from ₹${receipt.amount} to ₹${newAmount}. Reason: ${data.editReason || 'No reason provided'}`,
        });

        return { success: true, updated: updatedReceipt };
      }

      // =========================================================================
      // 4. SITE EXPENSE (Expense)
      // =========================================================================
      case 'Expense': {
        const expense = await tx.expense.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { walletOwner: true },
        });

        if (!expense) {
          throw new Error('Expense record not found or already deleted');
        }

        // If this expense is a LABOUR expense linked to a Payment, delegate to Payment handler
        if (expense.category === 'LABOUR' && expense.notes?.includes('Payment ID:')) {
          const match = expense.notes.match(/Payment ID:\s*([^\s•]+)/);
          if (match && match[1]) {
            return await editHisaabEntry({
              organizationId,
              session,
              entityType: 'Payment',
              entryId: match[1],
              data,
            });
          }
        }

        validateEntryPermission(session, {
          createdAt: expense.createdAt,
          walletOwnerId: expense.walletOwnerId,
          spentById: expense.spentById,
        });

        const newAmount = data.amount !== undefined ? Number(data.amount) : expense.amount;
        if (newAmount <= 0) throw new Error('Expense amount must be greater than zero');

        const newDate = data.date ? validateDateNotFuture(data.date) : expense.date;
        const amountDiff = newAmount - expense.amount;

        // If expense increased, wallet owner must have enough funds
        if (amountDiff > 0 && expense.walletOwnerId) {
          const ownerWallet = await getPartnerWalletBalance(tx, organizationId, expense.walletOwnerId);
          if (ownerWallet.balance < amountDiff) {
            throw new Error(
              `Insufficient balance in partner wallet (${expense.walletOwner?.name || 'Partner'}). Available: ₹${ownerWallet.balance.toLocaleString('en-IN')}, Required: ₹${amountDiff.toLocaleString('en-IN')}`
            );
          }
        }

        const updatedExpense = await tx.expense.update({
          where: { id: expense.id },
          data: {
            amount: newAmount,
            date: newDate,
            category: data.category || expense.category,
            description: data.description || expense.description,
            vendorName: data.reference !== undefined ? data.reference : expense.vendorName,
            paymentMethod: data.paymentMethod || expense.paymentMethod,
            notes: data.remarks !== undefined ? data.remarks : expense.notes,
            projectId: data.projectId !== undefined ? data.projectId : expense.projectId,
            siteId: data.siteId !== undefined ? data.siteId : expense.siteId,
            isEdited: true,
            editReason: data.editReason || 'Edited via Partner Hisaab',
          },
        });

        // If linked to BankTransaction, update it too
        const linkedBankTx = await tx.bankTransaction.findFirst({
          where: {
            organizationId,
            notes: { contains: expense.id },
            deletedAt: null,
          },
        });
        if (linkedBankTx) {
          await tx.bankTransaction.update({
            where: { id: linkedBankTx.id },
            data: {
              amount: newAmount,
              date: newDate,
              isEdited: true,
              editReason: data.editReason || 'Edited via Partner Hisaab',
            },
          });
        }

        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'Expense',
          entityId: expense.id,
          action: 'UPDATE',
          oldValue: {
            amount: expense.amount,
            date: expense.date,
            category: expense.category,
            description: expense.description,
          },
          newValue: {
            amount: newAmount,
            date: newDate,
            category: data.category || expense.category,
            description: data.description || expense.description,
          },
          details: `Site expense [${expense.category}] edited from ₹${expense.amount} to ₹${newAmount}. Reason: ${data.editReason || 'No reason provided'}`,
        });

        return { success: true, updated: updatedExpense };
      }

      // =========================================================================
      // 5. BANK TRANSACTION (Deposit, Withdrawal, etc.)
      // =========================================================================
      case 'BankTransaction': {
        const bankTx = await tx.bankTransaction.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { bankAccount: true, partner: true },
        });

        if (!bankTx) {
          throw new Error('Bank transaction record not found or already deleted');
        }

        // If this is a worker payment bank transaction, delegate to Payment handler
        if (bankTx.notes?.includes('Payment ID:')) {
          const match = bankTx.notes.match(/Payment ID:\s*([^\s•]+)/);
          if (match && match[1]) {
            return await editHisaabEntry({
              organizationId,
              session,
              entityType: 'Payment',
              entryId: match[1],
              data,
            });
          }
        }

        validateEntryPermission(session, {
          createdAt: bankTx.createdAt,
          createdById: bankTx.createdById,
          userId: bankTx.partnerId,
        });

        const newAmount = data.amount !== undefined ? Number(data.amount) : bankTx.amount;
        if (newAmount <= 0) throw new Error('Transaction amount must be greater than zero');

        const newDate = data.date ? validateDateNotFuture(data.date) : bankTx.date;
        const amountDiff = newAmount - bankTx.amount;

        // If withdrawal from bank to partner increased:
        // bank lost more, partner gained more
        if (bankTx.type === 'TRANSFER_TO_PARTNER' || bankTx.type === 'WITHDRAWAL') {
          if (amountDiff > 0) {
            const currentBankBal = await getFreshBankBalance(tx, organizationId, bankTx.bankAccountId, bankTx.bankAccount.openingBalance);
            if (currentBankBal < amountDiff) {
              throw new Error(
                `Insufficient balance in bank account (${bankTx.bankAccount.name}). Available: ₹${currentBankBal.toLocaleString('en-IN')}, Required: ₹${amountDiff.toLocaleString('en-IN')}`
              );
            }
          } else if (amountDiff < 0 && bankTx.partnerId) {
            // Partner received less, so partner wallet must have enough
            const partnerWallet = await getPartnerWalletBalance(tx, organizationId, bankTx.partnerId);
            if (partnerWallet.balance < Math.abs(amountDiff)) {
              throw new Error(
                `Cannot reduce withdrawal amount: partner (${bankTx.partner?.name}) wallet balance would become negative (₹${(partnerWallet.balance - Math.abs(amountDiff)).toLocaleString('en-IN')}).`
              );
            }
          }
        }

        // If deposit from partner to bank increased:
        // partner lost more, bank gained more
        if (bankTx.type === 'TRANSFER_FROM_PARTNER' || bankTx.type === 'DEPOSIT') {
          if (amountDiff > 0 && bankTx.partnerId) {
            const partnerWallet = await getPartnerWalletBalance(tx, organizationId, bankTx.partnerId);
            if (partnerWallet.balance < amountDiff) {
              throw new Error(
                `Insufficient balance in partner wallet (${bankTx.partner?.name}). Available: ₹${partnerWallet.balance.toLocaleString('en-IN')}, Required: ₹${amountDiff.toLocaleString('en-IN')}`
              );
            }
          } else if (amountDiff < 0) {
            // Bank received less, so bank balance must have enough
            const currentBankBal = await getFreshBankBalance(tx, organizationId, bankTx.bankAccountId, bankTx.bankAccount.openingBalance);
            if (currentBankBal < Math.abs(amountDiff)) {
              throw new Error(
                `Cannot reduce deposit amount: bank account (${bankTx.bankAccount.name}) balance would become negative (₹${(currentBankBal - Math.abs(amountDiff)).toLocaleString('en-IN')}).`
              );
            }
          }
        }

        const updatedBankTx = await tx.bankTransaction.update({
          where: { id: bankTx.id },
          data: {
            amount: newAmount,
            date: newDate,
            reference: data.reference !== undefined ? data.reference : bankTx.reference,
            notes: data.remarks !== undefined ? data.remarks : bankTx.notes,
            projectId: data.projectId !== undefined ? data.projectId : bankTx.projectId,
            isEdited: true,
            editReason: data.editReason || 'Edited via Partner Hisaab',
          },
        });

        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'BankTransaction',
          entityId: bankTx.id,
          action: 'UPDATE',
          oldValue: {
            amount: bankTx.amount,
            date: bankTx.date,
            type: bankTx.type,
            notes: bankTx.notes,
          },
          newValue: {
            amount: newAmount,
            date: newDate,
            type: bankTx.type,
            notes: data.remarks !== undefined ? data.remarks : bankTx.notes,
          },
          details: `Bank transaction [${bankTx.type}] edited from ₹${bankTx.amount} to ₹${newAmount}. Reason: ${data.editReason || 'No reason provided'}`,
        });

        return { success: true, updated: updatedBankTx };
      }

      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  });
}

/**
 * SOFT-DELETE a Hisaab Entry atomically with safety checks, balance locking, and audit logging.
 * Nothing is physically deleted (deletedAt timestamped).
 */
export async function deleteHisaabEntry(params: {
  organizationId: string;
  session: EntrySessionUser;
  entityType: 'Payment' | 'FundTransfer' | 'Expense' | 'ProjectReceipt' | 'BankTransaction';
  entryId: string;
  deleteReason: string;
}): Promise<any> {
  const { organizationId, session, entityType, entryId, deleteReason } = params;

  if (!deleteReason || !deleteReason.trim()) {
    throw new Error('A reason is required to delete this transaction');
  }

  const now = new Date();

  return await prisma.$transaction(async (tx): Promise<any> => {
    switch (entityType) {
      // =========================================================================
      // 1. WORKER PAYMENT
      // =========================================================================
      case 'Payment': {
        let payment = await tx.payment.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { worker: true },
        });

        if (!payment) {
          // Check if entryId is linked FundTransfer
          const linkedFt = await tx.fundTransfer.findFirst({
            where: { id: entryId, organizationId, deletedAt: null },
          });
          if (linkedFt) {
            const pId = linkedFt.linkedPaymentId;
            if (pId) {
              payment = await tx.payment.findFirst({
                where: { id: pId, organizationId, deletedAt: null },
                include: { worker: true },
              });
            } else {
              payment = await tx.payment.findFirst({
                where: { fundTransferId: linkedFt.id, organizationId, deletedAt: null },
                include: { worker: true },
              });
            }
          }
        }

        if (!payment) {
          // Check if entryId is linked Expense
          const linkedExp = await tx.expense.findFirst({
            where: { id: entryId, organizationId, deletedAt: null },
          });
          if (linkedExp && linkedExp.notes?.includes('Payment ID:')) {
            const match = linkedExp.notes.match(/Payment ID:\s*([^\s•]+)/);
            if (match && match[1]) {
              payment = await tx.payment.findFirst({
                where: { id: match[1], organizationId, deletedAt: null },
                include: { worker: true },
              });
            }
          }
        }

        if (!payment) {
          throw new Error('Worker payment record not found or already deleted');
        }

        validateEntryPermission(session, {
          createdAt: payment.createdAt,
          createdById: payment.deletedById,
        });

        // Deleting worker payment returns money back to partner wallet or bank account (increases balance).
        // Soft delete Payment
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        // Soft delete linked FundTransfer (by fundTransferId or linkedPaymentId or notes)
        if (payment.fundTransferId) {
          await tx.fundTransfer.updateMany({
            where: { id: payment.fundTransferId, deletedAt: null },
            data: {
              deletedAt: now,
              deletedById: session.userId,
              deleteReason: deleteReason.trim(),
            },
          });
        }
        await tx.fundTransfer.updateMany({
          where: { linkedPaymentId: payment.id, deletedAt: null },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });
        await tx.fundTransfer.updateMany({
          where: {
            organizationId,
            toWorkerId: payment.workerId,
            notes: { contains: payment.id },
            deletedAt: null,
          },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        // Soft delete linked BankTransaction
        await tx.bankTransaction.updateMany({
          where: {
            organizationId,
            notes: { contains: payment.id },
            deletedAt: null,
          },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        // Soft delete linked Expense
        await tx.expense.updateMany({
          where: {
            organizationId,
            category: 'LABOUR',
            notes: { contains: payment.id },
            deletedAt: null,
          },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        // Audit Log
        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'Payment',
          entityId: payment.id,
          action: 'DELETE',
          oldValue: {
            amount: payment.amount,
            date: payment.date,
            workerId: payment.workerId,
            workerName: payment.worker.name,
            notes: payment.notes,
            fundTransferId: payment.fundTransferId,
          },
          details: `Worker payment of ₹${payment.amount} for ${payment.worker.name} deleted by ${session.name}. Reason: ${deleteReason.trim()}`,
        });

        return { success: true, deletedId: payment.id };
      }

      // =========================================================================
      // 2. FUND TRANSFER
      // =========================================================================
      case 'FundTransfer': {
        const transfer = await tx.fundTransfer.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { fromUser: true, toUser: true, toWorker: true },
        });

        if (!transfer) {
          throw new Error('Fund transfer record not found or already deleted');
        }

        // If linked to worker payment, delegate to Payment handler
        if (transfer.linkedPaymentId || transfer.toWorkerId) {
          const paymentId = transfer.linkedPaymentId || (await tx.payment.findFirst({
            where: { fundTransferId: transfer.id, deletedAt: null },
            select: { id: true },
          }))?.id;

          if (paymentId) {
            return await deleteHisaabEntry({
              organizationId,
              session,
              entityType: 'Payment',
              entryId: paymentId,
              deleteReason,
            });
          }
        }

        validateEntryPermission(session, {
          createdAt: transfer.createdAt,
          fromUserId: transfer.fromUserId,
        });

        // Deleting transfer takes money AWAY from recipient (toUserId)
        if (transfer.toUserId) {
          const recipientWallet = await getPartnerWalletBalance(tx, organizationId, transfer.toUserId);
          if (recipientWallet.balance < transfer.amount) {
            throw new Error(
              `Cannot delete transfer: recipient partner (${transfer.toUser?.name || 'Partner'}) has already spent these funds and wallet would become negative (₹${(recipientWallet.balance - transfer.amount).toLocaleString('en-IN')}).`
            );
          }
        }

        await tx.fundTransfer.update({
          where: { id: transfer.id },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'FundTransfer',
          entityId: transfer.id,
          action: 'DELETE',
          oldValue: {
            amount: transfer.amount,
            date: transfer.date,
            fromUserId: transfer.fromUserId,
            toUserId: transfer.toUserId,
            purpose: transfer.purpose,
            notes: transfer.notes,
          },
          details: `Partner transfer of ₹${transfer.amount} from ${transfer.fromUser?.name} to ${transfer.toUser?.name || 'Partner'} deleted by ${session.name}. Reason: ${deleteReason.trim()}`,
        });

        return { success: true, deletedId: transfer.id };
      }

      // =========================================================================
      // 3. PROJECT RECEIPT
      // =========================================================================
      case 'ProjectReceipt': {
        const receipt = await tx.projectReceipt.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { receivedBy: true, bankAccount: true },
        });

        if (!receipt) {
          throw new Error('Project receipt record not found or already deleted');
        }

        validateEntryPermission(session, {
          createdAt: receipt.createdAt,
          receivedById: receipt.receivedById,
        });

        // Deleting receipt takes money AWAY from wallet or bank
        if (receipt.receivedIn === 'BANK' && receipt.bankAccountId) {
          const currentBankBal = await getFreshBankBalance(tx, organizationId, receipt.bankAccountId, receipt.bankAccount?.openingBalance || 0);
          if (currentBankBal < receipt.amount) {
            throw new Error(
              `Cannot delete receipt: bank account (${receipt.bankAccount?.name}) balance would become negative (₹${(currentBankBal - receipt.amount).toLocaleString('en-IN')}).`
            );
          }
        } else {
          const receiverWallet = await getPartnerWalletBalance(tx, organizationId, receipt.receivedById);
          if (receiverWallet.balance < receipt.amount) {
            throw new Error(
              `Cannot delete receipt: partner (${receipt.receivedBy?.name}) has already spent these funds and wallet would become negative (₹${(receiverWallet.balance - receipt.amount).toLocaleString('en-IN')}).`
            );
          }
        }

        await tx.projectReceipt.update({
          where: { id: receipt.id },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        // If bank receipt, also soft-delete linked BankTransaction
        if (receipt.receivedIn === 'BANK' && receipt.bankAccountId) {
          await tx.bankTransaction.updateMany({
            where: {
              organizationId,
              bankAccountId: receipt.bankAccountId,
              reference: receipt.reference || receipt.id,
              deletedAt: null,
            },
            data: {
              deletedAt: now,
              deletedById: session.userId,
              deleteReason: deleteReason.trim(),
            },
          });
        }

        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'ProjectReceipt',
          entityId: receipt.id,
          action: 'DELETE',
          oldValue: {
            amount: receipt.amount,
            date: receipt.date,
            clientName: receipt.clientName,
            receivedById: receipt.receivedById,
            receivedIn: receipt.receivedIn,
            bankAccountId: receipt.bankAccountId,
            notes: receipt.notes,
          },
          details: `Client receipt of ₹${receipt.amount} from ${receipt.clientName} deleted by ${session.name}. Reason: ${deleteReason.trim()}`,
        });

        return { success: true, deletedId: receipt.id };
      }

      // =========================================================================
      // 4. SITE EXPENSE
      // =========================================================================
      case 'Expense': {
        const expense = await tx.expense.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { walletOwner: true },
        });

        if (!expense) {
          throw new Error('Expense record not found or already deleted');
        }

        // If this is a LABOUR expense linked to a Payment, delegate to Payment handler
        if (expense.category === 'LABOUR' && expense.notes?.includes('Payment ID:')) {
          const match = expense.notes.match(/Payment ID:\s*([^\s•]+)/);
          if (match && match[1]) {
            return await deleteHisaabEntry({
              organizationId,
              session,
              entityType: 'Payment',
              entryId: match[1],
              deleteReason,
            });
          }
        }

        validateEntryPermission(session, {
          createdAt: expense.createdAt,
          walletOwnerId: expense.walletOwnerId,
          spentById: expense.spentById,
        });

        // Deleting expense returns money to wallet or bank (increases balance, cannot cause negative)
        await tx.expense.update({
          where: { id: expense.id },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        // If linked to BankTransaction, soft-delete it too
        await tx.bankTransaction.updateMany({
          where: {
            organizationId,
            notes: { contains: expense.id },
            deletedAt: null,
          },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'Expense',
          entityId: expense.id,
          action: 'DELETE',
          oldValue: {
            amount: expense.amount,
            date: expense.date,
            category: expense.category,
            description: expense.description,
            walletOwnerId: expense.walletOwnerId,
          },
          details: `Site expense [${expense.category}] of ₹${expense.amount} deleted by ${session.name}. Reason: ${deleteReason.trim()}`,
        });

        return { success: true, deletedId: expense.id };
      }

      // =========================================================================
      // 5. BANK TRANSACTION
      // =========================================================================
      case 'BankTransaction': {
        const bankTx = await tx.bankTransaction.findFirst({
          where: { id: entryId, organizationId, deletedAt: null },
          include: { bankAccount: true, partner: true },
        });

        if (!bankTx) {
          throw new Error('Bank transaction record not found or already deleted');
        }

        // If worker payment bank tx, delegate to Payment handler
        if (bankTx.notes?.includes('Payment ID:')) {
          const match = bankTx.notes.match(/Payment ID:\s*([^\s•]+)/);
          if (match && match[1]) {
            return await deleteHisaabEntry({
              organizationId,
              session,
              entityType: 'Payment',
              entryId: match[1],
              deleteReason,
            });
          }
        }

        validateEntryPermission(session, {
          createdAt: bankTx.createdAt,
          createdById: bankTx.createdById,
          userId: bankTx.partnerId,
        });

        // If withdrawal from bank to partner is deleted, partner wallet LOSES this money!
        if (bankTx.type === 'TRANSFER_TO_PARTNER' || bankTx.type === 'WITHDRAWAL') {
          if (bankTx.partnerId) {
            const partnerWallet = await getPartnerWalletBalance(tx, organizationId, bankTx.partnerId);
            if (partnerWallet.balance < bankTx.amount) {
              throw new Error(
                `Cannot delete bank withdrawal: partner (${bankTx.partner?.name}) has already spent this cash and wallet balance would become negative (₹${(partnerWallet.balance - bankTx.amount).toLocaleString('en-IN')}).`
              );
            }
          }
        }

        // If deposit from partner to bank is deleted, bank LOSES this money!
        if (bankTx.type === 'TRANSFER_FROM_PARTNER' || bankTx.type === 'DEPOSIT') {
          const currentBankBal = await getFreshBankBalance(tx, organizationId, bankTx.bankAccountId, bankTx.bankAccount.openingBalance);
          if (currentBankBal < bankTx.amount) {
            throw new Error(
              `Cannot delete bank deposit: bank account (${bankTx.bankAccount.name}) balance would become negative (₹${(currentBankBal - bankTx.amount).toLocaleString('en-IN')}).`
            );
          }
        }

        await tx.bankTransaction.update({
          where: { id: bankTx.id },
          data: {
            deletedAt: now,
            deletedById: session.userId,
            deleteReason: deleteReason.trim(),
          },
        });

        await recordAudit({
          tx,
          organizationId,
          userId: session.userId,
          userName: session.name,
          userRole: session.role,
          entityType: 'BankTransaction',
          entityId: bankTx.id,
          action: 'DELETE',
          oldValue: {
            amount: bankTx.amount,
            date: bankTx.date,
            type: bankTx.type,
            bankAccountId: bankTx.bankAccountId,
            partnerId: bankTx.partnerId,
            notes: bankTx.notes,
          },
          details: `Bank transaction [${bankTx.type}] of ₹${bankTx.amount} deleted by ${session.name}. Reason: ${deleteReason.trim()}`,
        });

        return { success: true, deletedId: bankTx.id };
      }

      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  });
}

/**
 * Helper to compute fresh runtime bank balance inside transaction
 */
async function getFreshBankBalance(
  tx: Prisma.TransactionClient,
  organizationId: string,
  bankAccountId: string,
  openingBalance: number
): Promise<number> {
  const [depositsAgg, receiptsAgg, transferFromPartnerAgg, withdrawalsAgg, paymentsAgg, transferToPartnerAgg] =
    await Promise.all([
      tx.bankTransaction.aggregate({
        where: { bankAccountId, type: 'DEPOSIT', deletedAt: null },
        _sum: { amount: true },
      }),
      tx.bankTransaction.aggregate({
        where: { bankAccountId, type: 'RECEIPT', deletedAt: null },
        _sum: { amount: true },
      }),
      tx.bankTransaction.aggregate({
        where: { bankAccountId, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
        _sum: { amount: true },
      }),
      tx.bankTransaction.aggregate({
        where: { bankAccountId, type: 'WITHDRAWAL', deletedAt: null },
        _sum: { amount: true },
      }),
      tx.bankTransaction.aggregate({
        where: { bankAccountId, type: 'PAYMENT', deletedAt: null },
        _sum: { amount: true },
      }),
      tx.bankTransaction.aggregate({
        where: { bankAccountId, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

  const bankCalc = calculateBankBalance({
    openingBalance,
    totalDeposits: depositsAgg._sum.amount || 0,
    totalReceipts: receiptsAgg._sum.amount || 0,
    totalTransfersFromPartner: transferFromPartnerAgg._sum.amount || 0,
    totalWithdrawals: withdrawalsAgg._sum.amount || 0,
    totalPayments: paymentsAgg._sum.amount || 0,
    totalTransfersToPartner: transferToPartnerAgg._sum.amount || 0,
  });

  return bankCalc.balance;
}
