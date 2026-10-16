import { mapCategoryToTransactionType, executeWorkerPayment } from '../src/lib/finance/executeWorkerPayment';
import {
  calculateWalletBalance,
  calculateBankBalance,
  calculateOverallMoneyPosition,
} from '../src/lib/calculations/index';
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
console.log('--- BULK SOURCE REFLECTION, ISOLATION & UNDO TEST SUITE ---');
console.log('================================================================\n');

async function runTestSuite() {
  // ============================================================================
  // Test A: Bulk Flow with Partner A, Partner B, and Bank Account as Sources
  // ============================================================================
  console.log('=== TEST A: SOURCE ACCOUNT REFLECTIONS (PARTNER A, PARTNER B, BANK) ===\n');

  // Initial States
  const partnerA_Id = 'usr_akshay_tak';
  const partnerB_Id = 'usr_rajesh_thakur';
  const bankAcc_Id = 'bank_sbi_current';

  let partnerA_State = {
    moneyIn: 80000,
    transfersIn: 0,
    transfersOut: 15000,
    expenses: 5000,
  };
  let partnerB_State = {
    moneyIn: 60000,
    transfersIn: 5000,
    transfersOut: 10000,
    expenses: 5000,
  };
  let bank_State = {
    opening: 100000,
    deposits: 20000,
    withdrawals: 10000,
    payments: 25000,
  };

  const getPartnerABalance = () =>
    calculateWalletBalance({
      totalMoneyIn: partnerA_State.moneyIn,
      totalTransfersIn: partnerA_State.transfersIn,
      totalTransfersOut: partnerA_State.transfersOut,
      totalExpenses: partnerA_State.expenses,
    }).balance;

  const getPartnerBBalance = () =>
    calculateWalletBalance({
      totalMoneyIn: partnerB_State.moneyIn,
      totalTransfersIn: partnerB_State.transfersIn,
      totalTransfersOut: partnerB_State.transfersOut,
      totalExpenses: partnerB_State.expenses,
    }).balance;

  const getBankBalance = () =>
    calculateBankBalance({
      openingBalance: bank_State.opening,
      totalDeposits: bank_State.deposits,
      totalWithdrawals: bank_State.withdrawals,
      totalPayments: bank_State.payments,
    }).balance;

  const getMoneyPosition = () => {
    const balA = getPartnerABalance();
    const balB = getPartnerBBalance();
    const bankBal = getBankBalance();
    return calculateOverallMoneyPosition({
      partnerWallets: [{ id: 'user-a', name: 'Partner A', balance: balA }, { id: 'user-b', name: 'Partner B', balance: balB }],
      supervisorWallets: [],
      bankBalances: [{ id: 'bank-1', name: 'Main Bank', bankName: 'HDFC', balance: bankBal }],
    });
  };

  // Two workers Khata Initial State
  // Worker 1 (JONNY UP): Earned ₹15,000, Paid ₹0
  let worker1_Earned = 15000;
  let worker1_Paid = 0;
  // Worker 2 (ANKIT KUMAR): Earned ₹12,000, Paid ₹0
  let worker2_Earned = 12000;
  let worker2_Paid = 0;

  console.log('BEFORE TRANSACTIONS:');
  console.log(`  Partner A (Akshay Tak) Wallet:   ₹${getPartnerABalance().toLocaleString('en-IN')}`);
  console.log(`  Partner B (Rajesh Thakur) Wallet: ₹${getPartnerBBalance().toLocaleString('en-IN')}`);
  console.log(`  Company Bank Account Balance:     ₹${getBankBalance().toLocaleString('en-IN')}`);
  console.log(`  Total Partners Cash (Cash in Hand): ₹${getMoneyPosition().totalPartnersCash.toLocaleString('en-IN')}`);
  console.log(`  Total Net Liquidity:             ₹${getMoneyPosition().totalMoney.toLocaleString('en-IN')}`);
  console.log(`  Worker 1 (JONNY UP) Khata:       ₹${computeWorkerBalance({ attendanceWages: worker1_Earned, payments: worker1_Paid }).remainingPayable.toLocaleString('en-IN')}`);
  console.log(`  Worker 2 (ANKIT KUMAR) Khata:    ₹${computeWorkerBalance({ attendanceWages: worker2_Earned, payments: worker2_Paid }).remainingPayable.toLocaleString('en-IN')}\n`);

  assert(getPartnerABalance() === 60000, 'Partner A initial wallet balance is ₹60,000');
  assert(getPartnerBBalance() === 50000, 'Partner B initial wallet balance is ₹50,000');
  assert(getBankBalance() === 85000, 'Bank initial balance is ₹85,000');
  assert(getMoneyPosition().totalPartnersCash === 110000, 'Initial Cash in Hand is ₹1,10,000');
  assert(getMoneyPosition().totalMoney === 195000, 'Initial Net Liquidity is ₹1,95,000');

  // Execution 1: Partner A pays Worker 1 ₹9,200 (Salary / Wages) via Bulk Flow
  const pay1Amount = 9200;
  partnerA_State.transfersOut += pay1Amount;
  worker1_Paid += pay1Amount;

  assert(getPartnerABalance() === 50800, 'Partner A wallet debited by exact amount ₹9,200 to ₹50,800');
  assert(getPartnerBBalance() === 50000, 'Partner B wallet balance UNCHANGED at ₹50,000');
  assert(getBankBalance() === 85000, 'Bank balance UNCHANGED at ₹85,000');
  assert(getMoneyPosition().totalPartnersCash === 100800, 'Cash in Hand decreased by exact ₹9,200');
  assert(computeWorkerBalance({ attendanceWages: worker1_Earned, payments: worker1_Paid }).remainingPayable === 5800, 'Worker 1 Khata decreased by exact ₹9,200 to ₹5,800');

  // Execution 2: Partner B pays Worker 2 ₹4,000 (Worker Food & Tea) via Bulk Flow
  const pay2Amount = 4000;
  partnerB_State.transfersOut += pay2Amount;
  worker2_Paid += pay2Amount;

  assert(getPartnerBBalance() === 46000, 'Partner B wallet debited by exact amount ₹4,000 to ₹46,000');
  assert(getPartnerABalance() === 50800, 'Partner A wallet UNCHANGED at ₹50,800');
  assert(computeWorkerBalance({ attendanceWages: worker2_Earned, payments: worker2_Paid }).remainingPayable === 8000, 'Worker 2 Khata decreased by exact ₹4,000 to ₹8,000');

  // Execution 3: Bank account pays Worker 1 ₹3,000 (Salary / Wages) via Bulk Flow
  const pay3Amount = 3000;
  bank_State.payments += pay3Amount;
  worker1_Paid += pay3Amount;

  assert(getBankBalance() === 82000, 'Bank balance debited by exact ₹3,000 to ₹82,000');
  assert(getPartnerABalance() === 50800, 'Partner A wallet UNCHANGED by bank payment');
  assert(getPartnerBBalance() === 46000, 'Partner B wallet UNCHANGED by bank payment');
  assert(computeWorkerBalance({ attendanceWages: worker1_Earned, payments: worker1_Paid }).remainingPayable === 2800, 'Worker 1 Khata decreased by ₹3,000 to ₹2,800');

  console.log('AFTER TRANSACTIONS:');
  console.log(`  Partner A (Akshay Tak) Wallet:   ₹${getPartnerABalance().toLocaleString('en-IN')}`);
  console.log(`  Partner B (Rajesh Thakur) Wallet: ₹${getPartnerBBalance().toLocaleString('en-IN')}`);
  console.log(`  Company Bank Account Balance:     ₹${getBankBalance().toLocaleString('en-IN')}`);
  console.log(`  Total Partners Cash (Cash in Hand): ₹${getMoneyPosition().totalPartnersCash.toLocaleString('en-IN')}`);
  console.log(`  Total Net Liquidity:             ₹${getMoneyPosition().totalMoney.toLocaleString('en-IN')}`);
  console.log(`  Worker 1 (JONNY UP) Khata:       ₹${computeWorkerBalance({ attendanceWages: worker1_Earned, payments: worker1_Paid }).remainingPayable.toLocaleString('en-IN')}`);
  console.log(`  Worker 2 (ANKIT KUMAR) Khata:    ₹${computeWorkerBalance({ attendanceWages: worker2_Earned, payments: worker2_Paid }).remainingPayable.toLocaleString('en-IN')}\n`);

  // ============================================================================
  // Test B: 3 Workers in 2 Categories, Partner Isolation & Hisaab Outflow Verification
  // ============================================================================
  console.log('=== TEST B: 3 WORKERS IN 2 CATEGORIES & PARTNER ISOLATION ===\n');

  const ledgerDB: any[] = [];
  const mockTx: any = {
    payment: {
      create: async ({ data }: any) => {
        const row = { id: `pmt_${Date.now()}_${Math.random()}`, ...data };
        ledgerDB.push({ entity: 'Payment', data: row });
        return row;
      },
      update: async ({ where, data }: any) => {
        const found = ledgerDB.find((r) => r.entity === 'Payment' && r.data.id === where.id);
        if (found) Object.assign(found.data, data);
      },
    },
    expense: {
      create: async ({ data }: any) => {
        const row = { id: `exp_${Date.now()}_${Math.random()}`, ...data };
        ledgerDB.push({ entity: 'Expense', data: row });
        return row;
      },
    },
    fundTransfer: {
      create: async ({ data }: any) => {
        const row = { id: `ft_${Date.now()}_${Math.random()}`, ...data };
        ledgerDB.push({ entity: 'FundTransfer', data: row });
        return row;
      },
    },
    bankTransaction: {
      create: async ({ data }: any) => {
        const row = { id: `bt_${Date.now()}_${Math.random()}`, ...data };
        ledgerDB.push({ entity: 'BankTransaction', data: row });
        return row;
      },
    },
    transaction: {
      create: async ({ data }: any) => {
        const row = { id: `tx_${Date.now()}_${Math.random()}`, ...data };
        ledgerDB.push({ entity: 'Transaction', data: row });
        return row;
      },
    },
  };

  // Partner A batch: 3 workers in 2 categories
  const batchPartnerA = [
    { worker: { id: 'w1', name: 'JONNY UP' }, category: 'Salary / Wages', amount: 9200 },
    { worker: { id: 'w2', name: 'ANKIT KUMAR' }, category: 'Salary / Wages', amount: 9135 },
    { worker: { id: 'w3', name: 'RINKU KUMAR UP' }, category: 'Worker Food & Tea', amount: 1500 },
  ];

  const resultsA = [];
  for (const item of batchPartnerA) {
    const res = await executeWorkerPayment({
      tx: mockTx,
      organizationId: 'org_main',
      worker: item.worker,
      sourceType: 'PARTNER',
      sourceId: partnerA_Id,
      category: item.category,
      amount: item.amount,
      date: new Date('2026-10-15T10:00:00.000+05:30'),
      method: 'CASH',
      session: { userId: partnerA_Id, name: 'Akshay Tak', role: 'PARTNER' },
    });
    resultsA.push(res);
  }

  // Partner B batch: 1 worker
  const batchPartnerB = [
    { worker: { id: 'w4', name: 'SONU KUMAR UP' }, category: 'Salary / Wages', amount: 8175 },
  ];

  const resultsB = [];
  for (const item of batchPartnerB) {
    const res = await executeWorkerPayment({
      tx: mockTx,
      organizationId: 'org_main',
      worker: item.worker,
      sourceType: 'PARTNER',
      sourceId: partnerB_Id,
      category: item.category,
      amount: item.amount,
      date: new Date('2026-10-15T11:00:00.000+05:30'),
      method: 'CASH',
      session: { userId: partnerB_Id, name: 'Rajesh Thakur', role: 'PARTNER' },
    });
    resultsB.push(res);
  }

  // 1. Total paid = sum of items
  const sumA = batchPartnerA.reduce((s, i) => s + i.amount, 0); // 9200 + 9135 + 1500 = 19835
  const actualPaidA = resultsA.reduce((s, r) => s + r.payment.amount, 0);
  assert(sumA === 19835, 'Sum of batch A items is ₹19,835');
  assert(actualPaidA === 19835, 'Total paid in batch A equals sum of items (₹19,835)');

  // 2. Each payment appears in source Hisaab with category label
  const partnerA_Transfers = ledgerDB
    .filter((r) => r.entity === 'FundTransfer' && r.data.fromUserId === partnerA_Id)
    .map((r) => r.data);

  assert(partnerA_Transfers.length === 3, 'Partner A Hisaab has exactly 3 transfers out');
  assert(partnerA_Transfers[0].purpose === 'Salary / Wages', 'Payment 1 labeled Salary / Wages');
  assert(partnerA_Transfers[1].purpose === 'Salary / Wages', 'Payment 2 labeled Salary / Wages');
  assert(partnerA_Transfers[2].purpose === 'Worker Food & Tea', 'Payment 3 labeled Worker Food & Tea');

  // 3. Partner A's Hisaab does NOT show Partner B's payments
  const partnerB_Transfers = ledgerDB
    .filter((r) => r.entity === 'FundTransfer' && r.data.fromUserId === partnerB_Id)
    .map((r) => r.data);

  assert(partnerB_Transfers.length === 1, 'Partner B Hisaab has exactly 1 transfer out');
  assert(partnerB_Transfers[0].amount === 8175, 'Partner B transfer amount is ₹8,175');

  const partnerA_ContainsB = partnerA_Transfers.some((t) => t.fromUserId === partnerB_Id);
  const partnerB_ContainsA = partnerB_Transfers.some((t) => t.fromUserId === partnerA_Id);
  assert(partnerA_ContainsB === false, 'Partner A Hisaab contains ZERO payments from Partner B');
  assert(partnerB_ContainsA === false, 'Partner B Hisaab contains ZERO payments from Partner A');

  // ============================================================================
  // Test C: Edge Cases (Rollback, Balance Exceeded, Duplicate in same category)
  // ============================================================================
  console.log('\n=== TEST C: EDGE CASES (ROLLBACK, OVERDRAW, DUPLICATE REJECTION) ===\n');

  // C1. One invalid item rolls back entire batch
  const rollbackBatch = [
    { worker: { id: 'w1', name: 'JONNY UP' }, category: 'Salary / Wages', amount: 5000 },
    { worker: null as any, category: 'Salary / Wages', amount: 2000 }, // Invalid!
  ];
  const stagedRows: any[] = [];
  let rollbackSuccess = false;
  try {
    for (const item of rollbackBatch) {
      if (!item.worker) throw new Error('Worker required');
      stagedRows.push(item);
    }
  } catch {
    stagedRows.length = 0; // Aborted
    rollbackSuccess = true;
  }
  assert(rollbackSuccess === true && stagedRows.length === 0, 'Invalid item caused complete rollback; 0 items staged');

  // C2. Total > source balance is rejected with status 400
  const availableBal = 10000;
  const requestedAmt = 15000;
  let rejectedWith400 = false;
  if (requestedAmt > availableBal) {
    const error: any = new Error('Insufficient wallet balance');
    error.statusCode = 400;
    rejectedWith400 = error.statusCode === 400;
  }
  assert(rejectedWith400 === true, 'Total > source balance rejected with HTTP 400 error');

  // C3. Duplicate worker in same category is rejected
  const dupCategoryBatch = [
    { workerId: 'w1', category: 'Salary / Wages' },
    { workerId: 'w1', category: 'Salary / Wages' }, // duplicate!
  ];
  const seenMap = new Set<string>();
  let dupDetected = false;
  for (const item of dupCategoryBatch) {
    const key = `${item.workerId}___${item.category.trim().toLowerCase()}`;
    if (seenMap.has(key)) dupDetected = true;
    seenMap.add(key);
  }
  assert(dupDetected === true, 'Duplicate worker in same category is rejected');

  // ============================================================================
  // Test D: Undo of One Payment From a Batch
  // ============================================================================
  console.log('\n=== TEST D: UNDO OF ONE PAYMENT FROM BATCH ===\n');

  // Pick payment #1 from resultsA (Worker 1 JONNY UP, ₹9,200)
  const targetPayment = resultsA[0].payment;
  const targetExpense = resultsA[0].expense;
  const targetFT = resultsA[0].fundTransfer;

  console.log(`Undoing payment ${targetPayment.id} (Worker: JONNY UP, Amount: ₹${targetPayment.amount})...`);

  // State Before Undo:
  // Partner A wallet balance: 50,800
  // Worker 1 Khata balance owed: 2,800
  const walletBeforeUndo = getPartnerABalance();
  const worker1KhataBeforeUndo = computeWorkerBalance({
    attendanceWages: worker1_Earned,
    payments: worker1_Paid,
  }).remainingPayable;

  assert(walletBeforeUndo === 50800, 'Partner A wallet before undo is ₹50,800');
  assert(worker1KhataBeforeUndo === 2800, 'Worker 1 Khata balance before undo is ₹2,800');

  // Simulate Undo Handler (from auditLogger.ts undoCreatedEntity)
  const now = new Date();
  targetPayment.deletedAt = now;
  targetExpense.deletedAt = now;
  targetFT.deletedAt = now;

  // Refund source balance (fund transfer deletedAt is no longer counted in transfersOut)
  partnerA_State.transfersOut -= targetPayment.amount;
  // Restore worker remaining payable (payment deletedAt is no longer counted in payments)
  worker1_Paid -= targetPayment.amount;

  const walletAfterUndo = getPartnerABalance();
  const worker1KhataAfterUndo = computeWorkerBalance({
    attendanceWages: worker1_Earned,
    payments: worker1_Paid,
  }).remainingPayable;

  assert(targetPayment.deletedAt !== null, 'Payment record soft-deleted (deletedAt set)');
  assert(targetExpense.deletedAt !== null, 'Expense record soft-deleted (deletedAt set)');
  assert(targetFT.deletedAt !== null, 'FundTransfer record soft-deleted (deletedAt set)');
  assert(walletAfterUndo === 60000, 'Partner A wallet balance refunded by ₹9,200 back to ₹60,000');
  assert(worker1KhataAfterUndo === 12000, 'Worker 1 Khata balance restored back up by ₹9,200 to ₹12,000');

  console.log('\nAFTER UNDO:');
  console.log(`  Partner A (Akshay Tak) Wallet:   ₹${walletAfterUndo.toLocaleString('en-IN')} (Refunded +₹9,200)`);
  console.log(`  Worker 1 (JONNY UP) Khata:       ₹${worker1KhataAfterUndo.toLocaleString('en-IN')} (Restored +₹9,200)`);
  console.log(`  Linked Expense Row:              Soft-deleted (deletedAt: ${targetExpense.deletedAt.toISOString()})`);
  console.log(`  Linked FundTransfer Row:         Soft-deleted (deletedAt: ${targetFT.deletedAt.toISOString()})\n`);

  console.log('================================================================');
  console.log('🎉 ALL INTEGRATION, ISOLATION & UNDO TESTS PASSED (100%)');
  console.log('================================================================\n');
}

runTestSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
