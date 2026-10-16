/**
 * Centralized Supplier Balance & Ledger Shared Calculation Helper
 * Single Source of Truth: Supplier balance is NEVER stored denormalized.
 * 
 * Supplier Balance Rule:
 * balance = openingBalance + sum(bills) - sum(returns) - sum(payments)
 * + means we owe the supplier (Payable / Dues)
 * - means supplier owes us (Advance with Supplier)
 */

export interface SupplierBalanceSummary {
  openingBalance: number;
  totalBills: number;
  totalReturns: number;
  totalPayments: number;
  netPurchases: number; // totalBills - totalReturns
  remainingBalance: number; // openingBalance + totalBills - totalReturns - totalPayments
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'ADVANCE';
}

export interface BillAllocationItem {
  id: string;
  billNumber?: string | null;
  billDate: Date | string;
  totalAmount: number;
  returnAmount: number;
  paidAmount: number;
  netDue: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  ageDays: number;
}

export interface AgingBreakdown {
  bracket0To30: number;
  bracket31To60: number;
  bracket61To90: number;
  bracket90Plus: number;
  totalDue: number;
}

/**
 * Pure calculation for overall supplier balance
 */
export function computeSupplierBalance(input: {
  openingBalance?: number | null;
  billsTotal?: number | null;
  returnsTotal?: number | null;
  paymentsTotal?: number | null;
}): SupplierBalanceSummary {
  const openingBalance = Math.round(Number(input.openingBalance || 0) * 100) / 100;
  const totalBills = Math.round(Number(input.billsTotal || 0) * 100) / 100;
  const totalReturns = Math.round(Number(input.returnsTotal || 0) * 100) / 100;
  const totalPayments = Math.round(Number(input.paymentsTotal || 0) * 100) / 100;

  const netPurchases = Math.round((totalBills - totalReturns) * 100) / 100;
  const remainingBalance = Math.round((openingBalance + totalBills - totalReturns - totalPayments) * 100) / 100;

  let status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'ADVANCE' = 'UNPAID';
  if (remainingBalance === 0) {
    status = 'PAID';
  } else if (remainingBalance < 0) {
    status = 'ADVANCE';
  } else if (totalPayments > 0 || totalReturns > 0) {
    status = 'PARTIALLY_PAID';
  }

  return {
    openingBalance,
    totalBills,
    totalReturns,
    totalPayments,
    netPurchases,
    remainingBalance,
    status,
  };
}

/**
 * Allocates payments & returns to bills.
 * 1. Specific bill payments & returns are allocated to their chosen bill.
 * 2. On-account payments (billId is null) and excess payments are allocated FIFO (oldest bill first).
 * 3. Returns array of allocated bills with live status and unallocated advance.
 */
export function allocateBillsFIFO(
  bills: Array<{
    id: string;
    billNumber?: string | null;
    billDate: Date | string;
    totalAmount: number;
    deletedAt?: Date | string | null;
  }>,
  payments: Array<{
    id: string;
    billId?: string | null;
    amount: number;
    date: Date | string;
    deletedAt?: Date | string | null;
  }>,
  returns: Array<{
    id: string;
    billId?: string | null;
    amount: number;
    returnDate?: Date | string;
    date?: Date | string;
    deletedAt?: Date | string | null;
  }> = [],
  asOfDate: Date = new Date()
): {
  allocatedBills: BillAllocationItem[];
  unallocatedAdvance: number;
  aging: AgingBreakdown;
} {
  // Filter active records
  const activeBills = bills.filter((b) => !b.deletedAt);
  const activePayments = payments.filter((p) => !p.deletedAt);
  const activeReturns = returns.filter((r) => !r.deletedAt);

  // Sort bills oldest first (FIFO)
  const sortedBills = [...activeBills].sort(
    (a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime()
  );

  // Map of specific returns and payments per bill
  const specificReturnsMap = new Map<string, number>();
  let generalReturnsPool = 0;
  for (const r of activeReturns) {
    const amt = Number(r.amount) || 0;
    if (r.billId) {
      specificReturnsMap.set(r.billId, (specificReturnsMap.get(r.billId) || 0) + amt);
    } else {
      generalReturnsPool += amt;
    }
  }

  const specificPaymentsMap = new Map<string, number>();
  let generalPaymentsPool = 0;
  for (const p of activePayments) {
    const amt = Number(p.amount) || 0;
    if (p.billId) {
      specificPaymentsMap.set(p.billId, (specificPaymentsMap.get(p.billId) || 0) + amt);
    } else {
      generalPaymentsPool += amt;
    }
  }

  const allocatedBills: BillAllocationItem[] = [];
  const nowMs = asOfDate.getTime();

  for (const bill of sortedBills) {
    const billTotal = Math.round(Number(bill.totalAmount) * 100) / 100;
    const bDate = new Date(bill.billDate);
    const ageDays = Math.max(0, Math.floor((nowMs - bDate.getTime()) / (1000 * 60 * 60 * 24)));

    // 1. Apply specific return
    let billReturn = specificReturnsMap.get(bill.id) || 0;
    // Apply general return pool if needed
    if (generalReturnsPool > 0 && billReturn < billTotal) {
      const needed = billTotal - billReturn;
      const take = Math.min(needed, generalReturnsPool);
      billReturn += take;
      generalReturnsPool -= take;
    }
    billReturn = Math.round(billReturn * 100) / 100;

    const netAfterReturn = Math.max(0, Math.round((billTotal - billReturn) * 100) / 100);

    // 2. Apply specific payment
    let billPaid = specificPaymentsMap.get(bill.id) || 0;
    if (billPaid > netAfterReturn) {
      // Excess specific payment flows to general pool
      const excess = billPaid - netAfterReturn;
      generalPaymentsPool += excess;
      billPaid = netAfterReturn;
    }

    // 3. Apply on-account payments FIFO
    if (generalPaymentsPool > 0 && billPaid < netAfterReturn) {
      const needed = Math.round((netAfterReturn - billPaid) * 100) / 100;
      const take = Math.min(needed, generalPaymentsPool);
      billPaid = Math.round((billPaid + take) * 100) / 100;
      generalPaymentsPool = Math.round((generalPaymentsPool - take) * 100) / 100;
    }

    const netDue = Math.max(0, Math.round((netAfterReturn - billPaid) * 100) / 100);

    let status: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
    if (netDue === 0 && (billPaid > 0 || billReturn > 0 || billTotal === 0)) {
      status = 'PAID';
    } else if (billPaid > 0 || billReturn > 0) {
      status = 'PARTIAL';
    }

    allocatedBills.push({
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      totalAmount: billTotal,
      returnAmount: billReturn,
      paidAmount: billPaid,
      netDue,
      status,
      ageDays,
    });
  }

  // Compute aging breakdown on unpaid dues
  const aging: AgingBreakdown = {
    bracket0To30: 0,
    bracket31To60: 0,
    bracket61To90: 0,
    bracket90Plus: 0,
    totalDue: 0,
  };

  for (const item of allocatedBills) {
    if (item.netDue > 0) {
      aging.totalDue = Math.round((aging.totalDue + item.netDue) * 100) / 100;
      if (item.ageDays <= 30) {
        aging.bracket0To30 = Math.round((aging.bracket0To30 + item.netDue) * 100) / 100;
      } else if (item.ageDays <= 60) {
        aging.bracket31To60 = Math.round((aging.bracket31To60 + item.netDue) * 100) / 100;
      } else if (item.ageDays <= 90) {
        aging.bracket61To90 = Math.round((aging.bracket61To90 + item.netDue) * 100) / 100;
      } else {
        aging.bracket90Plus = Math.round((aging.bracket90Plus + item.netDue) * 100) / 100;
      }
    }
  }

  return {
    allocatedBills,
    unallocatedAdvance: generalPaymentsPool,
    aging,
  };
}
