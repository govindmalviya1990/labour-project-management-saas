/**
 * Centralized Worker Balance & Khata / Salary Shared Calculation Helper
 * 
 * Guarantees that across all pages (Khata, Salary/Payroll, Worker Profile):
 *   Salary "Previous Dues" + this month's earned - this month's paid/advances
 *   === Khata "Remaining Payable".
 */

export interface WorkerBalanceTotals {
  openingBalance: number;
  attendanceWages: number;
  pieceRateWages: number;
  totalEarnedWages: number; // attendanceWages + pieceRateWages
  allowances: number;
  grossCredits: number;     // openingBalance + totalEarnedWages + allowances
  advances: number;         // ADVANCE type payments
  directPayments: number;   // SALARY, PAYMENT, FINAL_SETTLEMENT, etc.
  totalDebits: number;      // advances + directPayments
  remainingPayable: number; // grossCredits - totalDebits (>0 means worker is owed; <0 means advance due)
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'ADVANCE_DUE';
}

/**
 * Pure calculation function for worker balance
 */
export function computeWorkerBalance(input: {
  openingBalance?: number | null;
  attendanceWages?: number | null;
  pieceRateWages?: number | null;
  allowances?: number | null;
  advances?: number | null;
  payments?: number | null;
}): WorkerBalanceTotals {
  const openingBalance = Math.round(Number(input.openingBalance || 0) * 100) / 100;
  const attendanceWages = Math.round(Number(input.attendanceWages || 0) * 100) / 100;
  const pieceRateWages = Math.round(Number(input.pieceRateWages || 0) * 100) / 100;
  const totalEarnedWages = Math.round((attendanceWages + pieceRateWages) * 100) / 100;
  const allowances = Math.round(Number(input.allowances || 0) * 100) / 100;
  const grossCredits = Math.round((openingBalance + totalEarnedWages + allowances) * 100) / 100;

  const advances = Math.round(Number(input.advances || 0) * 100) / 100;
  const directPayments = Math.round(Number(input.payments || 0) * 100) / 100;
  const totalDebits = Math.round((advances + directPayments) * 100) / 100;

  const remainingPayable = Math.round((grossCredits - totalDebits) * 100) / 100;

  let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'ADVANCE_DUE' = 'PENDING';
  if (remainingPayable === 0) {
    paymentStatus = 'PAID';
  } else if (remainingPayable < 0) {
    paymentStatus = 'ADVANCE_DUE';
  } else if (totalDebits > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return {
    openingBalance,
    attendanceWages,
    pieceRateWages,
    totalEarnedWages,
    allowances,
    grossCredits,
    advances,
    directPayments,
    totalDebits,
    remainingPayable,
    paymentStatus,
  };
}
