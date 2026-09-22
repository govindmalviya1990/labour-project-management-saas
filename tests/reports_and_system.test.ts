async function testReportsAndSystem() {
  console.log('--- STARTING PHASES 6, 7 & 8: FINANCIALS, REPORTS & SYSTEM TESTS ---');

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

  // 2. Test Phase 6: Project Financial Matrix
  console.log('\n2. Testing GET /api/projects/financials:');
  const finRes = await fetch(`${BASE_URL}/api/projects/financials`, {
    headers: { Cookie: cookie },
  });
  if (!finRes.ok) throw new Error(`Financials failed: ${await finRes.text()}`);
  const finData = await finRes.json();

  console.log(`✅ Loaded ${finData.projects.length} projects in financial matrix.`);
  console.log(`✅ Portfolio Total Value: ₹${finData.portfolio.portfolioValue.toLocaleString('en-IN')}`);
  console.log(`✅ Portfolio Total Spend: ₹${finData.portfolio.portfolioActualCost.toLocaleString('en-IN')}`);
  console.log(`✅ Portfolio Projected Profit: ₹${finData.portfolio.portfolioProjectedProfit.toLocaleString('en-IN')}`);

  const p1 = finData.projects[0];
  console.log(`   Sample Project: ${p1.name}`);
  console.log(`   - Actual Labour: ₹${p1.financials.actualLabourCost}`);
  console.log(`   - Actual Materials: ₹${p1.financials.actualMaterialCost}`);
  console.log(`   - Actual Expenses: ₹${p1.financials.actualOtherExpense}`);
  console.log(`   - Total Actual Cost: ₹${p1.financials.actualTotalCost}`);
  console.log(`   - Budget Variance: ₹${p1.financials.variance} (${p1.financials.isOverBudget ? 'OVER' : 'UNDER'})`);
  console.log(`   - Cost per sq.ft.: ₹${p1.costPerUnit.costPerUnit}`);

  // 3. Test Phase 7: Reports Engine for each key report type
  console.log('\n3. Testing GET /api/reports for all domains:');

  const reportTypes = [
    'labour',
    'attendance',
    'productivity',
    'work',
    'daily-expense',
    'material',
    'salary',
    'khata',
    'project-cost',
    'profit-loss',
  ];

  for (const rType of reportTypes) {
    const rRes = await fetch(`${BASE_URL}/api/reports?type=${rType}`, {
      headers: { Cookie: cookie },
    });
    if (!rRes.ok) throw new Error(`Report ${rType} failed with status: ${rRes.status}`);
    const rData = await rRes.json();
    console.log(`✅ [${rType.toUpperCase()}] "${rData.reportType}": ${rData.data?.length || 0} rows returned.`);
  }

  // 4. Test Phase 8: Global Search
  console.log('\n4. Testing GET /api/search:');
  const searchRes = await fetch(`${BASE_URL}/api/search?q=Cement`, {
    headers: { Cookie: cookie },
  });
  if (!searchRes.ok) throw new Error(`Search failed: ${await searchRes.text()}`);
  const searchData = await searchRes.json();
  console.log(`✅ Search for "Cement" returned ${searchData.totalCount} matches across categories.`);

  // 5. Test Phase 8: Notifications Center & Dynamic Alerts
  console.log('\n5. Testing GET /api/notifications:');
  const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { Cookie: cookie },
  });
  if (!notifRes.ok) throw new Error(`Notifications failed: ${await notifRes.text()}`);
  const notifData = await notifRes.json();
  console.log(`✅ Notifications fetched: ${notifData.notifications.length} alerts (${notifData.unreadCount} unread).`);

  // 6. Test Phase 8: Users & Role Management
  console.log('\n6. Testing GET /api/users and POST /api/users:');
  const usersRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { Cookie: cookie },
  });
  const usersData = await usersRes.json();
  console.log(`✅ Loaded ${usersData.users.length} active team members.`);

  const testUserEmail = `supervisor_${Date.now()}@modernway.com`;
  const createUserRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      name: 'Prakash Surve',
      email: testUserEmail,
      role: 'SITE_SUPERVISOR',
      mobile: '9811223344',
      password: 'password123',
    }),
  });
  if (!createUserRes.ok) throw new Error(`Create user failed: ${await createUserRes.text()}`);
  const createdUserData = await createUserRes.json();
  console.log(`✅ Created test user: ${createdUserData.user.name} (${createdUserData.user.role})`);

  // 7. Test Phase 8: Settings & Company Profile
  console.log('\n7. Testing GET & PUT /api/settings/organization:');
  const orgRes = await fetch(`${BASE_URL}/api/settings/organization`, {
    headers: { Cookie: cookie },
  });
  const orgData = await orgRes.json();
  console.log(`✅ Current Organization: ${orgData.organization.name} (${orgData.organization.currency})`);

  const updateOrgRes = await fetch(`${BASE_URL}/api/settings/organization`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      name: orgData.organization.name,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      gstNumber: '27AAECM4455F1Z2',
    }),
  });
  if (!updateOrgRes.ok) throw new Error(`Update settings failed: ${await updateOrgRes.text()}`);
  console.log('✅ Updated organization GSTIN and localization preferences.');

  console.log('\n🎉 ALL PHASES 6, 7 & 8 AUTOMATED TESTS PASSED WITH 100% SUCCESS!\n');
}

testReportsAndSystem().catch((err) => {
  console.error('❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
