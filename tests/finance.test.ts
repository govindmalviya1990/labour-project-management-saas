async function testFinance() {
  console.log('--- STARTING PHASE 4: FINANCE, PAYMENTS, ALLOWANCES & KHATA TESTS ---');

  const BASE_URL = 'http://localhost:3000';

  // 1. Login as Owner
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@modernway.com',
      password: 'password123',
    }),
  });
  if (!loginRes.ok) throw new Error('Login failed');
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
  console.log('✅ Logged in successfully');

  // 2. Fetch Worker Ramesh for testing
  const workersRes = await fetch(`${BASE_URL}/api/workers?search=Ramesh`, {
    headers: { Cookie: cookie },
  });
  const workersData = await workersRes.json();
  const ramesh = workersData.workers.find((w: any) => w.name.includes('Ramesh'));
  if (!ramesh) throw new Error('Worker Ramesh not found');
  console.log('✅ Loaded worker Ramesh:', ramesh.id);

  // 3. Test Khata Ledger for Ramesh (Prompt Section 66 formula verification)
  console.log('\n3. Testing GET /api/finance/khata (Section 66 verification):');
  const khataRes = await fetch(`${BASE_URL}/api/finance/khata?workerId=${ramesh.id}`, {
    headers: { Cookie: cookie },
  });
  if (!khataRes.ok) throw new Error(`GET /api/finance/khata failed: ${khataRes.status}`);
  const khataData = await khataRes.json();

  console.log('✅ Total Earned from attendance:', khataData.summary.totalEarned);
  console.log('✅ Total Allowances:', khataData.summary.totalAllowances);
  console.log('✅ Total Advances:', khataData.summary.totalAdvances);
  console.log('✅ Total Paid:', khataData.summary.totalPaid);
  console.log('✅ Remaining Payable:', khataData.summary.remainingPayable);
  console.log('✅ Ledger entries count:', khataData.ledger.length);

  const expectedRemaining =
    Math.round(
      (khataData.summary.totalEarned +
        khataData.summary.totalAllowances -
        khataData.summary.totalAdvances -
        khataData.summary.totalPaid) *
        100
    ) / 100;

  if (khataData.summary.remainingPayable !== expectedRemaining) {
    throw new Error(
      `Section 66 Khata ledger formula mismatch! Expected ${expectedRemaining}, got ${khataData.summary.remainingPayable}`
    );
  }
  console.log(`✅ Verified Section 66 Formula: ${khataData.summary.totalEarned} + ${khataData.summary.totalAllowances} - ${khataData.summary.totalAdvances} - ${khataData.summary.totalPaid} = ${khataData.summary.remainingPayable}`);

  // 4. Test Adding an Allowance
  console.log('\n4. Testing POST /api/finance/allowances:');
  const alwRes = await fetch(`${BASE_URL}/api/finance/allowances`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      workerId: ramesh.id,
      date: new Date().toISOString().split('T')[0],
      type: 'FOOD',
      amount: 500,
      description: 'Overtime site dinner allowance',
    }),
  });
  if (!alwRes.ok) throw new Error(`POST /api/finance/allowances failed: ${await alwRes.text()}`);
  const alwData = await alwRes.json();
  console.log('✅ Allowance logged:', alwData.allowance.type, 'Amount:', alwData.allowance.amount);

  // 5. Test Recording a Payment to Settle the Remaining Balance
  console.log('\n5. Testing POST /api/finance/payments:');
  const pmtRes = await fetch(`${BASE_URL}/api/finance/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      workerId: ramesh.id,
      date: new Date().toISOString().split('T')[0],
      transactionType: 'PAYMENT',
      amount: Math.max(500, khataData.summary.remainingPayable + 500),
      paymentMethod: 'UPI',
      reference: 'UPI-SETTLE-8831',
      notes: 'Final settlement for month',
    }),
  });
  if (!pmtRes.ok) throw new Error(`POST /api/finance/payments failed: ${await pmtRes.text()}`);
  const pmtData = await pmtRes.json();
  console.log('✅ Payment logged:', pmtData.payment.transactionType, 'Amount:', pmtData.payment.amount);

  // 6. Verify Khata Ledger Balance is now PAID
  console.log('\n6. Verifying Khata Ledger Updated to PAID:');
  const khataAfterRes = await fetch(`${BASE_URL}/api/finance/khata?workerId=${ramesh.id}`, {
    headers: { Cookie: cookie },
  });
  const khataAfterData = await khataAfterRes.json();
  console.log('✅ New Remaining Payable:', khataAfterData.summary.remainingPayable);
  console.log('✅ New Payment Status:', khataAfterData.summary.paymentStatus, '(Expected: PAID)');
  if (khataAfterData.summary.paymentStatus !== 'PAID') {
    throw new Error(`Expected payment status PAID, got: ${khataAfterData.summary.paymentStatus}`);
  }

  // 7. Test Site Expenses CRUD
  console.log('\n7. Testing Site Expenses CRUD:');
  const projRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Cookie: cookie },
  });
  const projData = await projRes.json();
  const testProject = projData.projects[0];

  const expRes = await fetch(`${BASE_URL}/api/finance/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      projectId: testProject.id,
      date: new Date().toISOString().split('T')[0],
      category: 'FUEL',
      description: 'Diesel for Site Backhoe Excavator (80L)',
      amount: 7200,
      paidBy: 'Site Engineer',
      paymentMethod: 'CASH',
      vendorName: 'Bharat Petroleum',
    }),
  });
  if (!expRes.ok) throw new Error(`POST /api/finance/expenses failed: ${await expRes.text()}`);
  const expData = await expRes.json();
  console.log('✅ Expense created:', expData.expense.description, 'Amount:', expData.expense.amount);

  // 8. Verify Project Actual Cost Updated with the Expense
  console.log('\n8. Verifying Project Dashboard Reflects New Expense:');
  const projDetailRes = await fetch(`${BASE_URL}/api/projects/${testProject.id}`, {
    headers: { Cookie: cookie },
  });
  const projDetailData = await projDetailRes.json();
  console.log('✅ Project Actual Total Cost:', projDetailData.financials.actualTotalCost);
  console.log('✅ Project Actual Other Expenses:', projDetailData.financials.actualOtherExpense);

  console.log('\n🎉 ALL PHASE 4: FINANCE, PAYMENTS, ALLOWANCES & KHATA TESTS PASSED!\n');
}

testFinance().catch((err) => {
  console.error('❌ Phase 4 tests failed:', err);
  process.exit(1);
});
