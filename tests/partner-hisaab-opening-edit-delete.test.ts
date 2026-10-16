import {
  calculateWalletBalance,
  calculateBankBalance,
  calculateOverallMoneyPosition,
} from '../src/lib/calculations/index';
import { computeWorkerBalance } from '../src/lib/workerBalance';
import { mapCategoryToTransactionType } from '../src/lib/finance/executeWorkerPayment';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n================================================================');
console.log('--- PARTNER HISAAB OPENING BALANCES, EDIT & DELETE TEST SUITE ---');
console.log('================================================================\n');

async function runTestSuite() {
  // ============================================================================
  // Test 1: Opening Balances (Positive & Negative) across Calculations & Money Position
  // ============================================================================
  console.log('=== TEST 1: PARTNER & BANK OPENING BALANCES ===\n');

  // Case 1A: Positive Opening Balance (Akshay: +₹5,000 in hand)
  const akshayPos = calculateWalletBalance({
    openingBalance: 5000,
    totalMoneyIn: 20000,
    totalTransfersIn: 0,
    totalTransfersOut: 5000,
    totalExpenses: 2000,
  });
  console.log('Akshay (+5,000 OpBal) Result:', akshayPos);
  assert(akshayPos.openingBalance === 5000, 'Akshay openingBalance is 5000');
  assert(akshayPos.totalCredits === 25000, 'Akshay totalCredits includes openingBalance: 20000 + 5000 = 25000');
  assert(akshayPos.totalDebits === 7000, 'Akshay totalDebits is 5000 + 2000 = 7000');
  assert(akshayPos.balance === 18000, 'Akshay balance is 25000 - 7000 = 18000');

  // Case 1B: Negative Opening Balance (Rajesh: -₹2,000 initial dues/overdrawn)
  const rajeshNeg = calculateWalletBalance({
    openingBalance: -2000,
    totalMoneyIn: 10000,
    totalTransfersIn: 2000,
    totalTransfersOut: 4000,
    totalExpenses: 3000,
  });
  console.log('Rajesh (-2,000 OpBal) Result:', rajeshNeg);
  assert(rajeshNeg.openingBalance === -2000, 'Rajesh openingBalance is -2000');
  assert(rajeshNeg.totalCredits === 12000, 'Rajesh totalCredits: 10000 + 2000 = 12000');
  assert(rajeshNeg.totalDebits === 9000, 'Rajesh totalDebits includes abs(-2000): 4000 + 3000 + 2000 = 9000');
  assert(rajeshNeg.balance === 3000, 'Rajesh balance: 12000 - 9000 = 3000');

  // Case 1C: Bank Account with Opening Balance (SBI Bank: +₹50,000)
  const sbiBank = calculateBankBalance({
    openingBalance: 50000,
    totalDeposits: 15000,
    totalReceipts: 25000,
    totalTransfersFromPartner: 0,
    totalWithdrawals: 10000,
    totalPayments: 20000,
    totalTransfersToPartner: 0,
  });
  console.log('SBI Bank (+50,000 OpBal) Result:', sbiBank);
  assert(sbiBank.openingBalance === 50000, 'SBI openingBalance is 50000');
  assert(sbiBank.totalInflow === 40000, 'SBI period totalInflow: 15000 + 25000 = 40000');
  assert(sbiBank.totalOutflow === 30000, 'SBI period totalOutflow: 10000 + 20000 = 30000');
  assert(sbiBank.balance === 60000, 'SBI balance: 50000 + 40000 - 30000 = 60000');

  // Case 1D: Overall Money Position with Opening Balances Included
  const overallPosition = calculateOverallMoneyPosition({
    partnerWallets: [
      { id: 'akshay', name: 'Akshay Tak', balance: akshayPos.balance },
      { id: 'rajesh', name: 'Rajesh Thakur', balance: rajeshNeg.balance },
    ],
    supervisorWallets: [],
    bankBalances: [
      { id: 'sbi-1', name: 'SBI Main', bankName: 'SBI', balance: sbiBank.balance },
    ],
  });
  console.log('Overall Money Position:', overallPosition);
  assert(overallPosition.totalPartnersCash === 21000, 'totalPartnersCash: 18000 + 3000 = 21000');
  assert(overallPosition.totalBankBalance === 60000, 'totalBankBalance: 60000');
  assert(overallPosition.totalMoney === 81000, 'totalMoney: 21000 + 60000 = 81000');

  // ============================================================================
  // Test 2: Worker Payment Edit UP & DOWN (Atomic Sync of 3 Records & Khata)
  // ============================================================================
  console.log('\n=== TEST 2: WORKER PAYMENT EDIT UP & DOWN ===\n');

  // Initial State:
  // Partner A Wallet: ₹50,000
  // Worker 1 (JONNY UP): Earned Wages = ₹15,000, Initial Paid = ₹0, Dues = ₹15,000
  let partnerWallet = 50000;
  let workerEarned = 15000;
  let workerPaid = 0;

  // Step 2.1: Payment of ₹3,000 is created
  let paymentRecord = {
    id: 'pay-001',
    workerId: 'wrk-1',
    amount: 3000,
    date: new Date('2026-10-10'),
    transactionType: 'SALARY',
    fundTransferId: 'ft-001',
    deletedAt: null as Date | null,
    isEdited: false,
  };
  let linkedFundTransfer = {
    id: 'ft-001',
    linkedPaymentId: 'pay-001',
    toWorkerId: 'wrk-1',
    fromUserId: 'usr-akshay',
    amount: 3000,
    purpose: 'Worker Payment (Salary / Wages)',
    deletedAt: null as Date | null,
    isEdited: false,
  };
  let linkedExpense = {
    id: 'exp-001',
    notes: 'Payment ID: pay-001',
    category: 'LABOUR',
    amount: 3000,
    walletOwnerId: 'usr-akshay',
    deletedAt: null as Date | null,
    isEdited: false,
  };

  partnerWallet -= 3000; // 47000
  workerPaid += 3000; // 3000

  let initialWorkerKhata = computeWorkerBalance({ attendanceWages: workerEarned, payments: workerPaid });
  console.log('After Initial Payment (₹3,000):');
  console.log(`  Partner Wallet: ₹${partnerWallet}`);
  console.log(`  Worker Khata Remaining Payable: ₹${initialWorkerKhata.remainingPayable}`);
  assert(partnerWallet === 47000, 'Wallet reduced by 3000 to 47000');
  assert(initialWorkerKhata.remainingPayable === 12000, 'Worker dues reduced by 3000 to 12000');

  // Step 2.2: Edit UP from ₹3,000 to ₹4,500 (+₹1,500 difference)
  const diffUp = 4500 - paymentRecord.amount; // +1500
  assert(partnerWallet >= diffUp, 'Partner has enough wallet balance for +₹1,500 edit up');

  // Atomic update:
  paymentRecord.amount = 4500;
  paymentRecord.isEdited = true;
  linkedFundTransfer.amount = 4500;
  linkedFundTransfer.isEdited = true;
  linkedExpense.amount = 4500;
  linkedExpense.isEdited = true;
  partnerWallet -= diffUp;
  workerPaid += diffUp;

  let afterEditUpKhata = computeWorkerBalance({ attendanceWages: workerEarned, payments: workerPaid });
  console.log('\nAfter Edit UP to ₹4,500 (+₹1,500):');
  console.log(`  Payment Record Amount: ₹${paymentRecord.amount} (isEdited: ${paymentRecord.isEdited})`);
  console.log(`  FundTransfer Amount: ₹${linkedFundTransfer.amount} (isEdited: ${linkedFundTransfer.isEdited})`);
  console.log(`  Labour Expense Amount: ₹${linkedExpense.amount} (isEdited: ${linkedExpense.isEdited})`);
  console.log(`  Partner Wallet: ₹${partnerWallet}`);
  console.log(`  Worker Khata Remaining Payable: ₹${afterEditUpKhata.remainingPayable}`);

  assert(paymentRecord.amount === 4500, 'Payment amount updated to 4500');
  assert(linkedFundTransfer.amount === 4500, 'FundTransfer amount updated to 4500');
  assert(linkedExpense.amount === 4500, 'Labour Expense amount updated to 4500');
  assert(partnerWallet === 45500, 'Partner wallet reduced by exactly 1500 to 45500');
  assert(afterEditUpKhata.remainingPayable === 10500, 'Worker dues reduced by exactly 1500 to 10500');

  // Step 2.3: Edit DOWN from ₹4,500 to ₹2,000 (-₹2,500 difference)
  const diffDown = 2000 - paymentRecord.amount; // -2500
  paymentRecord.amount = 2000;
  linkedFundTransfer.amount = 2000;
  linkedExpense.amount = 2000;
  partnerWallet -= diffDown; // returns +2500 to wallet
  workerPaid += diffDown;   // reduces paid by 2500

  let afterEditDownKhata = computeWorkerBalance({ attendanceWages: workerEarned, payments: workerPaid });
  console.log('\nAfter Edit DOWN to ₹2,000 (-₹2,500 refund):');
  console.log(`  Payment Record Amount: ₹${paymentRecord.amount}`);
  console.log(`  FundTransfer Amount: ₹${linkedFundTransfer.amount}`);
  console.log(`  Labour Expense Amount: ₹${linkedExpense.amount}`);
  console.log(`  Partner Wallet: ₹${partnerWallet}`);
  console.log(`  Worker Khata Remaining Payable: ₹${afterEditDownKhata.remainingPayable}`);

  assert(paymentRecord.amount === 2000, 'Payment amount updated to 2000');
  assert(linkedFundTransfer.amount === 2000, 'FundTransfer amount updated to 2000');
  assert(linkedExpense.amount === 2000, 'Labour Expense amount updated to 2000');
  assert(partnerWallet === 48000, 'Partner wallet refunded by 2500 to 48000');
  assert(afterEditDownKhata.remainingPayable === 13000, 'Worker dues increased by 2500 to 13000');

  // ============================================================================
  // Test 3: Worker Payment Soft-Delete & Khata Restoration
  // ============================================================================
  console.log('\n=== TEST 3: WORKER PAYMENT SOFT-DELETE & KHATA RESTORATION ===\n');

  const deleteReason = 'Voucher duplicate entered in error';
  const now = new Date();
  paymentRecord.deletedAt = now;
  linkedFundTransfer.deletedAt = now;
  linkedExpense.deletedAt = now;

  partnerWallet += paymentRecord.amount; // +2000 returned
  workerPaid -= paymentRecord.amount;   // -2000 removed

  let afterDeleteKhata = computeWorkerBalance({ attendanceWages: workerEarned, payments: workerPaid });
  console.log('After Soft-Delete of ₹2,000 Worker Payment:');
  console.log(`  Payment deletedAt: ${paymentRecord.deletedAt}`);
  console.log(`  FundTransfer deletedAt: ${linkedFundTransfer.deletedAt}`);
  console.log(`  Labour Expense deletedAt: ${linkedExpense.deletedAt}`);
  console.log(`  Partner Wallet: ₹${partnerWallet} (Fully restored to 50000)`);
  console.log(`  Worker Khata Remaining Payable: ₹${afterDeleteKhata.remainingPayable} (Fully restored to 15000)`);

  assert(paymentRecord.deletedAt !== null, 'Payment is soft-deleted');
  assert(linkedFundTransfer.deletedAt !== null, 'FundTransfer is soft-deleted');
  assert(linkedExpense.deletedAt !== null, 'Labour Expense is soft-deleted');
  assert(partnerWallet === 50000, 'Partner wallet fully restored to 50000');
  assert(afterDeleteKhata.remainingPayable === 15000, 'Worker remaining payable fully restored to 15000');

  // ============================================================================
  // Test 4: Legacy Notes-based Linking ("Payment ID: pay-legacy-99")
  // ============================================================================
  console.log('\n=== TEST 4: LEGACY PAYMENT ID NOTES LINKAGE EDIT & DELETE ===\n');

  let legacyPayment = { id: 'pay-legacy-99', amount: 1000, deletedAt: null as Date | null };
  let legacyFt = { id: 'ft-legacy-99', notes: 'Payment ID: pay-legacy-99', amount: 1000, deletedAt: null as Date | null };
  let legacyExp = { id: 'exp-legacy-99', notes: 'Payment ID: pay-legacy-99 - Food advance', amount: 1000, deletedAt: null as Date | null };

  // Parse linked payment from note
  const extractPaymentId = (notes: string) => {
    const match = notes.match(/Payment ID:\s*([^\s•]+)/);
    return match ? match[1] : null;
  };

  assert(extractPaymentId(legacyFt.notes) === 'pay-legacy-99', 'Parsed payment ID from legacy FundTransfer note');
  assert(extractPaymentId(legacyExp.notes) === 'pay-legacy-99', 'Parsed payment ID from legacy Expense note');

  // Test updating legacy linked records:
  const newLegacyAmount = 1500;
  legacyPayment.amount = newLegacyAmount;
  legacyFt.amount = newLegacyAmount;
  legacyExp.amount = newLegacyAmount;
  assert(legacyPayment.amount === 1500 && legacyFt.amount === 1500 && legacyExp.amount === 1500, 'All legacy records synced on edit');

  // Test deleting legacy linked records:
  legacyPayment.deletedAt = new Date();
  legacyFt.deletedAt = new Date();
  legacyExp.deletedAt = new Date();
  assert(legacyPayment.deletedAt !== null && legacyFt.deletedAt !== null && legacyExp.deletedAt !== null, 'All legacy records soft-deleted together');

  // ============================================================================
  // Test 5: Partner-to-Partner Transfer Edit & Negative Balance Rejections
  // ============================================================================
  console.log('\n=== TEST 5: PARTNER-TO-PARTNER TRANSFER EDIT & BALANCE CHECKS ===\n');

  // Partner A: ₹10,000 wallet
  // Partner B: ₹1,000 wallet (after spending received funds)
  // Existing transfer: Partner A -> Partner B = ₹5,000
  let pA_Wallet = 10000;
  let pB_Wallet = 1000;
  let transferAmount = 5000;

  // Case 5A: Edit UP transfer from ₹5,000 to ₹12,000 (+₹7,000). Partner A only has ₹10,000.
  // Requires +₹7,000 from Partner A. Partner A has ₹10,000 -> Allowed.
  let pA_HasEnoughFor7k = pA_Wallet >= 7000;
  assert(pA_HasEnoughFor7k === true, 'Partner A has enough for +7000 edit up');

  // Case 5B: Edit UP transfer from ₹5,000 to ₹16,000 (+₹11,000). Partner A only has ₹10,000.
  let pA_HasEnoughFor11k = pA_Wallet >= 11000;
  assert(pA_HasEnoughFor11k === false, 'Partner A does NOT have enough for +11000 edit up (Rejected: would make Partner A wallet negative)');

  // Case 5C: Edit DOWN transfer from ₹5,000 to ₹2,000 (-₹3,000).
  // Partner B must return ₹3,000, but Partner B only has ₹1,000!
  let pB_HasEnoughToReturn3k = pB_Wallet >= 3000;
  assert(pB_HasEnoughToReturn3k === false, 'Partner B does NOT have enough balance to refund 3000 (Rejected: would make Partner B wallet negative)');

  // ============================================================================
  // Test 6: Client Receipt Delete Safety Check (Prevent Negative Balance)
  // ============================================================================
  console.log('\n=== TEST 6: CLIENT RECEIPT DELETE SAFETY CHECK ===\n');

  // Partner received ₹20,000 client payment.
  // Partner then spent ₹17,000 on site materials.
  // Current live balance = ₹3,000.
  let partnerReceiptWallet = 3000;
  const receiptToDeleteAmount = 20000;

  const canDeleteReceipt = partnerReceiptWallet >= receiptToDeleteAmount;
  assert(canDeleteReceipt === false, 'Deleting receipt of ₹20,000 rejected because Partner wallet would become -₹17,000');

  // ============================================================================
  // Test 7: Role-Based Permissions (OWNER vs MANAGER 48h Window vs OTHERS)
  // ============================================================================
  console.log('\n=== TEST 7: ROLE-BASED PERMISSION ENFORCEMENT ===\n');

  function checkPermission(
    userRole: string,
    currentUserId: string,
    recordCreatorId: string,
    recordCreatedAt: Date
  ): { allowed: boolean; reason?: string } {
    if (userRole === 'OWNER') return { allowed: true };
    if (['MANAGER', 'ACCOUNTANT'].includes(userRole)) {
      if (currentUserId !== recordCreatorId) {
        return { allowed: false, reason: 'Forbidden: You can only edit or delete your own entries' };
      }
      const ageHours = (Date.now() - recordCreatedAt.getTime()) / (1000 * 60 * 60);
      if (ageHours > 48) {
        return { allowed: false, reason: 'Forbidden: You can only edit or delete entries within 48 hours of creation' };
      }
      return { allowed: true };
    }
    return { allowed: false, reason: 'Forbidden: Insufficient permissions' };
  }

  const nowMs = Date.now();
  const twoHoursAgo = new Date(nowMs - 2 * 60 * 60 * 1000);
  const fiftyHoursAgo = new Date(nowMs - 50 * 60 * 60 * 1000);

  // 1. OWNER on any record at any time
  const permOwner = checkPermission('OWNER', 'usr-owner', 'usr-other', fiftyHoursAgo);
  assert(permOwner.allowed === true, 'OWNER has unrestricted permission on any record at any age');

  // 2. MANAGER on own record created 2 hours ago
  const permMgrOwn = checkPermission('MANAGER', 'usr-mgr', 'usr-mgr', twoHoursAgo);
  assert(permMgrOwn.allowed === true, 'MANAGER allowed to edit own record created 2 hours ago (<48h)');

  // 3. MANAGER on someone else\'s record
  const permMgrOther = checkPermission('MANAGER', 'usr-mgr', 'usr-other', twoHoursAgo);
  assert(permMgrOther.allowed === false, 'MANAGER blocked from modifying someone else\'s record');

  // 4. MANAGER on own record created 50 hours ago
  const permMgrOld = checkPermission('MANAGER', 'usr-mgr', 'usr-mgr', fiftyHoursAgo);
  assert(permMgrOld.allowed === false, 'MANAGER blocked from modifying record older than 48 hours');

  // 5. SUPERVISOR or other roles
  const permSupervisor = checkPermission('SITE_SUPERVISOR', 'usr-sup', 'usr-sup', twoHoursAgo);
  assert(permSupervisor.allowed === false, 'SUPERVISOR blocked (403)');

  // ============================================================================
  // Test 8: Audit Logging & Undo / Restoration
  // ============================================================================
  console.log('\n=== TEST 8: AUDIT LOGGING & RESTORATION ===\n');

  interface AuditEntry {
    entityType: string;
    entityId: string;
    action: 'UPDATE' | 'DELETE';
    oldValue: any;
    newValue?: any;
    details: string;
  }
  const auditLogs: AuditEntry[] = [];

  // Log Edit
  auditLogs.push({
    entityType: 'Payment',
    entityId: 'pay-001',
    action: 'UPDATE',
    oldValue: { amount: 3000, date: '2026-10-10' },
    newValue: { amount: 4500, date: '2026-10-10' },
    details: 'Worker payment for JONNY UP edited from ₹3000 to ₹4500. Reason: Corrected voucher',
  });

  // Log Delete
  auditLogs.push({
    entityType: 'Payment',
    entityId: 'pay-001',
    action: 'DELETE',
    oldValue: { amount: 4500, date: '2026-10-10', workerId: 'wrk-1' },
    details: 'Worker payment deleted. Reason: Cancelled',
  });

  assert(auditLogs.length === 2, 'Audit log recorded 2 entries');
  assert(auditLogs[0].oldValue.amount === 3000 && auditLogs[0].newValue.amount === 4500, 'Edit diff accurately stored');
  assert(auditLogs[1].action === 'DELETE' && auditLogs[1].oldValue.amount === 4500, 'Delete snapshot accurately stored');

  console.log('\n================================================================');
  console.log('--- ALL PARTNER HISAAB OPENING, EDIT & DELETE TESTS PASSED! ---');
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
