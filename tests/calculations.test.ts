import {
  formatINR,
  calculateSalary,
  calculateWorkerBalance,
  calculateMaterialStock,
  calculateProjectCost,
  calculateCostPerUnit,
  calculateProductivity,
} from '../src/lib/calculations/index.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- STARTING CALCULATION ENGINE TESTS ---');

// 1. Currency Formatting
console.log('\nTesting formatINR:');
assert(formatINR(125000) === '₹1,25,000', `formatINR(125000) should be ₹1,25,000 (got: ${formatINR(125000)})`);
assert(formatINR(0) === '₹0', `formatINR(0) should be ₹0 (got: ${formatINR(0)})`);
assert(formatINR(-5000) === '-₹5,000', `formatINR(-5000) should be -₹5,000 (got: ${formatINR(-5000)})`);
assert(formatINR(NaN) === '₹0', 'formatINR(NaN) should handle safely');

// 2. Section 66: Worker Salary Calculation Example
console.log('\nTesting Section 66 (Worker Ramesh Salary Calculation):');
const salaryResult = calculateSalary({
  dailyWage: 800,
  presentDays: 20,
  halfDays: 2,
});
assert(salaryResult.fullDaySalary === 16000, `Full day salary should be 16000 (got: ${salaryResult.fullDaySalary})`);
assert(salaryResult.halfDaySalary === 800, `Half day salary should be 800 (got: ${salaryResult.halfDaySalary})`);
assert(salaryResult.grossSalary === 16800, `Gross salary should be 16800 (got: ${salaryResult.grossSalary})`);

// 3. Section 66: Worker Ledger / Balance
console.log('\nTesting Section 66 (Worker Ledger & Balance):');
const balanceResult = calculateWorkerBalance({
  totalEarnedSalary: 16800,
  totalAllowances: 1000,
  totalAdvances: 3000,
  totalPayments: 10000,
});
assert(balanceResult.totalCredits === 17800, `Total credits should be 17800 (got: ${balanceResult.totalCredits})`);
assert(balanceResult.totalDebits === 13000, `Total debits should be 13000 (got: ${balanceResult.totalDebits})`);
assert(balanceResult.remainingPayable === 4800, `Remaining payable should be 4800 (got: ${balanceResult.remainingPayable})`);
assert(balanceResult.paymentStatus === 'PARTIALLY_PAID', `Status should be PARTIALLY_PAID`);

// 4. Section 67: Material Inventory & Stock Example
console.log('\nTesting Section 67 (Material Stock & Transfer):');
const stock1 = calculateMaterialStock({
  openingStock: 100,
  totalReceived: 200,
  totalUsed: 150,
  minimumStock: 50,
  purchaseRate: 350,
});
assert(stock1.remainingStock === 150, `Remaining stock should be 150 (got: ${stock1.remainingStock})`);
assert(stock1.stockValue === 52500, `Stock value should be 52500 (got: ${stock1.stockValue})`);
assert(!stock1.isLowStock, '150 is above minimum 50, should not be low stock');

// Transfer 50 bags out to another project
const stock2 = calculateMaterialStock({
  openingStock: 100,
  totalReceived: 200,
  totalUsed: 150,
  transfersOut: 50,
  minimumStock: 120,
  purchaseRate: 350,
});
assert(stock2.remainingStock === 100, `Remaining stock after transfer should be 100 (got: ${stock2.remainingStock})`);
assert(stock2.isLowStock, '100 is <= minimum 120, should flag low stock');

// 5. Section 65: Project Cost, Budget & Profit/Loss Example
console.log('\nTesting Section 65 (Project Financials & Profit Margin):');
const projectResult = calculateProjectCost({
  projectValue: 5000000,
  estimatedLabourCost: 1000000,
  estimatedMaterialCost: 2000000,
  estimatedOtherExpense: 500000,
  labourCost: 1100000,
  materialCost: 2100000,
  otherExpenses: 400000,
});
assert(projectResult.estimatedTotalCost === 3500000, `Estimated cost should be 3500000 (got: ${projectResult.estimatedTotalCost})`);
assert(projectResult.estimatedProfit === 1500000, `Estimated profit should be 1500000 (got: ${projectResult.estimatedProfit})`);
assert(projectResult.actualTotalCost === 3600000, `Actual total cost should be 3600000 (got: ${projectResult.actualTotalCost})`);
assert(projectResult.actualProfit === 1400000, `Actual profit should be 1400000 (got: ${projectResult.actualProfit})`);
assert(projectResult.profitMarginPercentage === 28, `Profit margin should be 28% (got: ${projectResult.profitMarginPercentage}%)`);
assert(projectResult.isBudgetExceeded === true, 'Actual 36L > Estimated 35L, budget is exceeded');

// 6. Section 68: Cost Per Sq.Ft. Breakdown
console.log('\nTesting Section 68 (Cost per Sq.Ft.):');
const sqftResult = calculateCostPerUnit({
  completedQuantity: 25000,
  totalLabourCost: 800000,
  totalMaterialCost: 1400000,
  totalOtherCost: 300000,
  unitName: 'sq.ft.',
});
assert(sqftResult.totalCostPerUnit === 100, `Total cost/sq.ft. should be 100 (got: ${sqftResult.totalCostPerUnit})`);
assert(sqftResult.labourCostPerUnit === 32, `Labour cost/sq.ft. should be 32 (got: ${sqftResult.labourCostPerUnit})`);
assert(sqftResult.materialCostPerUnit === 56, `Material cost/sq.ft. should be 56 (got: ${sqftResult.materialCostPerUnit})`);
assert(sqftResult.otherCostPerUnit === 12, `Other cost/sq.ft. should be 12 (got: ${sqftResult.otherCostPerUnit})`);

// 7. Productivity Calculation
console.log('\nTesting Productivity:');
const prodResult = calculateProductivity({
  totalQuantity: 900,
  daysWorked: 4,
  totalWorkValue: 5400,
});
assert(prodResult.averageQuantityPerDay === 225, `Average per day should be 225 (got: ${prodResult.averageQuantityPerDay})`);
assert(prodResult.costPerUnit === 6, `Cost per unit should be 6 (got: ${prodResult.costPerUnit})`);

console.log('\n🎉 ALL 18 CALCULATION TESTS PASSED ACCURATELY!\n');
