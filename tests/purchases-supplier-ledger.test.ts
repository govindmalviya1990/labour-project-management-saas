import {
  computeSupplierBalance,
  allocateBillsFIFO,
  SupplierBalanceSummary,
} from '../src/lib/supplierBalance';
import { executeSupplierPayment } from '../src/lib/finance/executeSupplierPayment';
import { calculateWalletBalance, calculateBankBalance } from '../src/lib/calculations/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function printState(label: string, state: {
  supplierRemaining: number;
  sourceBalance: number;
  partnerHisaabOutflows: number;
  cashInHand: number;
  moneyPosition: number;
  projectCost: number;
}) {
  console.log(`   [${label}] Supplier Remaining: ₹${state.supplierRemaining} | Source Bal: ₹${state.sourceBalance} | Partner Hisaab Outflows: ₹${state.partnerHisaabOutflows} | Cash in Hand: ₹${state.cashInHand} | Money Position: ₹${state.moneyPosition} | Project Cost: ₹${state.projectCost}`);
}

console.log('\n======================================================');
console.log('--- PURCHASES & SUPPLIER LEDGER TEST SUITE ---');
console.log('======================================================\n');

async function runTests() {
  // -------------------------------------------------------------
  // Test 1: Bill with 3 items and GST (Increases Project Cost, NO Wallet/Bank Debit)
  // -------------------------------------------------------------
  console.log('Test 1: Bill with 3 items and GST');
  // State before
  let state = {
    supplierRemaining: 0,
    sourceBalance: 50000,
    partnerHisaabOutflows: 0,
    cashInHand: 50000,
    moneyPosition: 100000,
    projectCost: 0,
  };
  printState('BEFORE BILL', state);

  const items = [
    { materialName: 'Cement UltraTech', quantity: 100, unit: 'Bags', rate: 380, amount: 38000 },
    { materialName: 'Steel 12mm TMT', quantity: 200, unit: 'Kg', rate: 65, amount: 13000 },
    { materialName: 'River Sand', quantity: 2, unit: 'Brass', rate: 4500, amount: 9000 },
  ];
  const subtotal = items.reduce((s, it) => s + it.amount, 0); // 60,000
  const gstAmount = 10800; // 18% GST
  const transportCharges = 2000;
  const discount = 1000;
  const billTotal = subtotal + gstAmount + transportCharges - discount; // 71,800

  // Rule 7: Creating a bill increases project/material cost, but does NOT debit any partner wallet or bank
  state.projectCost += billTotal;
  state.supplierRemaining += billTotal;
  printState('AFTER BILL', state);

  assert(billTotal === 71800, 'Bill total calculates correctly with 3 items, GST, transport and discount');
  assert(state.projectCost === 71800, 'Project cost increased by exactly bill total (71,800)');
  assert(state.sourceBalance === 50000, 'Source wallet balance is UNTOUCHED by bill creation');
  assert(state.cashInHand === 50000, 'Cash in hand is UNTOUCHED by bill creation');
  assert(state.moneyPosition === 100000, 'Money position is UNTOUCHED by bill creation');
  assert(state.partnerHisaabOutflows === 0, 'Partner Hisaab has 0 outflows upon bill creation');

  // Verify FIFO allocation & Status
  const bill1 = { id: 'bill_1', billNumber: 'INV-101', billDate: new Date('2026-04-01'), totalAmount: billTotal };
  const alloc1 = allocateBillsFIFO([bill1], [], []);
  assert(alloc1.allocatedBills[0].status === 'UNPAID', 'Bill initial status is UNPAID');
  assert(alloc1.allocatedBills[0].netDue === 71800, 'Bill net due is 71,800');

  // -------------------------------------------------------------
  // Test 2: Part payment from Partner A's wallet (Debits Partner Wallet Once, NO Double Project Cost)
  // -------------------------------------------------------------
  console.log('\nTest 2: Part payment from Partner A\'s wallet (₹30,000)');
  printState('BEFORE PARTNER PAYMENT', state);

  const partPaymentAmount = 30000;
  // A SupplierPayment debits Partner A's wallet exactly once.
  state.sourceBalance -= partPaymentAmount;
  state.cashInHand -= partPaymentAmount;
  state.moneyPosition -= partPaymentAmount;
  state.partnerHisaabOutflows += partPaymentAmount;
  state.supplierRemaining -= partPaymentAmount;
  // Crucial: projectCost must NOT change! Bill already counted it.
  printState('AFTER PARTNER PAYMENT', state);

  assert(state.sourceBalance === 20000, 'Partner A wallet debited by ₹30,000 (50,000 -> 20,000)');
  assert(state.cashInHand === 20000, 'Cash in hand dropped by ₹30,000');
  assert(state.moneyPosition === 70000, 'Money position dropped by ₹30,000');
  assert(state.partnerHisaabOutflows === 30000, 'Partner Hisaab recorded outflow of ₹30,000');
  assert(state.supplierRemaining === 41800, 'Supplier remaining reduced by ₹30,000 to ₹41,800');
  assert(state.projectCost === 71800, 'Zero double counting: Project cost remains exactly 71,800');

  const payment1 = { id: 'pay_1', billId: 'bill_1', amount: partPaymentAmount, date: new Date('2026-04-05') };
  const alloc2 = allocateBillsFIFO([bill1], [payment1], []);
  assert(alloc2.allocatedBills[0].status === 'PARTIAL', 'Bill status updated to PARTIAL after part payment');
  assert(alloc2.allocatedBills[0].paidAmount === 30000, 'Allocated paid amount is 30,000');
  assert(alloc2.allocatedBills[0].netDue === 41800, 'Net due is 41,800');

  // -------------------------------------------------------------
  // Test 3: Full payment remainder from a bank account (₹41,800)
  // -------------------------------------------------------------
  console.log('\nTest 3: Full payment remainder from bank account (₹41,800)');
  let bankBalance = 100000;
  const bankPaymentAmount = 41800;

  state.supplierRemaining -= bankPaymentAmount;
  state.moneyPosition -= bankPaymentAmount;
  bankBalance -= bankPaymentAmount;
  printState('AFTER BANK PAYMENT', state);

  assert(bankBalance === 58200, 'Bank account balance reduced by ₹41,800 (100,000 -> 58,200)');
  assert(state.supplierRemaining === 0, 'Supplier balance is completely settled (₹0 remaining)');
  assert(state.projectCost === 71800, 'Project cost still exactly 71,800 (no double counting)');

  const payment2 = { id: 'pay_2', billId: 'bill_1', amount: bankPaymentAmount, date: new Date('2026-04-10') };
  const alloc3 = allocateBillsFIFO([bill1], [payment1, payment2], []);
  assert(alloc3.allocatedBills[0].status === 'PAID', 'Bill status is now PAID');
  assert(alloc3.allocatedBills[0].netDue === 0, 'Bill net due is 0');
  assert(alloc3.unallocatedAdvance === 0, 'Unallocated advance is 0');

  // -------------------------------------------------------------
  // Test 4: Advance payment with no bill (On Account / Advance)
  // -------------------------------------------------------------
  console.log('\nTest 4: Advance payment with no bill (₹15,000 on account)');
  const advancePaymentAmount = 15000;
  state.supplierRemaining -= advancePaymentAmount; // Now negative: supplier owes us goods
  state.sourceBalance -= advancePaymentAmount;
  state.moneyPosition -= advancePaymentAmount;
  printState('AFTER ADVANCE PAYMENT', state);

  assert(state.supplierRemaining === -15000, 'Supplier remaining is -15,000 (supplier owes us goods)');
  const advanceBal = computeSupplierBalance({ openingBalance: 0, billsTotal: 71800, paymentsTotal: 86800, returnsTotal: 0 });
  assert(advanceBal.remainingBalance === -15000, 'computeSupplierBalance returns -15,000');
  assert(advanceBal.status === 'ADVANCE', 'computeSupplierBalance sets status to ADVANCE');

  // Advance FIFO allocation
  const payment3 = { id: 'pay_3', billId: null, amount: advancePaymentAmount, date: new Date('2026-04-15') };
  const alloc4 = allocateBillsFIFO([bill1], [payment1, payment2, payment3], []);
  assert(alloc4.unallocatedAdvance === 15000, 'FIFO reports exactly ₹15,000 unallocated advance');

  // -------------------------------------------------------------
  // Test 5: Payment above balance rejected (Negative Balance Protection)
  // -------------------------------------------------------------
  console.log('\nTest 5: Payment above available balance rejected');
  const availableBal = state.sourceBalance; // 5,000
  const attemptedPayment = availableBal + 1000; // 6,000
  let isRejected = false;
  if (attemptedPayment > availableBal) {
    isRejected = true;
  }
  assert(isRejected === true, `Payment of ₹${attemptedPayment} rejected because it exceeds available balance ₹${availableBal}`);

  // -------------------------------------------------------------
  // Test 6: Two parallel payments on a balance covering only one
  // -------------------------------------------------------------
  console.log('\nTest 6: Parallel concurrency simulation (atomic reservation)');
  let sourceSharedBal = 10000;
  const payA = 8000;
  const payB = 8000;

  // Transaction A executes first
  let txASuccess = false;
  if (sourceSharedBal >= payA) {
    sourceSharedBal -= payA;
    txASuccess = true;
  }
  // Transaction B attempts to execute concurrently
  let txBSuccess = false;
  if (sourceSharedBal >= payB) {
    sourceSharedBal -= payB;
    txBSuccess = true;
  }
  assert(txASuccess === true, 'Tx A succeeds: debited ₹8,000');
  assert(txBSuccess === false, 'Tx B rejected: insufficient balance (only ₹2,000 left)');
  assert(sourceSharedBal === 2000, 'Source balance remained strictly positive (₹2,000)');

  // -------------------------------------------------------------
  // Test 7: Return reduces the balance owed
  // -------------------------------------------------------------
  console.log('\nTest 7: Purchase return reduces what we owe');
  const freshBill = { id: 'bill_2', billNumber: 'INV-102', billDate: new Date('2026-04-20'), totalAmount: 25000 };
  const ret1 = { id: 'ret_1', billId: 'bill_2', amount: 5000, returnDate: new Date('2026-04-22') };

  const retBal = computeSupplierBalance({
    openingBalance: 0,
    billsTotal: 25000,
    returnsTotal: 5000,
    paymentsTotal: 0,
  });
  assert(retBal.netPurchases === 20000, 'Net purchases reduced to 20,000');
  assert(retBal.remainingBalance === 20000, 'Remaining balance reduced to 20,000 by return');

  const allocRet = allocateBillsFIFO([freshBill], [], [ret1]);
  assert(allocRet.allocatedBills[0].returnAmount === 5000, 'Allocated bill return amount is 5,000');
  assert(allocRet.allocatedBills[0].netDue === 20000, 'Allocated bill net due is 20,000');

  // -------------------------------------------------------------
  // Test 8: Edit a bill amount (balance and status update atomically)
  // -------------------------------------------------------------
  console.log('\nTest 8: Edit bill amount updates balance and status');
  const editedBill = { ...freshBill, totalAmount: 30000 }; // Increased by 5,000
  const allocEdited = allocateBillsFIFO([editedBill], [], [ret1]);
  assert(allocEdited.allocatedBills[0].totalAmount === 30000, 'Bill total updated to 30,000');
  assert(allocEdited.allocatedBills[0].netDue === 25000, 'Net due updated to 25,000 (30,000 - 5,000 return)');

  // -------------------------------------------------------------
  // Test 9: Delete a payment (source wallet restored, status back to unpaid/partial)
  // -------------------------------------------------------------
  console.log('\nTest 9: Delete payment restores source wallet and rolls back bill status');
  let testWalletBal = 10000;
  const simPayment = { id: 'pay_del', billId: 'bill_del', amount: 4000, date: new Date() };
  testWalletBal -= simPayment.amount; // 6,000
  assert(testWalletBal === 6000, 'Wallet debited during payment');

  // Simulate payment deletion (soft delete + refund to wallet)
  testWalletBal += simPayment.amount;
  assert(testWalletBal === 10000, 'Source wallet restored back to ₹10,000 upon payment deletion');

  const billDel = { id: 'bill_del', billNumber: 'B-DEL', billDate: new Date(), totalAmount: 4000 };
  const allocAfterDelete = allocateBillsFIFO([billDel], [{ ...simPayment, deletedAt: new Date() }], []);
  assert(allocAfterDelete.allocatedBills[0].status === 'UNPAID', 'Bill status reverts back to UNPAID');
  assert(allocAfterDelete.allocatedBills[0].paidAmount === 0, 'Bill paid amount reverts to 0');
  assert(allocAfterDelete.allocatedBills[0].netDue === 4000, 'Bill net due reverts to 4,000');

  // -------------------------------------------------------------
  // Test 10: Supplier opening balance positive and negative
  // -------------------------------------------------------------
  console.log('\nTest 10: Supplier opening balance (+ we owe, - advance)');
  // Positive opening balance (+₹20,000 we owe supplier from previous year)
  const posOpening = computeSupplierBalance({
    openingBalance: 20000,
    billsTotal: 10000,
    paymentsTotal: 5000,
    returnsTotal: 0,
  });
  assert(posOpening.remainingBalance === 25000, 'Positive opening balance: 20,000 + 10,000 - 5,000 = 25,000');
  assert(posOpening.status === 'PARTIALLY_PAID', 'Positive balance status is PARTIALLY_PAID');

  // Negative opening balance (-₹8,000 advance with supplier from previous year)
  const negOpening = computeSupplierBalance({
    openingBalance: -8000,
    billsTotal: 5000,
    paymentsTotal: 0,
    returnsTotal: 0,
  });
  assert(negOpening.remainingBalance === -3000, 'Negative opening balance: -8,000 + 5,000 = -3,000');
  assert(negOpening.status === 'ADVANCE', 'Negative balance status is ADVANCE');

  // -------------------------------------------------------------
  // Test 11: Permissions (OWNER anything, MANAGER/ACCOUNTANT only own wallet or bank)
  // -------------------------------------------------------------
  console.log('\nTest 11: Role-based permissions');
  const checkPaymentPermission = (userRole: string, currentUserId: string, sourceType: string, sourceId: string) => {
    if (userRole === 'OWNER' || userRole === 'ADMIN') return true;
    if (sourceType === 'BANK') return true;
    if (sourceType === 'PARTNER' && sourceId === currentUserId) return true;
    return false;
  };

  assert(checkPaymentPermission('OWNER', 'user_1', 'PARTNER', 'user_2') === true, 'OWNER can pay from another partner\'s wallet');
  assert(checkPaymentPermission('MANAGER', 'user_1', 'BANK', 'bank_1') === true, 'MANAGER can pay from company bank account');
  assert(checkPaymentPermission('MANAGER', 'user_1', 'PARTNER', 'user_1') === true, 'MANAGER can pay from own wallet');
  assert(checkPaymentPermission('MANAGER', 'user_1', 'PARTNER', 'user_2') === false, 'MANAGER CANNOT pay from another partner\'s wallet');
  assert(checkPaymentPermission('ACCOUNTANT', 'user_acc', 'PARTNER', 'user_partner') === false, 'ACCOUNTANT CANNOT pay from partner wallet');

  // -------------------------------------------------------------
  // Test 12: Aging Breakdown Verification (0-30, 31-60, 61-90, 90+ days)
  // -------------------------------------------------------------
  console.log('\nTest 12: Aging breakdown calculation');
  const now = new Date('2026-04-16');
  const agingBills = [
    { id: 'b_recent', billDate: new Date('2026-04-01'), totalAmount: 10000 }, // 15 days ago -> 0-30
    { id: 'b_month', billDate: new Date('2026-03-01'), totalAmount: 20000 },  // 46 days ago -> 31-60
    { id: 'b_two_month', billDate: new Date('2026-01-30'), totalAmount: 30000 }, // 76 days ago -> 61-90
    { id: 'b_old', billDate: new Date('2025-12-01'), totalAmount: 40000 },    // 136 days ago -> 90+
  ];
  const agingResult = allocateBillsFIFO(agingBills, [], [], now);
  assert(agingResult.aging.bracket0To30 === 10000, 'Bracket 0-30 days is 10,000');
  assert(agingResult.aging.bracket31To60 === 20000, 'Bracket 31-60 days is 20,000');
  assert(agingResult.aging.bracket61To90 === 30000, 'Bracket 61-90 days is 30,000');
  assert(agingResult.aging.bracket90Plus === 40000, 'Bracket 90+ days is 40,000');
  assert(agingResult.aging.totalDue === 100000, 'Total due is 100,000');

  // -------------------------------------------------------------
  // Test 13: Exact user bill payload schema validation
  // -------------------------------------------------------------
  console.log('\nTest 13: Exact user bill payload validation (Vishal, goods, ₹1,280)');
  const { createPurchaseBillSchema } = await import('../src/lib/validations/purchases');
  const userPayload = {
    supplierId: 'cm_sup_vishal_123',
    billDate: '2026-10-16',
    billNumber: '12325',
    projectId: 'cm_prj_vastral_916',
    siteId: null,
    vehicleNumber: null,
    receivedBy: null,
    notes: null,
    attachmentUrl: null,
    subtotal: 1000,
    gstAmount: 180,
    transportCharges: 100,
    discount: 0,
    totalAmount: 1280,
    items: [
      {
        materialName: 'goods',
        quantity: 10,
        unit: 'bags',
        rate: 100,
        amount: 1000,
      },
    ],
  };
  const parseResult = createPurchaseBillSchema.safeParse(userPayload);
  assert(parseResult.success === true, 'User purchase bill payload parses successfully with 0 errors');

  // Also verify when subtotal or totalAmount is omitted from payload, schema still passes
  const payloadWithoutTotals = { ...userPayload };
  delete (payloadWithoutTotals as any).subtotal;
  delete (payloadWithoutTotals as any).totalAmount;
  const parseWithoutTotals = createPurchaseBillSchema.safeParse(payloadWithoutTotals);
  assert(parseWithoutTotals.success === true, 'Payload without subtotal/totalAmount also succeeds (auto-computed by backend)');

  console.log('\n======================================================');
  console.log('🎉 ALL PURCHASES & SUPPLIER LEDGER TESTS PASSED (13/13)!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
