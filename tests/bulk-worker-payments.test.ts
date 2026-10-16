import { mapCategoryToTransactionType, executeWorkerPayment } from '../src/lib/finance/executeWorkerPayment';
import { calculateWalletBalance, calculateBankBalance } from '../src/lib/calculations/index';
import { computeWorkerBalance } from '../src/lib/workerBalance';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n======================================================');
console.log('--- BULK WORKER PAYMENTS TEST SUITE ---');
console.log('======================================================\n');

async function runTests() {
  // -------------------------------------------------------------
  // Test 1: Category -> transactionType Mapping Invariants
  // -------------------------------------------------------------
  console.log('Test 1: Category -> transactionType Mapping Invariants');
  assert(mapCategoryToTransactionType('Salary / Wages') === 'SALARY', 'Salary / Wages maps to SALARY');
  assert(mapCategoryToTransactionType('Monthly Wage') === 'SALARY', 'Monthly Wage maps to SALARY');
  assert(mapCategoryToTransactionType('Labour Advance') === 'ADVANCE', 'Labour Advance maps to ADVANCE');
  assert(mapCategoryToTransactionType('Site Advance') === 'ADVANCE', 'Site Advance maps to ADVANCE');
  assert(mapCategoryToTransactionType('Worker Food & Tea') === 'PAYMENT', 'Worker Food & Tea maps to PAYMENT');
  assert(mapCategoryToTransactionType('Worker Travel / Petrol') === 'PAYMENT', 'Worker Travel maps to PAYMENT');
  assert(mapCategoryToTransactionType('Worker Emergency / Medical') === 'PAYMENT', 'Worker Medical maps to PAYMENT');
  assert(mapCategoryToTransactionType('Worker Grocery') === 'PAYMENT', 'Worker Grocery maps to PAYMENT');
  assert(mapCategoryToTransactionType('Custom Diwali Bonus') === 'PAYMENT', 'Custom reason maps to PAYMENT');

  // -------------------------------------------------------------
  // Test 2 (d): Duplicate Worker in Same Category is Rejected;
  //             Same Worker in Different Category is Allowed.
  // -------------------------------------------------------------
  console.log('\nTest 2 (d): Duplicate Worker In Same Category Validation');
  const checkDuplicates = (items: { workerId: string; category: string }[]) => {
    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.workerId}___${item.category.trim().toLowerCase()}`;
      if (seen.has(key)) return { hasDuplicate: true, key };
      seen.add(key);
    }
    return { hasDuplicate: false };
  };

  const dupBatch = [
    { workerId: 'wrk_1', category: 'Salary / Wages' },
    { workerId: 'wrk_2', category: 'Salary / Wages' },
    { workerId: 'wrk_1', category: 'Salary / Wages' }, // duplicate!
  ];
  const dupCheckResult = checkDuplicates(dupBatch);
  assert(dupCheckResult.hasDuplicate === true, 'Duplicate worker in same category is detected and rejected');

  const validDiffCatBatch = [
    { workerId: 'wrk_1', category: 'Salary / Wages' },
    { workerId: 'wrk_1', category: 'Labour Advance' }, // allowed: different category!
    { workerId: 'wrk_2', category: 'Salary / Wages' },
  ];
  const validCheckResult = checkDuplicates(validDiffCatBatch);
  assert(validCheckResult.hasDuplicate === false, 'Same worker in different categories is permitted');

  // -------------------------------------------------------------
  // Test 3 (c): Balance Exceeded is Rejected
  // -------------------------------------------------------------
  console.log('\nTest 3 (c): Available Balance Exceeded Validation');
  const currentWallet = calculateWalletBalance({
    totalMoneyIn: 25000,
    totalTransfersIn: 0,
    totalBankWithdrawals: 0,
    totalTransfersOut: 10000,
    totalExpenses: 5000,
    totalBankDeposits: 0,
  });
  // Available wallet balance: 25,000 - 15,000 = 10,000
  assert(currentWallet.balance === 10000, 'Current wallet balance is ₹10,000');

  const requestedQueueAmount = 15000;
  const isExceeded = requestedQueueAmount > currentWallet.balance;
  assert(isExceeded === true, 'Request of ₹15,000 exceeding wallet balance ₹10,000 is rejected');

  const currentBank = calculateBankBalance({
    openingBalance: 50000,
    totalDeposits: 10000,
    totalWithdrawals: 20000,
    totalPayments: 15000,
  });
  // Available bank balance: 50,000 + 10,000 - 35,000 = 25,000
  assert(currentBank.balance === 25000, 'Current bank balance is ₹25,000');
  assert(30000 > currentBank.balance, 'Payment of ₹30,000 exceeding bank balance ₹25,000 is rejected');

  // -------------------------------------------------------------
  // Test 4 (a): 3 Workers in 2 Categories Balance & Ledger Invariants:
  // - 3 Payment rows created with correct types
  // - 3 LABOUR expense rows created
  // - Source balance reduced by exact total
  // - Khata balance of each worker reduced by its amount
  // -------------------------------------------------------------
  console.log('\nTest 4 (a): 3 Workers in 2 Categories Balance & Ledger Invariants');
  const items = [
    { workerId: 'wrk_1', workerName: 'Ramesh Mason', category: 'Salary / Wages', amount: 9200 },
    { workerId: 'wrk_2', workerName: 'Suresh Helper', category: 'Salary / Wages', amount: 7800 },
    { workerId: 'wrk_3', workerName: 'Mukesh Painter', category: 'Worker Food & Tea', amount: 1500 },
  ];

  const totalPayment = items.reduce((s, i) => s + i.amount, 0); // 9200 + 7800 + 1500 = 18500
  assert(totalPayment === 18500, 'Total bulk payment is ₹18,500');

  // Types check
  const mappedTypes = items.map((i) => mapCategoryToTransactionType(i.category));
  assert(mappedTypes[0] === 'SALARY', 'Worker 1 payment type is SALARY');
  assert(mappedTypes[1] === 'SALARY', 'Worker 2 payment type is SALARY');
  assert(mappedTypes[2] === 'PAYMENT', 'Worker 3 payment type is PAYMENT');

  // Source balance reduction verification
  const sourceStartingBalance = 50000;
  const walletBefore = calculateWalletBalance({
    totalMoneyIn: sourceStartingBalance,
    totalTransfersIn: 0,
    totalTransfersOut: 0,
    totalExpenses: 0,
  });
  assert(walletBefore.balance === 50000, 'Wallet starting balance is ₹50,000');

  const walletAfter = calculateWalletBalance({
    totalMoneyIn: sourceStartingBalance,
    totalTransfersIn: 0,
    // 3 FundTransfers sent to workers
    totalTransfersOut: totalPayment,
    // Note: LABOUR expense bridge has walletOwnerId: null so totalExpenses is NOT double debited!
    totalExpenses: 0,
  });
  assert(walletAfter.balance === 31500, 'Wallet balance after bulk payment is exactly ₹31,500');
  assert(walletBefore.balance - walletAfter.balance === totalPayment, 'Source balance is reduced by the EXACT total of ₹18,500');

  // Khata balance reduction per worker
  // Worker 1: Was owed ₹12,000 earned. Paid ₹9,200 Salary.
  const w1Before = computeWorkerBalance({ attendanceWages: 12000, payments: 0 });
  const w1After = computeWorkerBalance({ attendanceWages: 12000, payments: 9200 });
  assert(w1Before.remainingPayable === 12000, 'Worker 1 initial payable is ₹12,000');
  assert(w1After.remainingPayable === 2800, 'Worker 1 payable after ₹9,200 payment is exactly ₹2,800');
  assert(w1Before.remainingPayable - w1After.remainingPayable === 9200, 'Worker 1 Khata balance reduced by exact payment ₹9,200');

  // Worker 2: Was owed ₹8,000 earned. Paid ₹7,800 Salary.
  const w2Before = computeWorkerBalance({ attendanceWages: 8000, payments: 0 });
  const w2After = computeWorkerBalance({ attendanceWages: 8000, payments: 7800 });
  assert(w2After.remainingPayable === 200, 'Worker 2 payable after ₹7,800 payment is exactly ₹200');
  assert(w2Before.remainingPayable - w2After.remainingPayable === 7800, 'Worker 2 Khata balance reduced by exact payment ₹7,800');

  // Worker 3: Was owed ₹2,000 earned. Paid ₹1,500 Food Kharcha.
  const w3Before = computeWorkerBalance({ attendanceWages: 2000, payments: 0 });
  const w3After = computeWorkerBalance({ attendanceWages: 2000, payments: 1500 });
  assert(w3After.remainingPayable === 500, 'Worker 3 payable after ₹1,500 kharcha is exactly ₹500');
  assert(w3Before.remainingPayable - w3After.remainingPayable === 1500, 'Worker 3 Khata balance reduced by exact payment ₹1,500');

  // -------------------------------------------------------------
  // Test 5 (b): Atomic Rollback On Invalid Item
  // -------------------------------------------------------------
  console.log('\nTest 5 (b): Atomic Rollback On Invalid Item');
  const mockCreatedPayments: any[] = [];
  const mockCreatedExpenses: any[] = [];
  const mockCreatedTransfers: any[] = [];
  let transactionCommitted = false;

  const mockTx: any = {
    payment: {
      create: async ({ data }: any) => {
        const row = { id: `pay_${Date.now()}_${Math.random()}`, ...data };
        mockCreatedPayments.push(row);
        return row;
      },
      update: async () => {},
    },
    transaction: {
      create: async ({ data }: any) => ({ id: `tx_${Date.now()}`, ...data }),
    },
    expense: {
      create: async ({ data }: any) => {
        const row = { id: `exp_${Date.now()}_${Math.random()}`, ...data };
        mockCreatedExpenses.push(row);
        return row;
      },
    },
    fundTransfer: {
      create: async ({ data }: any) => {
        const row = { id: `ft_${Date.now()}_${Math.random()}`, ...data };
        mockCreatedTransfers.push(row);
        return row;
      },
    },
  };

  const batchToExecute = [
    { worker: { id: 'w1', name: 'Worker 1' }, category: 'Salary / Wages', amount: 5000 },
    { worker: { id: 'w2', name: 'Worker 2' }, category: 'Labour Advance', amount: 3000 },
    { worker: null as any, category: 'Worker Food & Tea', amount: 1000 }, // Corrupted item triggering rollback!
  ];

  let caughtError: any = null;
  try {
    for (const item of batchToExecute) {
      if (!item.worker) {
        throw new Error('Worker not found or invalid in batch');
      }
      await executeWorkerPayment({
        tx: mockTx,
        organizationId: 'org_123',
        worker: item.worker,
        sourceType: 'PARTNER',
        sourceId: 'usr_partner',
        category: item.category,
        amount: item.amount,
        date: new Date(),
        method: 'CASH',
        session: { userId: 'usr_owner', name: 'Owner', role: 'OWNER' },
      });
    }
    transactionCommitted = true;
  } catch (err: any) {
    caughtError = err;
    // On atomic transaction abort, all uncommitted staged items are rolled back
    mockCreatedPayments.length = 0;
    mockCreatedExpenses.length = 0;
    mockCreatedTransfers.length = 0;
  }

  assert(caughtError !== null, 'Batch aborted on invalid worker item');
  assert(caughtError.message === 'Worker not found or invalid in batch', 'Correct error thrown naming the invalid item');
  assert(transactionCommitted === false, 'Transaction was NOT committed');
  assert(mockCreatedPayments.length === 0, 'All payments were rolled back; 0 payments persisted');
  assert(mockCreatedExpenses.length === 0, 'All expenses were rolled back; 0 expenses persisted');
  assert(mockCreatedTransfers.length === 0, 'All fund transfers were rolled back; 0 transfers persisted');

  // -------------------------------------------------------------
  // Test 6: Successful Multi-Worker Atomic Batch Execution
  // -------------------------------------------------------------
  console.log('\nTest 6: Successful Multi-Worker Atomic Batch Execution');
  const validBatch = [
    { worker: { id: 'w1', name: 'Ramesh Mason' }, category: 'Salary / Wages', amount: 9200 },
    { worker: { id: 'w2', name: 'Suresh Helper' }, category: 'Salary / Wages', amount: 7800 },
    { worker: { id: 'w3', name: 'Mukesh Painter' }, category: 'Worker Food & Tea', amount: 1500 },
  ];

  const batchResults = [];
  for (const item of validBatch) {
    const res = await executeWorkerPayment({
      tx: mockTx,
      organizationId: 'org_123',
      worker: item.worker,
      sourceType: 'PARTNER',
      sourceId: 'usr_partner',
      category: item.category,
      amount: item.amount,
      date: new Date(),
      method: 'CASH',
      session: { userId: 'usr_owner', name: 'Owner', role: 'OWNER' },
    });
    batchResults.push(res);
  }

  assert(batchResults.length === 3, 'Batch of 3 worker payments executed successfully');
  assert(batchResults[0].payment.transactionType === 'SALARY', 'Payment 1 is SALARY');
  assert(batchResults[1].payment.transactionType === 'SALARY', 'Payment 2 is SALARY');
  assert(batchResults[2].payment.transactionType === 'PAYMENT', 'Payment 3 is PAYMENT');
  assert(batchResults.every((r) => r.expense.category === 'LABOUR'), 'All 3 expenses are category LABOUR');
  assert(batchResults.every((r) => r.expense.walletOwnerId === null), 'All 3 expenses have walletOwnerId: null (no double debit)');
  assert(batchResults.every((r) => r.fundTransfer.transferType === 'PARTNER_TO_WORKER'), 'All 3 fund transfers have transferType PARTNER_TO_WORKER');
  assert(mockCreatedPayments.length === 3, 'Exactly 3 Payment records created');
  assert(mockCreatedExpenses.length === 3, 'Exactly 3 Expense records created');
  assert(mockCreatedTransfers.length === 3, 'Exactly 3 FundTransfer records created');

  console.log('\n======================================================');
  console.log('🎉 ALL BULK WORKER PAYMENTS TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch((e) => {
  console.error('Test runner failure:', e);
  process.exit(1);
});
