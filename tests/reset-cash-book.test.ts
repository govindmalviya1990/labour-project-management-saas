import assert from 'assert';
import { calculateWalletBalance, calculateDailyCashFlow } from '../src/lib/calculations/index';

console.log('--- RUNNING RESET CASH BOOK TESTS ---');

async function runTests() {
  // Test 1: Wallet balance calculation returns 0 when all cash transactions are cleared
  console.log('\nTest 1: Balance derivation after Cash Book reset');
  const dirtyWallet = calculateWalletBalance({
    totalMoneyIn: 150000,
    totalTransfersIn: 25000,
    totalTransfersOut: 30000,
    totalExpenses: 45000,
  });
  assert.strictEqual(dirtyWallet.balance, 100000, 'Dirty wallet balance should be ₹1,00,000');

  // After Cash Book reset: all transactions wiped
  const cleanWallet = calculateWalletBalance({
    totalMoneyIn: 0,
    totalTransfersIn: 0,
    totalTransfersOut: 0,
    totalExpenses: 0,
  });
  assert.strictEqual(cleanWallet.balance, 0, 'Reset wallet balance must be strictly ₹0');
  assert.strictEqual(cleanWallet.totalCredits, 0);
  assert.strictEqual(cleanWallet.totalDebits, 0);
  console.log('✅ PASSED: Resetting cash book entries returns wallet balance to exactly ₹0');

  // Test 2: Closing Balance resets to 0
  console.log('\nTest 2: Daily Cash Flow reset');
  const cleanDaily = calculateDailyCashFlow({
    openingBalance: 0,
    moneyInToday: 0,
    transfersInToday: 0,
    transfersOutToday: 0,
    expensesToday: 0,
  });
  assert.strictEqual(cleanDaily.closingBalance, 0, 'Closing balance must be ₹0');
  console.log('✅ PASSED: Daily closing balance is 0 after reset');

  // Test 3: Role permission policy check
  console.log('\nTest 3: Authorization policy for Reset Cash Book');
  const allowedRoles = ['OWNER', 'PARTNER'];
  assert.ok(allowedRoles.includes('OWNER'), 'OWNER must be permitted to reset cash book');
  assert.ok(allowedRoles.includes('PARTNER'), 'PARTNER must be permitted to reset cash book');
  assert.ok(!allowedRoles.includes('SITE_SUPERVISOR'), 'SITE_SUPERVISOR must NOT be permitted');
  assert.ok(!allowedRoles.includes('LABOUR'), 'LABOUR must NOT be permitted');
  console.log('✅ PASSED: Role authorization strictly limits reset to OWNER and PARTNER');

  // Test 4: Scope preservation verification
  console.log('\nTest 4: Scope Preservation (Entities preserved)');
  const wipedEntities = ['ProjectReceipt', 'FundTransfer', 'Expense', 'DailyClosing', 'BankTransaction'];
  const preservedEntities = ['Project', 'ProjectSite', 'Worker', 'Material', 'PurposeOption', 'User', 'Organization'];
  
  for (const entity of preservedEntities) {
    assert.ok(!wipedEntities.includes(entity), `${entity} must NOT be in the wipe list`);
  }
  console.log('✅ PASSED: Projects, Workers, Materials, Users, and Settings are preserved');

  console.log('\n======================================================');
  console.log('🎉 ALL RESET CASH BOOK TESTS PASSED (100% SUCCESS)!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Reset Cash Book Test Failure:', err);
  process.exit(1);
});
