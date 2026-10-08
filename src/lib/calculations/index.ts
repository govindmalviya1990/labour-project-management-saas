/**
 * Centralized Calculation Engine for Labour & Project Management SaaS
 * 
 * Strict single source of truth for all mathematical and financial rules.
 * All formulas handle zero, null, undefined, negative numbers, and safe division.
 */

// =============================================================
// 1. CURRENCY & NUMBER FORMATTING
// =============================================================

/**
 * Formats a number to Indian Rupee (INR) currency format: ₹1,25,000
 * Handles negative numbers, 0, NaN, and Infinity safely.
 */
export function formatINR(amount: number | null | undefined, showDecimals = false): string {
  if (amount === null || amount === undefined || isNaN(amount) || !isFinite(amount)) {
    return '₹0';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0,
  }).format(absAmount);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Safe division preventing NaN or Infinity
 */
export function safeDivide(numerator: number, denominator: number, defaultValue = 0): number {
  if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator === 0) {
    return defaultValue;
  }
  if (isNaN(numerator) || !isFinite(numerator)) {
    return defaultValue;
  }
  const result = numerator / denominator;
  return isFinite(result) ? result : defaultValue;
}

// =============================================================
// 2. SALARY & WAGE CALCULATIONS
// =============================================================

export interface SalaryCalculationInput {
  dailyWage: number;
  wageType?: 'DAILY' | 'HALF_DAY' | 'MONTHLY' | 'PIECE_RATE' | 'MANUAL';
  presentDays: number;
  halfDays: number;
  overtimeHours?: number;
  hourlyRate?: number; // Optional, defaults to dailyWage / 8
  pieceRateAmount?: number;
  manualAmount?: number;
}

export interface SalaryCalculationResult {
  fullDaySalary: number;
  halfDaySalary: number;
  overtimeSalary: number;
  grossSalary: number;
}

/**
 * Calculates worker gross salary based on attendance and wage rules.
 * Example: Ramesh @ ₹800/day. 20 Present, 2 Half Day.
 * Result: 20 * 800 + 2 * 400 = ₹16,800.
 */
export function calculateSalary(input: SalaryCalculationInput): SalaryCalculationResult {
  const dailyWage = Math.max(0, input.dailyWage || 0);
  const presentDays = Math.max(0, input.presentDays || 0);
  const halfDays = Math.max(0, input.halfDays || 0);
  const overtimeHours = Math.max(0, input.overtimeHours || 0);

  if (input.wageType === 'MANUAL') {
    const gross = Math.max(0, input.manualAmount || 0);
    return { fullDaySalary: gross, halfDaySalary: 0, overtimeSalary: 0, grossSalary: gross };
  }

  if (input.wageType === 'PIECE_RATE') {
    const gross = Math.max(0, input.pieceRateAmount || 0);
    return { fullDaySalary: gross, halfDaySalary: 0, overtimeSalary: 0, grossSalary: gross };
  }

  const fullDaySalary = presentDays * dailyWage;
  const halfDaySalary = halfDays * (dailyWage / 2);

  // Standard 8-hour construction shift rate for overtime
  const effectiveHourlyRate = input.hourlyRate && input.hourlyRate > 0
    ? input.hourlyRate
    : (dailyWage / 8);
  const overtimeSalary = overtimeHours * effectiveHourlyRate;

  const grossSalary = fullDaySalary + halfDaySalary + overtimeSalary;

  return {
    fullDaySalary: Math.round(fullDaySalary * 100) / 100,
    halfDaySalary: Math.round(halfDaySalary * 100) / 100,
    overtimeSalary: Math.round(overtimeSalary * 100) / 100,
    grossSalary: Math.round(grossSalary * 100) / 100,
  };
}

// =============================================================
// 3. WORKER KHATA / LEDGER & BALANCE CALCULATIONS
// =============================================================

export interface WorkerBalanceInput {
  totalEarnedSalary: number;
  totalAllowances: number;
  totalAdvances: number;
  totalPayments: number;
}

export interface WorkerBalanceResult {
  totalCredits: number;     // Salary + Allowances (what worker earned)
  totalDebits: number;      // Advances + Payments (what worker received)
  remainingPayable: number; // totalCredits - totalDebits
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING';
}

/**
 * Calculates current worker Khata / Ledger balance.
 * Example:
 * Earned Salary: ₹16,800
 * Allowance: ₹1,000
 * Advance: ₹3,000
 * Payment: ₹10,000
 * Remaining Payable: ₹17,800 - ₹13,000 = ₹4,800
 */
export function calculateWorkerBalance(input: WorkerBalanceInput): WorkerBalanceResult {
  const salary = Math.max(0, input.totalEarnedSalary || 0);
  const allowances = Math.max(0, input.totalAllowances || 0);
  const advances = Math.max(0, input.totalAdvances || 0);
  const payments = Math.max(0, input.totalPayments || 0);

  const totalCredits = Math.round((salary + allowances) * 100) / 100;
  const totalDebits = Math.round((advances + payments) * 100) / 100;
  const remainingPayable = Math.round((totalCredits - totalDebits) * 100) / 100;

  let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' = 'PENDING';
  if (remainingPayable <= 0) {
    paymentStatus = 'PAID';
  } else if (totalDebits > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return {
    totalCredits,
    totalDebits,
    remainingPayable,
    paymentStatus,
  };
}

// =============================================================
// 4. MATERIAL INVENTORY & STOCK
// =============================================================

export interface MaterialStockInput {
  openingStock: number;
  totalReceived: number;
  totalUsed: number;
  transfersIn?: number;
  transfersOut?: number;
  minimumStock?: number;
  purchaseRate?: number;
}

export interface MaterialStockResult {
  remainingStock: number;
  stockValue: number;
  isLowStock: boolean;
}

/**
 * Calculates remaining stock and stock value.
 * Remaining = Opening + Received - Used + TransfersIn - TransfersOut
 * Low stock warning triggers when Remaining <= Minimum Stock
 */
export function calculateMaterialStock(input: MaterialStockInput): MaterialStockResult {
  const opening = Math.max(0, input.openingStock || 0);
  const received = Math.max(0, input.totalReceived || 0);
  const used = Math.max(0, input.totalUsed || 0);
  const transfersIn = Math.max(0, input.transfersIn || 0);
  const transfersOut = Math.max(0, input.transfersOut || 0);
  const minimum = Math.max(0, input.minimumStock || 0);
  const rate = Math.max(0, input.purchaseRate || 0);

  const remainingStock = Math.round((opening + received - used + transfersIn - transfersOut) * 1000) / 1000;
  const stockValue = Math.round(Math.max(0, remainingStock) * rate * 100) / 100;
  const isLowStock = remainingStock <= minimum;

  return {
    remainingStock,
    stockValue,
    isLowStock,
  };
}

// =============================================================
// 5. PROJECT FINANCIALS, BUDGET & PROFIT/LOSS
// =============================================================

export interface ProjectCostInput {
  projectValue: number;
  labourCost: number;
  materialCost: number;
  otherExpenses: number;
  paymentReceived?: number;
  estimatedLabourCost?: number;
  estimatedMaterialCost?: number;
  estimatedOtherExpense?: number;
}

export interface ProjectCostResult {
  actualLabourCost: number;
  actualMaterialCost: number;
  actualOtherExpense: number;
  actualTotalCost: number;
  estimatedTotalCost: number;
  costVariance: number;          // Estimated Total - Actual Total (positive means under budget)
  isBudgetExceeded: boolean;
  actualProfit: number;          // Project Value - Actual Total Cost
  estimatedProfit: number;       // Project Value - Estimated Total Cost
  profitMarginPercentage: number;// (Actual Profit / Project Value) * 100
  totalPaymentReceived: number;  // Total payments received from client
  remainingPayment: number;      // Project Value - Total Payment Received
  collectionPercentage: number;  // (Total Received / Project Value) * 100
  netCashFlow: number;           // Total Received - Actual Total Cost
}

/**
 * Calculates comprehensive project cost, variance, profit, and margin.
 * Example:
 * Project Value: ₹50,00,000
 * Labour: ₹11,00,000, Material: ₹21,00,000, Other: ₹4,00,000
 * Actual Total: ₹36,00,000
 * Actual Profit: ₹14,00,000 (28%)
 */
export function calculateProjectCost(input: ProjectCostInput): ProjectCostResult {
  const projectValue = Math.max(0, input.projectValue || 0);
  const actualLabourCost = Math.max(0, input.labourCost || 0);
  const actualMaterialCost = Math.max(0, input.materialCost || 0);
  const actualOtherExpense = Math.max(0, input.otherExpenses || 0);

  const estLabour = Math.max(0, input.estimatedLabourCost || 0);
  const estMaterial = Math.max(0, input.estimatedMaterialCost || 0);
  const estOther = Math.max(0, input.estimatedOtherExpense || 0);

  const actualTotalCost = Math.round((actualLabourCost + actualMaterialCost + actualOtherExpense) * 100) / 100;
  const estimatedTotalCost = Math.round((estLabour + estMaterial + estOther) * 100) / 100;

  const costVariance = Math.round((estimatedTotalCost - actualTotalCost) * 100) / 100;
  const isBudgetExceeded = estimatedTotalCost > 0 && actualTotalCost > estimatedTotalCost;

  const actualProfit = Math.round((projectValue - actualTotalCost) * 100) / 100;
  const estimatedProfit = Math.round((projectValue - estimatedTotalCost) * 100) / 100;

  const profitMarginPercentage = projectValue > 0
    ? Math.round(((actualProfit / projectValue) * 100) * 100) / 100
    : 0;

  const totalPaymentReceived = Math.round(Math.max(0, input.paymentReceived || 0) * 100) / 100;
  const remainingPayment = Math.round(Math.max(0, projectValue - totalPaymentReceived) * 100) / 100;
  const collectionPercentage = projectValue > 0
    ? Math.round(((totalPaymentReceived / projectValue) * 100) * 10) / 10
    : 0;
  const netCashFlow = Math.round((totalPaymentReceived - actualTotalCost) * 100) / 100;

  return {
    actualLabourCost,
    actualMaterialCost,
    actualOtherExpense,
    actualTotalCost,
    estimatedTotalCost,
    costVariance,
    isBudgetExceeded,
    actualProfit,
    estimatedProfit,
    profitMarginPercentage,
    totalPaymentReceived,
    remainingPayment,
    collectionPercentage,
    netCashFlow,
  };
}

// =============================================================
// 6. COST PER UNIT (e.g. sq.ft., sq.m., etc.)
// =============================================================

export interface CostPerUnitInput {
  completedQuantity: number;
  totalLabourCost: number;
  totalMaterialCost: number;
  totalOtherCost: number;
  unitName?: string; // default "sq.ft."
}

export interface CostPerUnitResult {
  unit: string;
  completedQuantity: number;
  labourCostPerUnit: number;
  materialCostPerUnit: number;
  otherCostPerUnit: number;
  totalCostPerUnit: number;
}

/**
 * Calculates breakdown of cost per unit (e.g. ₹/sq.ft.)
 * Example: 25,000 sq.ft., Total Cost ₹25,00,000
 * Labour ₹8,00,000 (₹32/sq.ft.), Material ₹14,00,000 (₹56/sq.ft.), Other ₹3,00,000 (₹12/sq.ft.)
 * Total = ₹100/sq.ft.
 */
export function calculateCostPerUnit(input: CostPerUnitInput): CostPerUnitResult {
  const qty = Math.max(0, input.completedQuantity || 0);
  const labour = Math.max(0, input.totalLabourCost || 0);
  const material = Math.max(0, input.totalMaterialCost || 0);
  const other = Math.max(0, input.totalOtherCost || 0);
  const total = labour + material + other;

  return {
    unit: input.unitName || 'sq.ft.',
    completedQuantity: qty,
    labourCostPerUnit: Math.round(safeDivide(labour, qty) * 100) / 100,
    materialCostPerUnit: Math.round(safeDivide(material, qty) * 100) / 100,
    otherCostPerUnit: Math.round(safeDivide(other, qty) * 100) / 100,
    totalCostPerUnit: Math.round(safeDivide(total, qty) * 100) / 100,
  };
}

// =============================================================
// 7. WORKER PRODUCTIVITY
// =============================================================

export interface ProductivityInput {
  totalQuantity: number;
  daysWorked: number;
  totalWorkValue?: number;
}

export interface ProductivityResult {
  averageQuantityPerDay: number;
  workValue: number;
  costPerUnit: number;
}

/**
 * Calculates worker productivity metrics.
 * Example: Ramesh completed 900 sq.ft. in 4 days = 225 sq.ft./day
 */
export function calculateProductivity(input: ProductivityInput): ProductivityResult {
  const qty = Math.max(0, input.totalQuantity || 0);
  const days = Math.max(0, input.daysWorked || 0);
  const value = Math.max(0, input.totalWorkValue || 0);

  return {
    averageQuantityPerDay: Math.round(safeDivide(qty, days) * 100) / 100,
    workValue: Math.round(value * 100) / 100,
    costPerUnit: Math.round(safeDivide(value, qty) * 100) / 100,
  };
}

// =============================================================
// 8. WALLET & CASH BOOK CALCULATIONS (Single Source of Truth)
// =============================================================

export interface WalletTransactionInput {
  totalMoneyIn: number;          // Project receipts / client payments received by user
  totalTransfersIn: number;      // Funds received from other partners/users
  totalTransfersOut: number;     // Funds sent to supervisors, workers, or other partners
  totalExpenses: number;         // Expenses debited from user's wallet
  totalBankWithdrawals?: number; // Cash withdrawn from bank into partner wallet ("Bank se Cash Nikala")
  totalBankDeposits?: number;    // Cash deposited from partner wallet into bank ("Cash Bank mein Jama")
}

export interface WalletBalanceResult {
  totalCredits: number;       // totalMoneyIn + totalTransfersIn + totalBankWithdrawals
  totalDebits: number;        // totalTransfersOut + totalExpenses + totalBankDeposits
  balance: number;            // totalCredits - totalDebits
}

/**
 * Formula:
 * Balance = (Money In + Transfers In + Bank Withdrawals) - (Transfers Out + Wallet Expenses + Bank Deposits)
 * All entries strictly exclude deletedAt != null records.
 */
export function calculateWalletBalance(input: WalletTransactionInput): WalletBalanceResult {
  const moneyIn = Math.max(0, input.totalMoneyIn || 0);
  const transfersIn = Math.max(0, input.totalTransfersIn || 0);
  const bankWithdrawals = Math.max(0, input.totalBankWithdrawals || 0);

  const transfersOut = Math.max(0, input.totalTransfersOut || 0);
  const expenses = Math.max(0, input.totalExpenses || 0);
  const bankDeposits = Math.max(0, input.totalBankDeposits || 0);

  const totalCredits = Math.round((moneyIn + transfersIn + bankWithdrawals) * 100) / 100;
  const totalDebits = Math.round((transfersOut + expenses + bankDeposits) * 100) / 100;
  const balance = Math.round((totalCredits - totalDebits) * 100) / 100;

  return {
    totalCredits,
    totalDebits,
    balance,
  };
}

export interface DailyCashFlowInput {
  openingBalance: number;     // Derived closing of prior days
  moneyInToday: number;       // Receipts received today
  transfersInToday: number;   // Transfers received today
  transfersOutToday: number;  // Transfers given today
  expensesToday: number;      // Expenses paid from wallet today
  actualPhysicalCash?: number | null;
}

export interface DailyCashFlowResult {
  openingBalance: number;
  totalInflowToday: number;
  totalOutflowToday: number;
  closingBalance: number;
  actualPhysicalCash?: number | null;
  discrepancy?: number | null; // actualPhysicalCash - closingBalance
}

/**
 * Calculates derived daily cash statement (Din ka hisaab)
 * Closing = Opening + Inflow - Outflow
 */
export function calculateDailyCashFlow(input: DailyCashFlowInput): DailyCashFlowResult {
  const opening = input.openingBalance || 0;
  const moneyIn = Math.max(0, input.moneyInToday || 0);
  const transfersIn = Math.max(0, input.transfersInToday || 0);
  const transfersOut = Math.max(0, input.transfersOutToday || 0);
  const expenses = Math.max(0, input.expensesToday || 0);

  const totalInflowToday = Math.round((moneyIn + transfersIn) * 100) / 100;
  const totalOutflowToday = Math.round((transfersOut + expenses) * 100) / 100;
  const closingBalance = Math.round((opening + totalInflowToday - totalOutflowToday) * 100) / 100;

  let discrepancy: number | null = null;
  if (input.actualPhysicalCash !== undefined && input.actualPhysicalCash !== null) {
    discrepancy = Math.round((input.actualPhysicalCash - closingBalance) * 100) / 100;
  }

  return {
    openingBalance: Math.round(opening * 100) / 100,
    totalInflowToday,
    totalOutflowToday,
    closingBalance,
    actualPhysicalCash: input.actualPhysicalCash ?? null,
    discrepancy,
  };
}

export interface ProjectReceivableResult {
  projectValue: number;
  totalReceived: number;
  pendingReceivable: number;
  receivedPercentage: number;
}

/**
 * Calculates project client billing progress and pending receivables.
 */
export function calculateProjectReceivables(projectValue: number, totalReceived: number): ProjectReceivableResult {
  const value = Math.max(0, projectValue || 0);
  const received = Math.max(0, totalReceived || 0);
  const pending = Math.max(0, Math.round((value - received) * 100) / 100);
  const receivedPercentage = value > 0 ? Math.round(((received / value) * 100) * 10) / 10 : 0;

  return {
    projectValue: value,
    totalReceived: received,
    pendingReceivable: pending,
    receivedPercentage,
  };
}

// =============================================================
// 9. BANK ACCOUNT & OVERALL MONEY POSITION CALCULATIONS
// Single Source of Truth: derived dynamically, never stored!
// =============================================================

export interface BankTransactionInput {
  openingBalance: number;
  totalDeposits?: number;
  totalReceipts?: number;
  totalTransfersFromPartner?: number; // Cash deposited from partner ("Cash Bank mein Jama")
  totalWithdrawals?: number;
  totalPayments?: number;
  totalTransfersToPartner?: number;   // Cash withdrawn by partner ("Bank se Cash Nikala")
}

export interface BankBalanceResult {
  openingBalance: number;
  totalInflow: number;   // totalDeposits + totalReceipts + totalTransfersFromPartner
  totalOutflow: number;  // totalWithdrawals + totalPayments + totalTransfersToPartner
  balance: number;       // openingBalance + totalInflow - totalOutflow
}

/**
 * Derives bank account balance at runtime. Never stores balance in DB!
 * Balance = Opening + (Deposits + Receipts + TransfersFromPartner) - (Withdrawals + Payments + TransfersToPartner)
 * Strictly filters deletedAt === null.
 */
export function calculateBankBalance(input: BankTransactionInput): BankBalanceResult {
  const opening = input.openingBalance || 0;
  const deposits = Math.max(0, input.totalDeposits || 0);
  const receipts = Math.max(0, input.totalReceipts || 0);
  const transfersFromPartner = Math.max(0, input.totalTransfersFromPartner || 0);

  const withdrawals = Math.max(0, input.totalWithdrawals || 0);
  const payments = Math.max(0, input.totalPayments || 0);
  const transfersToPartner = Math.max(0, input.totalTransfersToPartner || 0);

  const totalInflow = Math.round((deposits + receipts + transfersFromPartner) * 100) / 100;
  const totalOutflow = Math.round((withdrawals + payments + transfersToPartner) * 100) / 100;
  const balance = Math.round((opening + totalInflow - totalOutflow) * 100) / 100;

  return {
    openingBalance: Math.round(opening * 100) / 100,
    totalInflow,
    totalOutflow,
    balance,
  };
}

export interface WalletEntityItem {
  id: string;
  name: string;
  balance: number;
}

export interface BankEntityItem {
  id: string;
  name: string;
  bankName: string;
  accountLast4?: string | null;
  balance: number;
}

export interface OverallMoneyPositionInput {
  partnerWallets: WalletEntityItem[];
  supervisorWallets?: WalletEntityItem[];
  bankBalances: BankEntityItem[];
  totalReceived?: number;
  totalExpenses?: number;
}

export interface OverallMoneyPositionResult {
  totalPartnersCash: number;
  totalSupervisorsCash: number;
  totalBankBalance: number;
  totalMoney: number; // Sab Partners ka Cash + Supervisors ka Cash + Bank Balance(s)
  breakdown: {
    partnerWallets: (WalletEntityItem & { percentage: number })[];
    supervisorWallets: (WalletEntityItem & { percentage: number })[];
    bankBalances: (BankEntityItem & { percentage: number })[];
  };
  totalReceived: number;
  totalExpenses: number;
  totalRemaining: number;
}

/**
 * Calculates Single Source of Truth for Overall Money Position:
 * Total Money = Sum(All Partners Cash) + Sum(All Supervisors Cash) + Sum(Bank Balances)
 */
export function calculateOverallMoneyPosition(input: OverallMoneyPositionInput): OverallMoneyPositionResult {
  const partnerWallets = input.partnerWallets || [];
  const supervisorWallets = input.supervisorWallets || [];
  const bankBalances = input.bankBalances || [];

  const totalPartnersCash = Math.round(
    partnerWallets.reduce((sum, p) => sum + (p.balance || 0), 0) * 100
  ) / 100;

  const totalSupervisorsCash = Math.round(
    supervisorWallets.reduce((sum, s) => sum + (s.balance || 0), 0) * 100
  ) / 100;

  const totalBankBalance = Math.round(
    bankBalances.reduce((sum, b) => sum + (b.balance || 0), 0) * 100
  ) / 100;

  const totalMoney = Math.round((totalPartnersCash + totalSupervisorsCash + totalBankBalance) * 100) / 100;

  const calcPct = (amount: number) =>
    totalMoney > 0 ? Number(((amount / totalMoney) * 100).toFixed(1)) : 0;

  return {
    totalPartnersCash,
    totalSupervisorsCash,
    totalBankBalance,
    totalMoney,
    breakdown: {
      partnerWallets: partnerWallets.map((p) => ({
        ...p,
        percentage: calcPct(p.balance),
      })),
      supervisorWallets: supervisorWallets.map((s) => ({
        ...s,
        percentage: calcPct(s.balance),
      })),
      bankBalances: bankBalances.map((b) => ({
        ...b,
        percentage: calcPct(b.balance),
      })),
    },
    totalReceived: Math.round((input.totalReceived || 0) * 100) / 100,
    totalExpenses: Math.round((input.totalExpenses || 0) * 100) / 100,
    totalRemaining: totalMoney,
  };
}
