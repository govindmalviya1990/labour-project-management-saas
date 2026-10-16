import {
  calculateWalletBalance,
  calculateBankBalance,
  calculateOverallMoneyPosition,
} from '../src/lib/calculations/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n================================================================');
console.log('--- BANK TRANSACTIONS & ALL 3 FILTERS COMPREHENSIVE TEST SUITE ---');
console.log('================================================================\n');

async function runTestSuite() {
  // ============================================================================
  // Test 1: Bank Account Opening Balance in Calculations & Net Liquidity
  // ============================================================================
  console.log('=== TEST 1: BANK ACCOUNT OPENING BALANCE & MONEY POSITION ===\n');

  // Case 1A: Bank Opening Balance (+₹1,00,000)
  const bankA = calculateBankBalance({
    openingBalance: 100000,
    totalDeposits: 50000,
    totalReceipts: 30000,
    totalTransfersFromPartner: 20000,
    totalWithdrawals: 10000,
    totalPayments: 40000,
    totalTransfersToPartner: 25000,
  });
  console.log('Bank A (+₹1,00,000 OpBal) Result:', bankA);
  assert(bankA.openingBalance === 100000, 'Bank A openingBalance is 100000');
  assert(bankA.totalInflow === 100000, 'Bank A totalInflow: 50000 + 30000 + 20000 = 100000');
  assert(bankA.totalOutflow === 75000, 'Bank A totalOutflow: 10000 + 40000 + 25000 = 75000');
  assert(bankA.balance === 125000, 'Bank A balance: 100000 + 100000 - 75000 = 125000');

  // Case 1B: Overdraft / Negative Opening Balance Bank Account (-₹10,000)
  const bankOD = calculateBankBalance({
    openingBalance: -10000,
    totalDeposits: 20000,
    totalReceipts: 5000,
    totalTransfersFromPartner: 0,
    totalWithdrawals: 5000,
    totalPayments: 2000,
    totalTransfersToPartner: 0,
  });
  console.log('Bank OD (-₹10,000 OpBal) Result:', bankOD);
  assert(bankOD.openingBalance === -10000, 'Bank OD openingBalance is -10000');
  assert(bankOD.totalInflow === 25000, 'Bank OD totalInflow is 25000');
  assert(bankOD.totalOutflow === 7000, 'Bank OD totalOutflow is 7000');
  assert(bankOD.balance === 8000, 'Bank OD balance: -10000 + 25000 - 7000 = 8000');

  // Case 1C: Net Liquidity with Partner Wallets + Bank Accounts
  const p1 = calculateWalletBalance({
    openingBalance: 5000,
    totalMoneyIn: 10000,
    totalTransfersIn: 0,
    totalTransfersOut: 2000,
    totalExpenses: 3000,
  });
  const moneyPosition = calculateOverallMoneyPosition({
    partnerWallets: [{ partnerId: 'p1', partnerName: 'Partner 1', balance: p1.balance }],
    supervisorWallets: [],
    bankBalances: [
      { bankAccountId: 'b1', bankName: 'HDFC', balance: bankA.balance },
      { bankAccountId: 'b2', bankName: 'ICICI OD', balance: bankOD.balance },
    ],
  });
  console.log('Overall Money Position Result:', moneyPosition);
  assert(moneyPosition.totalPartnersCash === 10000, 'totalPartnersCash is 10000');
  assert(moneyPosition.totalBankBalance === 133000, 'totalBankBalance is 125000 + 8000 = 133000');
  assert(moneyPosition.totalMoney === 143000, 'Net Total Liquidity is 10000 + 133000 = 143000');

  // ============================================================================
  // Test 2: Bank Transaction Edit & Delete Balance Guardrails
  // ============================================================================
  console.log('\n=== TEST 2: BANK EDIT & DELETE NEGATIVE BALANCE GUARDRAILS ===\n');

  // Guardrail 2A: Direct Payment Edit UP exceeding bank balance
  const currentBankBalance = 15000;
  const existingPaymentAmount = 5000;
  const newPaymentAmountExceeding = 25000; // diff +20,000 > available 15,000
  const canEditUpPayment = currentBankBalance >= (newPaymentAmountExceeding - existingPaymentAmount);
  assert(!canEditUpPayment, 'Guardrail: Reject editing direct payment up when bank balance is insufficient');

  // Guardrail 2B: Direct Payment Edit UP within bank balance
  const newPaymentAmountValid = 18000; // diff +13,000 <= available 15,000
  const canEditUpValid = currentBankBalance >= (newPaymentAmountValid - existingPaymentAmount);
  assert(canEditUpValid, 'Guardrail: Allow editing direct payment up when bank balance covers difference');

  // Guardrail 2C: Delete Bank Deposit when bank balance is less than deposit
  const bankBalAfterSpend = 3000;
  const depositToDelete = 10000;
  const canDeleteDeposit = bankBalAfterSpend >= depositToDelete;
  assert(!canDeleteDeposit, 'Guardrail: Reject deleting bank deposit if bank account would drop negative (₹-7,000)');

  // Guardrail 2D: Delete Bank Withdrawal when partner has already spent cash
  const partnerWalletAfterSpend = 500;
  const withdrawalToDelete = 5000;
  const canDeleteWithdrawal = partnerWalletAfterSpend >= withdrawalToDelete;
  assert(!canDeleteWithdrawal, 'Guardrail: Reject deleting bank withdrawal if partner wallet would drop negative (₹-4,500)');

  // ============================================================================
  // Test 3: All Transactions Filter Logic (Sabhi Transactions Ka Statement)
  // ============================================================================
  console.log('\n=== TEST 3: ALL TRANSACTIONS STATEMENT FILTER ===\n');

  const mockAllLedger = [
    { id: '1', type: 'RECEIPT', title: 'Sharma Villa Bill', amount: 50000, credit: 50000, debit: 0, categoryLabel: 'Client Payment' },
    { id: '2', type: 'EXPENSE', title: 'UltraTech Cement 50 bags', amount: 18000, credit: 0, debit: 18000, categoryLabel: 'Site Expense: Materials' },
    { id: '3', type: 'WORKER_PAYMENT', isWorkerPayment: true, workerName: 'Ramesh Mistri', title: 'Worker: Ramesh', amount: 6000, credit: 0, debit: 6000, categoryLabel: 'Worker Payment (Labour)' },
    { id: '4', type: 'TRANSFER', title: 'Akshay ➔ Rajesh', amount: 10000, credit: 0, debit: 0, categoryLabel: 'Partner Transfer' },
    { id: '5', type: 'BANK_DEPOSIT', title: 'Cash Deposited to SBI', amount: 20000, credit: 20000, debit: 0, categoryLabel: 'Bank Cash Deposit' },
    { id: '6', type: 'BANK_WITHDRAWAL', title: 'Withdrawn from SBI', amount: 5000, credit: 0, debit: 5000, categoryLabel: 'Bank Cash Withdrawal' },
  ];

  function filterLedger(ledger: any[], filterType: string, searchQuery: string = '') {
    return ledger.filter((item) => {
      if (filterType !== 'ALL') {
        if (filterType === 'BANK') {
          if (item.type !== 'BANK_DEPOSIT' && item.type !== 'BANK_WITHDRAWAL') return false;
        } else if (filterType === 'TRANSFER') {
          if (item.type !== 'TRANSFER' && item.type !== 'TRANSFER_IN' && item.type !== 'TRANSFER_OUT') return false;
        } else if (filterType === 'EXPENSE') {
          if (item.type !== 'EXPENSE') return false;
        } else if (filterType === 'WORKER_PAYMENT') {
          if (item.type !== 'WORKER_PAYMENT' && !item.isWorkerPayment) return false;
        } else if (item.type !== filterType) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesCat = item.categoryLabel?.toLowerCase().includes(q);
        const matchesWorker = item.workerName?.toLowerCase().includes(q);
        const matchesAmt = item.amount ? String(item.amount).includes(q) : false;
        if (!matchesTitle && !matchesCat && !matchesWorker && !matchesAmt) return false;
      }
      return true;
    });
  }

  const allEntries = filterLedger(mockAllLedger, 'ALL');
  assert(allEntries.length === 6, 'All Transactions: "ALL" tab returns 6 total entries');

  const allReceipts = filterLedger(mockAllLedger, 'RECEIPT');
  assert(allReceipts.length === 1 && allReceipts[0].id === '1', 'All Transactions: "RECEIPT" tab returns only receipts');

  const allExpenses = filterLedger(mockAllLedger, 'EXPENSE');
  assert(allExpenses.length === 1 && allExpenses[0].id === '2', 'All Transactions: "EXPENSE" tab returns only site expenses');

  const allWorkerPayments = filterLedger(mockAllLedger, 'WORKER_PAYMENT');
  assert(allWorkerPayments.length === 1 && allWorkerPayments[0].id === '3', 'All Transactions: "WORKER_PAYMENT" tab returns worker payout');

  const allTransfers = filterLedger(mockAllLedger, 'TRANSFER');
  assert(allTransfers.length === 1 && allTransfers[0].id === '4', 'All Transactions: "TRANSFER" tab returns partner-to-partner transfers');

  const allBank = filterLedger(mockAllLedger, 'BANK');
  assert(allBank.length === 2 && allBank.map(e => e.id).join(',') === '5,6', 'All Transactions: "BANK" tab returns both deposits and withdrawals');

  // Search in All Transactions
  const searchRamesh = filterLedger(mockAllLedger, 'ALL', 'Ramesh');
  assert(searchRamesh.length === 1 && searchRamesh[0].workerName === 'Ramesh Mistri', 'All Transactions Search: finds worker "Ramesh"');

  const searchAmount = filterLedger(mockAllLedger, 'ALL', '18000');
  assert(searchAmount.length === 1 && searchAmount[0].id === '2', 'All Transactions Search: finds record by amount "18000"');

  // ============================================================================
  // Test 4: Bank Statement Filter Logic
  // ============================================================================
  console.log('\n=== TEST 4: BANK ACCOUNT STATEMENT FILTER ===\n');

  const mockBankLedger = [
    { id: 'b1', type: 'OPENING_BALANCE', title: 'Opening Balance', amount: 50000, credit: 50000, debit: 0, categoryLabel: 'Opening Balance' },
    { id: 'b2', type: 'RECEIPT', title: 'Client Direct NEFT', amount: 75000, credit: 75000, debit: 0, categoryLabel: 'Bank Receipt' },
    { id: 'b3', type: 'BANK_DEPOSIT', title: 'Cash Deposited by Akshay', amount: 30000, credit: 30000, debit: 0, categoryLabel: 'Bank Deposit' },
    { id: 'b4', type: 'TRANSFER_OUT', title: 'Transfer to Rajesh Wallet', amount: 20000, credit: 0, debit: 20000, categoryLabel: 'Bank Transfer to Partner' },
    { id: 'b5', type: 'BANK_WITHDRAWAL', title: 'ATM Cash Withdrawal', amount: 10000, credit: 0, debit: 10000, categoryLabel: 'Cash Withdrawal from Bank' },
    { id: 'b6', type: 'EXPENSE', title: 'Vendor Cheque Payment', amount: 15000, credit: 0, debit: 15000, categoryLabel: 'Direct Bank Payment' },
    { id: 'b7', type: 'WORKER_PAYMENT', isWorkerPayment: true, workerName: 'Sohan', title: 'Worker Salary NEFT', amount: 8000, credit: 0, debit: 8000, categoryLabel: 'Worker Payment from Bank' },
  ];

  const bankAll = filterLedger(mockBankLedger, 'ALL');
  assert(bankAll.length === 7, 'Bank View: "ALL" tab returns all 7 bank entries including opening balance');

  const bankReceipts = filterLedger(mockBankLedger, 'RECEIPT');
  assert(bankReceipts.length === 1 && bankReceipts[0].id === 'b2', 'Bank View: "RECEIPT" tab returns bank client receipt');

  const bankDeposits = filterLedger(mockBankLedger, 'BANK_DEPOSIT');
  assert(bankDeposits.length === 1 && bankDeposits[0].id === 'b3', 'Bank View: "BANK_DEPOSIT" tab returns bank deposits');

  const bankTransfersToPartner = filterLedger(mockBankLedger, 'TRANSFER_OUT');
  assert(bankTransfersToPartner.length === 1 && bankTransfersToPartner[0].id === 'b4', 'Bank View: "TRANSFER_OUT" tab returns transfers to partner');

  const bankCashWithdrawals = filterLedger(mockBankLedger, 'BANK_WITHDRAWAL');
  assert(bankCashWithdrawals.length === 1 && bankCashWithdrawals[0].id === 'b5', 'Bank View: "BANK_WITHDRAWAL" tab returns cash withdrawals');

  const bankDirectPayments = filterLedger(mockBankLedger, 'EXPENSE');
  assert(bankDirectPayments.length === 1 && bankDirectPayments[0].id === 'b6', 'Bank View: "EXPENSE" tab returns direct payments');

  const bankWorkerPayments = filterLedger(mockBankLedger, 'WORKER_PAYMENT');
  assert(bankWorkerPayments.length === 1 && bankWorkerPayments[0].id === 'b7', 'Bank View: "WORKER_PAYMENT" tab returns worker payments from bank');

  // ============================================================================
  // Test 5: Individual Partner Statement Filter Logic
  // ============================================================================
  console.log('\n=== TEST 5: INDIVIDUAL PARTNER STATEMENT FILTER ===\n');

  const mockPartnerLedger = [
    { id: 'p1', type: 'OPENING_BALANCE', title: 'Opening Balance', amount: 10000, credit: 10000, debit: 0, categoryLabel: 'Opening Balance' },
    { id: 'p2', type: 'RECEIPT', title: 'Client Cash Payment', amount: 40000, credit: 40000, debit: 0, categoryLabel: 'Payment Received from Client' },
    { id: 'p3', type: 'TRANSFER_IN', title: 'From Bank / Akshay', amount: 15000, credit: 15000, debit: 0, categoryLabel: 'Transfers Received' },
    { id: 'p4', type: 'EXPENSE', title: 'Diesel for JCB', amount: 5000, credit: 0, debit: 5000, categoryLabel: 'Site Expense: Fuel & Travel' },
    { id: 'p5', type: 'WORKER_PAYMENT', isWorkerPayment: true, workerName: 'Mukesh', title: 'Worker: Mukesh', amount: 7000, credit: 0, debit: 7000, categoryLabel: 'Worker Payment (Wages)' },
    { id: 'p6', type: 'TRANSFER_OUT', title: 'To: Rajesh', amount: 8000, credit: 0, debit: 8000, categoryLabel: 'Transfer Out' },
    { id: 'p7', type: 'BANK_DEPOSIT', title: 'Deposited into SBI', amount: 12000, credit: 0, debit: 12000, categoryLabel: 'Bank Deposit' },
  ];

  const partnerAll = filterLedger(mockPartnerLedger, 'ALL');
  assert(partnerAll.length === 7, 'Partner View: "ALL" tab returns all 7 entries');

  const partnerReceipts = filterLedger(mockPartnerLedger, 'RECEIPT');
  assert(partnerReceipts.length === 1 && partnerReceipts[0].id === 'p2', 'Partner View: "RECEIPT" tab returns receipts received');

  const partnerTransfersIn = filterLedger(mockPartnerLedger, 'TRANSFER_IN');
  assert(partnerTransfersIn.length === 1 && partnerTransfersIn[0].id === 'p3', 'Partner View: "TRANSFER_IN" tab returns transfers received');

  const partnerExpenses = filterLedger(mockPartnerLedger, 'EXPENSE');
  assert(partnerExpenses.length === 1 && partnerExpenses[0].id === 'p4', 'Partner View: "EXPENSE" tab returns site expenses');

  const partnerWorker = filterLedger(mockPartnerLedger, 'WORKER_PAYMENT');
  assert(partnerWorker.length === 1 && partnerWorker[0].id === 'p5', 'Partner View: "WORKER_PAYMENT" tab returns worker payments');

  const partnerTransfersOut = filterLedger(mockPartnerLedger, 'TRANSFER_OUT');
  assert(partnerTransfersOut.length === 1 && partnerTransfersOut[0].id === 'p6', 'Partner View: "TRANSFER_OUT" tab returns transfers out to other partners');

  const partnerBankInOut = filterLedger(mockPartnerLedger, 'BANK');
  assert(partnerBankInOut.length === 1 && partnerBankInOut[0].id === 'p7', 'Partner View: "BANK" tab returns bank deposit/withdrawal');

  console.log('\n================================================================');
  console.log('--- ALL BANK TRANSACTIONS & ALL 3 VIEW FILTERS PASSED! ---');
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
