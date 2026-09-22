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
