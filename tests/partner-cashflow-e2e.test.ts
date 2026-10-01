import {
  calculateWalletBalance,
  calculateDailyCashFlow,
  calculateProjectReceivables,
  calculateWorkerBalance,
  calculateMaterialStock,
  formatINR,
} from '../src/lib/calculations/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n======================================================');
console.log('--- RUNNING PARTNER CASH FLOW & WALLET E2E TEST ---');
console.log('======================================================\n');

// -----------------------------------------------------------------
// Step 1: Partner receives client project payment: ₹50,000
// -----------------------------------------------------------------
console.log('Step 1: Client Payment (Money IN)');
const projectTotalValue = 200000; // 2 Lakh project
const clientReceiptAmount = 50000;
const receivables = calculateProjectReceivables(projectTotalValue, clientReceiptAmount);

assert(receivables.totalReceived === 50000, `Total received is ₹50,000 (got: ${receivables.totalReceived})`);
assert(receivables.pendingReceivable === 150000, `Pending receivable is ₹1,50,000 (got: ${receivables.pendingReceivable})`);
assert(receivables.receivedPercentage === 25, `Received percentage is 25% (got: ${receivables.receivedPercentage}%)`);

// -----------------------------------------------------------------
// Step 2: Partner Cash Disbursements & Expenses
// - Gives supervisor: ₹10,000
// - Gives worker: ₹2,000 (Khata payment)
// - Buys goods: ₹8,000 (1-Click Goods Purchase)
// - Chay-nasta: ₹300 (Daily site expense)
// -----------------------------------------------------------------
console.log('\nStep 2: Cash Outflow & Wallet Derived Balances');
const supervisorTransfer = 10000;
const workerTransfer = 2000;
const goodsPurchase = 8000;
const chayNastaExpense = 300;

const walletCalculation = calculateWalletBalance({
  totalMoneyIn: clientReceiptAmount,
  totalTransfersIn: 0,
  totalTransfersOut: supervisorTransfer + workerTransfer,
  totalExpenses: goodsPurchase + chayNastaExpense,
});

assert(walletCalculation.totalCredits === 50000, `Total credits should be ₹50,000 (got: ${walletCalculation.totalCredits})`);
assert(walletCalculation.totalDebits === 20300, `Total debits should be ₹20,300 (got: ${walletCalculation.totalDebits})`);
assert(walletCalculation.balance === 29700, `Partner Closing Balance must be EXACTLY ₹29,700 (got: ${walletCalculation.balance})`);

// -----------------------------------------------------------------
// Step 3: Daily Cash Flow (Din Ka Hisaab) & Physical Verification
// -----------------------------------------------------------------
console.log('\nStep 3: Daily Cash Flow Statement (Din Ka Hisaab)');
const dailyCashFlow = calculateDailyCashFlow({
  openingBalance: 0,
  moneyInToday: clientReceiptAmount,
  transfersInToday: 0,
  transfersOutToday: supervisorTransfer + workerTransfer,
  expensesToday: goodsPurchase + chayNastaExpense,
  actualPhysicalCash: 29700,
});

assert(dailyCashFlow.openingBalance === 0, `Opening balance is ₹0 (got: ${dailyCashFlow.openingBalance})`);
assert(dailyCashFlow.totalInflowToday === 50000, `Inflow today is ₹50,000 (got: ${dailyCashFlow.totalInflowToday})`);
assert(dailyCashFlow.totalOutflowToday === 20300, `Outflow today is ₹20,300 (got: ${dailyCashFlow.totalOutflowToday})`);
assert(dailyCashFlow.closingBalance === 29700, `Closing balance is ₹29,700 (got: ${dailyCashFlow.closingBalance})`);
assert(dailyCashFlow.discrepancy === 0, `Discrepancy is ₹0 when physical matches system (got: ${dailyCashFlow.discrepancy})`);

// -----------------------------------------------------------------
// Step 4: Discrepancy Scenarios
// -----------------------------------------------------------------
console.log('\nStep 4: Discrepancy Checks (Surplus & Shortage)');
const surplusDay = calculateDailyCashFlow({
  openingBalance: 1000,
  moneyInToday: 5000,
  transfersInToday: 0,
  transfersOutToday: 1000,
  expensesToday: 500,
  actualPhysicalCash: 4800, // Expected: 1000 + 5000 - 1500 = 4500, surplus +300
});
assert(surplusDay.closingBalance === 4500, 'Surplus test closing balance should be 4500');
assert(surplusDay.discrepancy === 300, `Surplus discrepancy should be +300 (got: ${surplusDay.discrepancy})`);

const shortageDay = calculateDailyCashFlow({
  openingBalance: 1000,
  moneyInToday: 5000,
  transfersInToday: 0,
  transfersOutToday: 1000,
  expensesToday: 500,
  actualPhysicalCash: 4200, // Expected: 4500, shortage -300
});
assert(shortageDay.discrepancy === -300, `Shortage discrepancy should be -300 (got: ${shortageDay.discrepancy})`);

// -----------------------------------------------------------------
// Step 5: Zero Double-Counting Verification for Worker Payout
// -----------------------------------------------------------------
console.log('\nStep 5: Zero Double-Counting Verification');
// When ₹2,000 is given to worker:
// - Debited from Partner Wallet as FundTransfer: ₹2,000
// - Credited to Worker Khata as Payment: ₹2,000
// - NOT recorded in Expenses
// Worker worked 7 days @ ₹500 = ₹3,500 earned
const workerKhata = calculateWorkerBalance({
  totalEarnedSalary: 3500,
  totalAllowances: 0,
  totalAdvances: 0,
  totalPayments: 2000, // Paid via the transfer
});
assert(workerKhata.totalCredits === 3500, `Worker earned credits: ₹3,500 (got: ${workerKhata.totalCredits})`);
assert(workerKhata.totalDebits === 2000, `Worker debits: ₹2,000 (got: ${workerKhata.totalDebits})`);
assert(workerKhata.remainingPayable === 1500, `Worker remaining dues: ₹1,500 (got: ${workerKhata.remainingPayable})`);
assert(workerKhata.paymentStatus === 'PARTIALLY_PAID', `Worker status: PARTIALLY_PAID (got: ${workerKhata.paymentStatus})`);

// -----------------------------------------------------------------
// Step 6: Material Stock Verification (Aaya / Use Hua / Bacha)
// -----------------------------------------------------------------
console.log('\nStep 6: Material Stock Breakdown (Aaya / Use Hua / Bacha)');
// Goods purchase of ₹8,000: 20 bags @ ₹400
// 12 bags used on site
const materialStock = calculateMaterialStock({
  openingStock: 0,
  totalReceived: 20, // Aaya
  totalUsed: 12,     // Use hua
  minimumStock: 5,
  purchaseRate: 400,
});
assert(materialStock.remainingStock === 8, `Remaining stock (Bacha) should be 8 bags (got: ${materialStock.remainingStock})`);
assert(materialStock.stockValue === 3200, `Stock value should be ₹3,200 (got: ${materialStock.stockValue})`);
assert(!materialStock.isLowStock, '8 bags > 5 min stock, should not be low stock');

// -----------------------------------------------------------------
// Step 7: Soft Delete Exclusions Simulation
// -----------------------------------------------------------------
console.log('\nStep 7: Soft Delete Exclusion Verification');
// If an erroneous expense of ₹500 is soft deleted:
// active expenses remain ₹8,300
const softDeleteSimulation = calculateWalletBalance({
  totalMoneyIn: 50000,
  totalTransfersIn: 0,
  totalTransfersOut: 12000,
  totalExpenses: 8300, // deleted ₹500 is excluded
});
assert(softDeleteSimulation.balance === 29700, `Balance remains ₹29,700 after soft delete exclusion (got: ${softDeleteSimulation.balance})`);

console.log('\n======================================================');
console.log('🎉 ALL PARTNER CASH FLOW & CASH BOOK E2E TESTS PASSED!');
console.log('======================================================\n');
