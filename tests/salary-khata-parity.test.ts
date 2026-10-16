import { computeWorkerBalance } from '../src/lib/workerBalance';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n================================================================');
console.log('--- SALARY vs KHATA BALANCE PARITY & CARRY-FORWARD TEST SUITE ---');
console.log('================================================================\n');

// -------------------------------------------------------------
// Test Case 1: RINKU KUMAR UP (WRK-565)
// Prior month (Sep 2026): Earned ₹11,825, Paid ₹0 -> Dues carried = ₹11,825
// Current month (Oct 2026): Earned ₹0, Paid ₹7,825
// -------------------------------------------------------------
console.log('Test 1: RINKU KUMAR UP (Prior dues settled partially)');
{
  const priorBalance = 11825;
  const currentEarned = 0;
  const currentAllowances = 0;
  const currentAdvances = 0;
  const currentPaid = 7825;

  // Salary Formula
  const grossSalary = currentEarned + currentAllowances;
  const salaryBalance = priorBalance + grossSalary - currentAdvances - currentPaid;
  const salaryNetPayable = Math.max(0, salaryBalance);
  const salaryAdvanceDue = Math.max(0, -salaryBalance);

  // Khata All-Time Formula
  const khata = computeWorkerBalance({
    attendanceWages: 11825 + currentEarned,
    allowances: 0,
    advances: 0,
    payments: currentPaid,
  });

  console.log(`  Salary Balance: ₹${salaryBalance} (Net Payable: ₹${salaryNetPayable}, Advance Due: ₹${salaryAdvanceDue})`);
  console.log(`  Khata Remaining Payable: ₹${khata.remainingPayable} (Status: ${khata.paymentStatus})`);

  assert(salaryBalance === khata.remainingPayable, 'Salary balance equals Khata remainingPayable');
  assert(salaryBalance === 4000, 'Rinku balance is exactly ₹4,000 due');
  assert(salaryAdvanceDue === 0, 'Advance due is ₹0 (NOT ₹7,825)');
}

// -------------------------------------------------------------
// Test Case 2: SONU KUMAR UP (WRK-157)
// Prior month (Sep 2026): Earned ₹10,175, Paid ₹0 -> Dues carried = ₹10,175
// Current month (Oct 2026): Earned ₹0, Paid ₹12,175 (₹8,175 + ₹2,000 + ₹2,000)
// -------------------------------------------------------------
console.log('\nTest 2: SONU KUMAR UP (Prior dues settled + excess ₹2,000 payout)');
{
  const priorBalance = 10175;
  const currentEarned = 0;
  const currentAllowances = 0;
  const currentAdvances = 0;
  const currentPaid = 12175;

  const grossSalary = currentEarned + currentAllowances;
  const salaryBalance = priorBalance + grossSalary - currentAdvances - currentPaid;
  const salaryNetPayable = Math.max(0, salaryBalance);
  const salaryAdvanceDue = Math.max(0, -salaryBalance);

  const khata = computeWorkerBalance({
    attendanceWages: 10175 + currentEarned,
    allowances: 0,
    advances: 0,
    payments: currentPaid,
  });

  console.log(`  Salary Balance: ₹${salaryBalance} (Net Payable: ₹${salaryNetPayable}, Advance Due: ₹${salaryAdvanceDue})`);
  console.log(`  Khata Remaining Payable: ₹${khata.remainingPayable} (Status: ${khata.paymentStatus})`);

  assert(salaryBalance === khata.remainingPayable, 'Salary balance equals Khata remainingPayable');
  assert(salaryBalance === -2000, 'Sonu balance is exactly -₹2,000');
  assert(salaryAdvanceDue === 2000, 'Advance due is ₹2,000 (NOT ₹12,175)');
}

// -------------------------------------------------------------
// Test Case 3: KALLU UP (WRK-477)
// Prior month: ₹0
// Current month (Oct 2026): Earned ₹15,900, Paid ₹5,900
// -------------------------------------------------------------
console.log('\nTest 3: KALLU UP (Current month attendance + partial payout)');
{
  const priorBalance = 0;
  const currentEarned = 15900;
  const currentPaid = 5900;

  const salaryBalance = priorBalance + currentEarned - currentPaid;
  const khata = computeWorkerBalance({
    attendanceWages: currentEarned,
    payments: currentPaid,
  });

  assert(salaryBalance === khata.remainingPayable, 'Salary balance equals Khata remainingPayable');
  assert(salaryBalance === 10000, 'Kallu balance is exactly ₹10,000');
}

// -------------------------------------------------------------
// Test Case 4: JONNY UP (WRK-313)
// Prior month: ₹0
// Current month: Earned ₹0, Paid ₹9,200
// -------------------------------------------------------------
console.log('\nTest 4: JONNY UP (No attendance, payment ₹9,200)');
{
  const priorBalance = 0;
  const currentEarned = 0;
  const currentPaid = 9200;

  const salaryBalance = priorBalance + currentEarned - currentPaid;
  const khata = computeWorkerBalance({
    attendanceWages: 0,
    payments: currentPaid,
  });

  assert(salaryBalance === khata.remainingPayable, 'Salary balance equals Khata remainingPayable');
  assert(salaryBalance === -9200, 'Jonny balance is -₹9,200');
}

// -------------------------------------------------------------
// Test Case 5: Piece-Rate Work Records Integration
// Worker earns ₹3,500 attendance + ₹4,200 piece-rate + ₹500 allowance - ₹2,000 advance - ₹4,000 salary
// -------------------------------------------------------------
console.log('\nTest 5: Piece-Rate Work + Attendance + Allowance + Advance + Payment');
{
  const attendanceWages = 3500;
  const pieceRateWages = 4200;
  const allowances = 500;
  const advances = 2000;
  const payments = 4000;

  const totalEarned = attendanceWages + pieceRateWages;
  const grossSalary = totalEarned + allowances;
  const salaryBalance = grossSalary - advances - payments;

  const khata = computeWorkerBalance({
    attendanceWages,
    pieceRateWages,
    allowances,
    advances,
    payments,
  });

  console.log(`  Gross Salary: ₹${grossSalary}, Paid/Adv: ₹${advances + payments}, Balance: ₹${salaryBalance}`);
  assert(salaryBalance === khata.remainingPayable, 'Salary balance matches Khata remainingPayable');
  assert(salaryBalance === 2200, 'Balance is exactly ₹2,200');
  assert(khata.grossCredits === 8200, 'Gross credits is ₹8,200');
  assert(khata.totalDebits === 6000, 'Total debits is ₹6,000');
}

// -------------------------------------------------------------
// Test Case 6: Worker with Non-Zero Positive Opening Balance (Dues)
// Worker has ₹5,000 opening dues from legacy book.
// Month 1: Earns ₹12,000 wages, paid ₹10,000
// Month 2: Earns ₹8,000 wages, paid ₹6,000
// -------------------------------------------------------------
console.log('\nTest 6: Non-Zero Opening Balance (₹5,000 Opening Dues) Across 2 Months');
{
  const openingBalance = 5000;

  // Month 1
  const m1Att = 12000;
  const m1Paid = 10000;
  // In month 1, prior period attendance/payments are 0, so:
  const m1PreviousBalance = openingBalance + 0 - 0;
  const m1SalaryBalance = m1PreviousBalance + m1Att - m1Paid; // 5000 + 12000 - 10000 = 7000

  // Month 2
  const m2Att = 8000;
  const m2Paid = 6000;
  // In month 2, prior period attendance is m1Att (12000), prior paid is m1Paid (10000)
  const m2PreviousBalance = openingBalance + m1Att - m1Paid; // 5000 + 12000 - 10000 = 7000
  const m2SalaryBalance = m2PreviousBalance + m2Att - m2Paid; // 7000 + 8000 - 6000 = 9000

  // Khata All-Time Calculation (includes openingBalance exactly once)
  const khata = computeWorkerBalance({
    openingBalance,
    attendanceWages: m1Att + m2Att, // 20000
    payments: m1Paid + m2Paid,      // 16000
  });

  console.log(`  Month 1 Salary Balance: ₹${m1SalaryBalance} (Prev: ₹${m1PreviousBalance})`);
  console.log(`  Month 2 Salary Balance: ₹${m2SalaryBalance} (Prev: ₹${m2PreviousBalance})`);
  console.log(`  Khata Remaining Payable: ₹${khata.remainingPayable} (Gross Credits: ₹${khata.grossCredits}, Debits: ₹${khata.totalDebits})`);

  assert(m2PreviousBalance === 7000, 'Month 2 previous dues carries forward Month 1 balance');
  assert(m2SalaryBalance === khata.remainingPayable, 'Salary balance matches Khata remainingPayable with opening balance');
  assert(khata.remainingPayable === 9000, 'Total remaining payable is exactly ₹9,000');
  assert(khata.grossCredits === 25000, 'Gross credits (5000 + 20000) is ₹25,000 (openingBalance included exactly once)');
}

// -------------------------------------------------------------
// Test Case 7: Worker with Negative Opening Balance (Advance Carried)
// Worker has -₹2,500 advance carried over from previous contractor/season.
// Month 1: Earns ₹10,000 wages, takes ₹2,000 advance
// -------------------------------------------------------------
console.log('\nTest 7: Negative Opening Balance (-₹2,500 Advance Carried)');
{
  const openingBalance = -2500;
  const m1Att = 10000;
  const m1Adv = 2000;

  const previousBalance = openingBalance;
  const salaryBalance = previousBalance + m1Att - m1Adv; // -2500 + 10000 - 2000 = 5500

  const khata = computeWorkerBalance({
    openingBalance,
    attendanceWages: m1Att,
    advances: m1Adv,
  });

  console.log(`  Salary Balance: ₹${salaryBalance} (Net Payable: ₹${Math.max(0, salaryBalance)})`);
  console.log(`  Khata Remaining Payable: ₹${khata.remainingPayable} (Status: ${khata.paymentStatus})`);

  assert(salaryBalance === khata.remainingPayable, 'Salary balance matches Khata remainingPayable with negative opening balance');
  assert(khata.remainingPayable === 5500, 'Worker is owed ₹5,500 after deducting opening advance');
}

console.log('\n================================================================');
console.log('ALL PARITY AND CALCULATION TESTS PASSED (100%)');
console.log('================================================================\n');
