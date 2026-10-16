import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { calculateWalletBalance, calculateBankBalance, WalletBalanceResult } from '@/lib/calculations';

export interface PartnerWalletDetails extends WalletBalanceResult {
  userId: string;
  organizationId: string;
  openingBalanceDate: Date | null;
  openingBalanceNote: string | null;
  breakdown: {
    totalMoneyIn: number;
    totalTransfersIn: number;
    totalBankWithdrawals: number;
    totalTransfersOut: number;
    totalExpenses: number;
    totalBankDeposits: number;
  };
}

/**
 * Calculates fresh, atomic partner wallet balance including opening balance.
 * Uses calculateWalletBalance internally to guarantee identical math everywhere.
 */
export async function getPartnerWalletBalance(
  client: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  userId: string
): Promise<PartnerWalletDetails> {
  const [orgUser, mIn, tIn, tOut, exp, bWith, bDep] = await Promise.all([
    client.organizationUser.findFirst({
      where: { organizationId, userId },
      select: { openingBalance: true, openingBalanceDate: true, openingBalanceNote: true },
    }),
    client.projectReceipt.aggregate({
      where: {
        organizationId,
        receivedById: userId,
        deletedAt: null,
        OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
      },
      _sum: { amount: true },
    }),
    client.fundTransfer.aggregate({
      where: { organizationId, toUserId: userId, deletedAt: null },
      _sum: { amount: true },
    }),
    client.fundTransfer.aggregate({
      where: { organizationId, fromUserId: userId, deletedAt: null },
      _sum: { amount: true },
    }),
    client.expense.aggregate({
      where: { organizationId, walletOwnerId: userId, deletedAt: null },
      _sum: { amount: true },
    }),
    client.bankTransaction.aggregate({
      where: { organizationId, partnerId: userId, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
      _sum: { amount: true },
    }),
    client.bankTransaction.aggregate({
      where: { organizationId, partnerId: userId, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const openingBalance = orgUser?.openingBalance ?? 0;
  const totalMoneyIn = mIn._sum.amount || 0;
  const totalTransfersIn = tIn._sum.amount || 0;
  const totalBankWithdrawals = bWith._sum.amount || 0;
  const totalTransfersOut = tOut._sum.amount || 0;
  const totalExpenses = exp._sum.amount || 0;
  const totalBankDeposits = bDep._sum.amount || 0;

  const result = calculateWalletBalance({
    openingBalance,
    totalMoneyIn,
    totalTransfersIn,
    totalBankWithdrawals,
    totalTransfersOut,
    totalExpenses,
    totalBankDeposits,
  });

  return {
    ...result,
    userId,
    organizationId,
    openingBalanceDate: orgUser?.openingBalanceDate || null,
    openingBalanceNote: orgUser?.openingBalanceNote || null,
    breakdown: {
      totalMoneyIn,
      totalTransfersIn,
      totalBankWithdrawals,
      totalTransfersOut,
      totalExpenses,
      totalBankDeposits,
    },
  };
}

/**
 * Bulk partner wallet balance loader for lists, tables, dashboards, and Money Position.
 */
export async function getMultiplePartnersWalletBalances(
  client: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  userIds?: string[]
): Promise<Map<string, PartnerWalletDetails>> {
  const whereUser = userIds && userIds.length > 0 ? { in: userIds } : undefined;

  const orgUsers = await client.organizationUser.findMany({
    where: {
      organizationId,
      ...(whereUser ? { userId: whereUser } : {}),
    },
    select: {
      userId: true,
      openingBalance: true,
      openingBalanceDate: true,
      openingBalanceNote: true,
    },
  });

  const targetIds = orgUsers.map((u) => u.userId);
  const userMap = new Map(orgUsers.map((u) => [u.userId, u]));

  if (targetIds.length === 0) {
    return new Map();
  }

  const [mInGroups, tInGroups, tOutGroups, expGroups, bWithGroups, bDepGroups] = await Promise.all([
    client.projectReceipt.groupBy({
      by: ['receivedById'],
      where: {
        organizationId,
        receivedById: { in: targetIds },
        deletedAt: null,
        OR: [{ receivedIn: null }, { receivedIn: 'WALLET' }],
      },
      _sum: { amount: true },
    }),
    client.fundTransfer.groupBy({
      by: ['toUserId'],
      where: {
        organizationId,
        toUserId: { in: targetIds },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    client.fundTransfer.groupBy({
      by: ['fromUserId'],
      where: {
        organizationId,
        fromUserId: { in: targetIds },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    client.expense.groupBy({
      by: ['walletOwnerId'],
      where: {
        organizationId,
        walletOwnerId: { in: targetIds },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    client.bankTransaction.groupBy({
      by: ['partnerId'],
      where: {
        organizationId,
        partnerId: { in: targetIds },
        type: 'TRANSFER_TO_PARTNER',
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    client.bankTransaction.groupBy({
      by: ['partnerId'],
      where: {
        organizationId,
        partnerId: { in: targetIds },
        type: 'TRANSFER_FROM_PARTNER',
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
  ]);

  const mInMap = new Map(mInGroups.map((g) => [g.receivedById, g._sum.amount || 0]));
  const tInMap = new Map(tInGroups.map((g) => [g.toUserId!, g._sum.amount || 0]));
  const tOutMap = new Map(tOutGroups.map((g) => [g.fromUserId, g._sum.amount || 0]));
  const expMap = new Map(expGroups.map((g) => [g.walletOwnerId!, g._sum.amount || 0]));
  const bWithMap = new Map(bWithGroups.map((g) => [g.partnerId!, g._sum.amount || 0]));
  const bDepMap = new Map(bDepGroups.map((g) => [g.partnerId!, g._sum.amount || 0]));

  const resultMap = new Map<string, PartnerWalletDetails>();

  for (const u of orgUsers) {
    const openingBalance = u.openingBalance ?? 0;
    const totalMoneyIn = mInMap.get(u.userId) || 0;
    const totalTransfersIn = tInMap.get(u.userId) || 0;
    const totalBankWithdrawals = bWithMap.get(u.userId) || 0;
    const totalTransfersOut = tOutMap.get(u.userId) || 0;
    const totalExpenses = expMap.get(u.userId) || 0;
    const totalBankDeposits = bDepMap.get(u.userId) || 0;

    const calc = calculateWalletBalance({
      openingBalance,
      totalMoneyIn,
      totalTransfersIn,
      totalBankWithdrawals,
      totalTransfersOut,
      totalExpenses,
      totalBankDeposits,
    });

    resultMap.set(u.userId, {
      ...calc,
      userId: u.userId,
      organizationId,
      openingBalanceDate: u.openingBalanceDate,
      openingBalanceNote: u.openingBalanceNote,
      breakdown: {
        totalMoneyIn,
        totalTransfersIn,
        totalBankWithdrawals,
        totalTransfersOut,
        totalExpenses,
        totalBankDeposits,
      },
    });
  }

  return resultMap;
}

export interface BankAccountBalanceDetails {
  bankAccountId: string;
  balance: number;
  openingBalance: number;
  totalDeposits: number;
  totalReceipts: number;
  totalTransfersFromPartner: number;
  totalWithdrawals: number;
  totalPayments: number;
  totalTransfersToPartner: number;
}

export async function getBankAccountBalance(
  client: Prisma.TransactionClient | typeof prisma,
  bankAccountId: string
): Promise<BankAccountBalanceDetails> {
  const bankAccount = await client.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { openingBalance: true },
  });

  const [
    depositsAgg,
    receiptsAgg,
    transferFromPartnerAgg,
    withdrawalsAgg,
    paymentsAgg,
    transferToPartnerAgg,
  ] = await Promise.all([
    client.bankTransaction.aggregate({
      where: { bankAccountId, type: 'DEPOSIT', deletedAt: null },
      _sum: { amount: true },
    }),
    client.bankTransaction.aggregate({
      where: { bankAccountId, type: 'RECEIPT', deletedAt: null },
      _sum: { amount: true },
    }),
    client.bankTransaction.aggregate({
      where: { bankAccountId, type: 'TRANSFER_FROM_PARTNER', deletedAt: null },
      _sum: { amount: true },
    }),
    client.bankTransaction.aggregate({
      where: { bankAccountId, type: 'WITHDRAWAL', deletedAt: null },
      _sum: { amount: true },
    }),
    client.bankTransaction.aggregate({
      where: { bankAccountId, type: 'PAYMENT', deletedAt: null },
      _sum: { amount: true },
    }),
    client.bankTransaction.aggregate({
      where: { bankAccountId, type: 'TRANSFER_TO_PARTNER', deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const calc = calculateBankBalance({
    openingBalance: bankAccount?.openingBalance || 0,
    totalDeposits: depositsAgg._sum.amount || 0,
    totalReceipts: receiptsAgg._sum.amount || 0,
    totalTransfersFromPartner: transferFromPartnerAgg._sum.amount || 0,
    totalWithdrawals: withdrawalsAgg._sum.amount || 0,
    totalPayments: paymentsAgg._sum.amount || 0,
    totalTransfersToPartner: transferToPartnerAgg._sum.amount || 0,
  });

  return {
    bankAccountId,
    balance: calc.balance,
    openingBalance: bankAccount?.openingBalance || 0,
    totalDeposits: depositsAgg._sum.amount || 0,
    totalReceipts: receiptsAgg._sum.amount || 0,
    totalTransfersFromPartner: transferFromPartnerAgg._sum.amount || 0,
    totalWithdrawals: withdrawalsAgg._sum.amount || 0,
    totalPayments: paymentsAgg._sum.amount || 0,
    totalTransfersToPartner: transferToPartnerAgg._sum.amount || 0,
  };
}
