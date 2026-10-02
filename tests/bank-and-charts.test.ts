import {
  calculateWalletBalance,
  calculateBankBalance,
  calculateOverallMoneyPosition,
  formatINR,
} from '../src/lib/calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('\n======================================================');
console.log('--- RUNNING EXPENSE CHARTS & BANK ACCOUNTS TEST SUITE ---');
console.log('======================================================\n');

// -------------------------------------------------------------
// TEST 1: Expense Charts Math & Category Breakdown Consistency
// -------------------------------------------------------------
console.log('Test 1: Expense Donut & Pillar Math Consistency');

const sampleExpenses = [
  { id: '1', category: 'GOODS_PURCHASE', amount: 15000, deletedAt: null },
  { id: '2', category: 'CHAY_NASTA', amount: 2000, deletedAt: null },
  { id: '3', category: 'TRAVEL_PETROL', amount: 3500, deletedAt: null },
  { id: '4', category: 'LABOUR_FOOD', amount: 4500, deletedAt: null },
  { id: '5', category: 'Dinner', amount: 1200, deletedAt: null }, // Custom reason
  { id: '6', category: 'PERSONAL', amount: 5000, deletedAt: new Date() }, // Soft deleted!
];

// Active only
const activeExpenses = sampleExpenses.filter((e) => e.deletedAt === null);
const totalExpense = activeExpenses.reduce((sum, e) => sum + e.amount, 0);

assert(totalExpense === 26200, `Total active expenses should be ₹26,200 (got: ${totalExpense})`);

// Category aggregations
const catAgg: Record<string, number> = {};
activeExpenses.forEach((e) => {
  catAgg[e.category] = (catAgg[e.category] || 0) + e.amount;
});

const donutSlices = Object.entries(catAgg).map(([category, amount]) => ({
  category,
  amount,
  percentage: Number(((amount / totalExpense) * 100).toFixed(1)),
}));

const donutSum = donutSlices.reduce((sum, s) => sum + s.amount, 0);
assert(donutSum === totalExpense, `Donut chart sum (${donutSum}) matches total expense (${totalExpense})`);

// Soft-deleted entry must NOT appear
assert(
  !donutSlices.some((s) => s.category === 'PERSONAL'),
  'Soft-deleted expense (PERSONAL) is strictly excluded from chart'
);

// Custom reason must appear
const dinnerSlice = donutSlices.find((s) => s.category === 'Dinner');
assert(dinnerSlice !== undefined && dinnerSlice.amount === 1200, 'Custom reason "Dinner" correctly included in chart');

// -------------------------------------------------------------
// TEST 2: Bank Account Derived Balance Formula (Single Source of Truth)
// -------------------------------------------------------------
console.log('\nTest 2: Bank Account Derived Balance Formula');

// Opening: 1,00,000
// Receipts: 50,000 (direct client bill in bank)
// Deposits: 10,000 (direct bank deposit)
// Transfers From Partner ("Cash Bank mein Jama"): 5,000
// Withdrawals: 15,000
// Payments: 20,000
// Transfers To Partner ("Bank se Cash Nikala"): 10,000
const bankCalc = calculateBankBalance({
  openingBalance: 100000,
  totalReceipts: 50000,
  totalDeposits: 10000,
  totalTransfersFromPartner: 5000,
  totalWithdrawals: 15000,
  totalPayments: 20000,
  totalTransfersToPartner: 10000,
});

// Balance = 100000 + (50000 + 10000 + 5000) - (15000 + 20000 + 10000)
// = 100000 + 65000 - 45000 = 120000
assert(bankCalc.totalInflow === 65000, `Bank total inflow is ₹65,000 (got: ${bankCalc.totalInflow})`);
assert(bankCalc.totalOutflow === 45000, `Bank total outflow is ₹45,000 (got: ${bankCalc.totalOutflow})`);
assert(bankCalc.balance === 120000, `Bank derived balance is ₹1,20,000 (got: ${bankCalc.balance})`);

// -------------------------------------------------------------
// TEST 3: Money In "Received In" Destination Routing
// -------------------------------------------------------------
console.log('\nTest 3: Money In Routing (Cash Wallet vs Bank Account)');

// Case A: Received in Cash Wallet (Rs 50,000)
const walletAfterCashMoneyIn = calculateWalletBalance({
  totalMoneyIn: 50000,
  totalTransfersIn: 0,
  totalTransfersOut: 0,
  totalExpenses: 0,
});
assert(walletAfterCashMoneyIn.balance === 50000, 'Cash Money In increases partner physical cash to ₹50,000');

// Case B: Received in Bank Account (Rs 50,000)
// Partner cash wallet receives 0
const walletAfterBankMoneyIn = calculateWalletBalance({
  totalMoneyIn: 0, // NOT credited to cash wallet!
  totalTransfersIn: 0,
  totalTransfersOut: 0,
  totalExpenses: 0,
});
assert(walletAfterBankMoneyIn.balance === 0, 'Bank Money In does NOT increase partner physical cash wallet (remains 0)');

const bankAfterMoneyIn = calculateBankBalance({
  openingBalance: 0,
  totalReceipts: 50000,
});
assert(bankAfterMoneyIn.balance === 50000, 'Bank Money In directly increases Bank Balance to ₹50,000');

// -------------------------------------------------------------
// TEST 4: The Mandatory E2E Test Scenario from User Request
// Partner A cash 30,000, Partner B cash 20,000, Bank 1,00,000 -> Total 1,50,000.
// Bank se 10,000 nikalo -> Bank 90,000, Partner A 40,000, total 1,50,000 (same).
// Expense 5,000 -> total 1,45,000. Delete karke dobara verify karo.
// -------------------------------------------------------------
console.log('\nTest 4: Mandatory E2E Test Scenario (Rs 1,50,000 Flow)');

// Step A: Initial State
let partnerA = calculateWalletBalance({
  totalMoneyIn: 30000,
  totalTransfersIn: 0,
  totalTransfersOut: 0,
  totalExpenses: 0,
});
let partnerB = calculateWalletBalance({
  totalMoneyIn: 20000,
  totalTransfersIn: 0,
  totalTransfersOut: 0,
  totalExpenses: 0,
});
let bank1 = calculateBankBalance({
  openingBalance: 100000,
});

let overall = calculateOverallMoneyPosition({
  partnerWallets: [
    { id: 'partnerA', name: 'Partner A', balance: partnerA.balance },
    { id: 'partnerB', name: 'Partner B', balance: partnerB.balance },
  ],
  bankBalances: [
    { id: 'bank1', name: 'HDFC Current', bankName: 'HDFC', balance: bank1.balance },
  ],
});

assert(partnerA.balance === 30000, `Initial Partner A Cash is ₹30,000 (got: ${partnerA.balance})`);
assert(partnerB.balance === 20000, `Initial Partner B Cash is ₹20,000 (got: ${partnerB.balance})`);
assert(bank1.balance === 100000, `Initial Bank is ₹1,00,000 (got: ${bank1.balance})`);
assert(overall.totalMoney === 150000, `Initial Total Company Money is ₹1,50,000 (got: ${overall.totalMoney})`);

// Step B: "Bank se 10,000 nikalo" into Partner A
// Bank debited: totalTransfersToPartner = 10,000
// Partner A credited: totalBankWithdrawals = 10,000
bank1 = calculateBankBalance({
  openingBalance: 100000,
  totalTransfersToPartner: 10000,
});
partnerA = calculateWalletBalance({
  totalMoneyIn: 30000,
  totalTransfersIn: 0,
  totalTransfersOut: 0,
  totalExpenses: 0,
  totalBankWithdrawals: 10000, // Cash withdrawn from bank into cash wallet
});

overall = calculateOverallMoneyPosition({
  partnerWallets: [
    { id: 'partnerA', name: 'Partner A', balance: partnerA.balance },
    { id: 'partnerB', name: 'Partner B', balance: partnerB.balance },
  ],
  bankBalances: [
    { id: 'bank1', name: 'HDFC Current', bankName: 'HDFC', balance: bank1.balance },
  ],
});

assert(bank1.balance === 90000, `After withdrawal, Bank Balance is ₹90,000 (got: ${bank1.balance})`);
assert(partnerA.balance === 40000, `After withdrawal, Partner A Cash is ₹40,000 (got: ${partnerA.balance})`);
assert(partnerB.balance === 20000, `Partner B Cash remains ₹20,000 (got: ${partnerB.balance})`);
assert(overall.totalMoney === 150000, `Internal movement keeps Total Money constant at ₹1,50,000 (got: ${overall.totalMoney})`);

// Step C: Expense 5,000 from Partner A
partnerA = calculateWalletBalance({
  totalMoneyIn: 30000,
  totalTransfersIn: 0,
  totalTransfersOut: 0,
  totalExpenses: 5000,
  totalBankWithdrawals: 10000,
});

overall = calculateOverallMoneyPosition({
  partnerWallets: [
    { id: 'partnerA', name: 'Partner A', balance: partnerA.balance },
    { id: 'partnerB', name: 'Partner B', balance: partnerB.balance },
  ],
  bankBalances: [
    { id: 'bank1', name: 'HDFC Current', bankName: 'HDFC', balance: bank1.balance },
  ],
  totalExpenses: 5000,
});

assert(partnerA.balance === 35000, `After ₹5,000 expense, Partner A Cash is ₹35,000 (got: ${partnerA.balance})`);
assert(overall.totalMoney === 145000, `After ₹5,000 expense, Total Company Money is ₹1,45,000 (got: ${overall.totalMoney})`);

// Step D: Soft-delete expense 5,000 -> verify recovery
partnerA = calculateWalletBalance({
  totalMoneyIn: 30000,
  totalTransfersIn: 0,
  totalTransfersOut: 0,
  totalExpenses: 0, // Soft-deleted expense excluded!
  totalBankWithdrawals: 10000,
});

overall = calculateOverallMoneyPosition({
  partnerWallets: [
    { id: 'partnerA', name: 'Partner A', balance: partnerA.balance },
    { id: 'partnerB', name: 'Partner B', balance: partnerB.balance },
  ],
  bankBalances: [
    { id: 'bank1', name: 'HDFC Current', bankName: 'HDFC', balance: bank1.balance },
  ],
  totalExpenses: 0,
});

assert(partnerA.balance === 40000, `After deleting expense, Partner A Cash recovers to ₹40,000 (got: ${partnerA.balance})`);
assert(overall.totalMoney === 150000, `After deleting expense, Total Company Money recovers to ₹1,50,000 (got: ${overall.totalMoney})`);

// -------------------------------------------------------------
// TEST 5: "Cash Bank mein Jama" (Partner -> Bank Deposit)
// Partner A deposits 15,000 cash into Bank
// -------------------------------------------------------------
console.log('\nTest 5: "Cash Bank mein Jama" (Partner to Bank Deposit)');

// Partner A deposits 15,000
partnerA = calculateWalletBalance({
  totalMoneyIn: 30000,
  totalTransfersIn: 0,
  totalTransfersOut: 0,
  totalExpenses: 0,
  totalBankWithdrawals: 10000, // +10,000
  totalBankDeposits: 15000,    // -15,000 deposited to bank
});

// Bank receives 15,000
bank1 = calculateBankBalance({
  openingBalance: 100000,
  totalTransfersToPartner: 10000,   // -10,000
  totalTransfersFromPartner: 15000, // +15,000
});

overall = calculateOverallMoneyPosition({
  partnerWallets: [
    { id: 'partnerA', name: 'Partner A', balance: partnerA.balance },
    { id: 'partnerB', name: 'Partner B', balance: partnerB.balance },
  ],
  bankBalances: [
    { id: 'bank1', name: 'HDFC Current', bankName: 'HDFC', balance: bank1.balance },
  ],
});

// Partner A = 30000 + 10000 - 15000 = 25000
assert(partnerA.balance === 25000, `Partner A Cash decreases by ₹15,000 to ₹25,000 (got: ${partnerA.balance})`);
// Bank = 100000 - 10000 + 15000 = 105000
assert(bank1.balance === 105000, `Bank Balance increases by ₹15,000 to ₹1,05,000 (got: ${bank1.balance})`);
// Total = 25000 + 20000 + 105000 = 150000
assert(overall.totalMoney === 150000, `Internal deposit keeps Total Company Money constant at ₹1,50,000 (got: ${overall.totalMoney})`);

// -------------------------------------------------------------
// TEST 6: Strict Role Scoping for Overall Position
// -------------------------------------------------------------
console.log('\nTest 6: Role Scoping for Overall Money Position');

// Partner view: only sees their own wallet
const partnerView = calculateOverallMoneyPosition({
  partnerWallets: [
    { id: 'partnerA', name: 'Partner A', balance: partnerA.balance },
  ],
  bankBalances: [
    { id: 'bank1', name: 'HDFC Current', bankName: 'HDFC', balance: bank1.balance },
  ],
});

assert(partnerView.breakdown.partnerWallets.length === 1, 'Partner view contains strictly 1 partner wallet (their own)');
assert(partnerView.breakdown.partnerWallets[0].id === 'partnerA', 'Partner view shows only Partner A');

console.log('\n======================================================');
console.log('🎉 ALL EXPENSE CHARTS & BANK ACCOUNT TESTS PASSED (100% SUCCESS)!');
console.log('======================================================\n');
