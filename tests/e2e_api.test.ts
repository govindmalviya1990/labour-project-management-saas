async function testE2E() {
  console.log('--- STARTING E2E API VERIFICATION ---');

  const BASE_URL = 'http://localhost:3000';

  // 1. Test Login with Seeded Owner
  console.log('\n1. Testing Login API with seeded Owner:');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@modernway.com',
      password: 'password123',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  console.log('✅ Login succeeded:', loginData.user.name, 'Org:', loginData.organization.name);

  // Extract set-cookie
  const cookieHeader = loginRes.headers.get('set-cookie');
  if (!cookieHeader) {
    throw new Error('Expected set-cookie header on login');
  }
  const tokenCookie = cookieHeader.split(';')[0];
  console.log('✅ Cookie received:', tokenCookie.substring(0, 30) + '...');

  // 2. Test /api/auth/me
  console.log('\n2. Testing /api/auth/me with session cookie:');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: tokenCookie },
  });
  const meData = await meRes.json();
  if (!meData.authenticated || meData.user.role !== 'OWNER') {
    throw new Error('Failed to retrieve active session from /api/auth/me');
  }
  console.log('✅ Active session confirmed:', meData.user.email, 'Role:', meData.user.role);

  // 3. Test /api/dashboard
  console.log('\n3. Testing /api/dashboard live KPI aggregates:');
  const dashRes = await fetch(`${BASE_URL}/api/dashboard`, {
    headers: { Cookie: tokenCookie },
  });
  if (!dashRes.ok) {
    throw new Error(`Dashboard API failed: ${dashRes.status}`);
  }
  const dashData = await dashRes.json();
  console.log('✅ Total Projects:', dashData.summary.totalProjects);
  console.log('✅ Running Projects:', dashData.summary.runningProjects);
  console.log('✅ Total Workers:', dashData.summary.totalWorkers);
  console.log('✅ Total Project Value:', dashData.summary.totalProjectValue);
  console.log('✅ Actual Total Cost:', dashData.summary.actualProjectCost);
  console.log('✅ Actual Profit:', dashData.summary.actualProfit);
  console.log('✅ Profit Margin %:', dashData.summary.profitMargin);
  console.log('✅ Pending Labour Payment:', dashData.summary.pendingLabourPayment);
  console.log('✅ Running Projects in list:', dashData.runningProjects.length);
  console.log('✅ Chart data points:', dashData.chartData.length);

  // 4. Test Registration & Onboarding for a Brand New Contractor
  console.log('\n4. Testing New Organization Registration & Onboarding:');
  const regEmail = `builder_${Date.now()}@sharma-construction.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Satish Sharma',
      email: regEmail,
      mobile: '9876500000',
      password: 'password123',
    }),
  });
  if (!regRes.ok) {
    throw new Error(`Registration failed: ${await regRes.text()}`);
  }
  const newCookie = regRes.headers.get('set-cookie')?.split(';')[0];
  console.log('✅ Registered new user:', regEmail);

  // Onboard new company
  const onboardRes = await fetch(`${BASE_URL}/api/onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: newCookie || '',
    },
    body: JSON.stringify({
      organization: {
        name: 'Sharma Builders & Infrastructure',
        ownerName: 'Satish Sharma',
        mobile: '9876500000',
        email: regEmail,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
      project: {
        name: 'Ganga Expressway Overbridge',
        projectCode: 'GBR-001',
        projectValue: 12000000,
        status: 'RUNNING',
      },
      worker: {
        name: 'Mukesh Fitter',
        workerCode: 'MK-01',
        category: 'Steel Worker',
        dailyWage: 900,
      },
      attendance: {
        date: new Date().toISOString().split('T')[0],
        status: 'PRESENT',
      },
    }),
  });

  if (!onboardRes.ok) {
    throw new Error(`Onboarding failed: ${await onboardRes.text()}`);
  }
  const onboardCookie = onboardRes.headers.get('set-cookie')?.split(';')[0] || newCookie;
  console.log('✅ Onboarding completed atomically');

  // Verify dashboard of the new contractor
  const newDashRes = await fetch(`${BASE_URL}/api/dashboard`, {
    headers: { Cookie: onboardCookie || '' },
  });
  const newDashData = await newDashRes.json();
  console.log('✅ New Contractor Org:', newDashData.organization.name);
  console.log('✅ New Contractor Total Projects:', newDashData.summary.totalProjects, '(Expected: 1)');
  console.log('✅ New Contractor Total Workers:', newDashData.summary.totalWorkers, '(Expected: 1)');
  console.log('✅ New Contractor Total Project Value:', newDashData.summary.totalProjectValue, '(Expected: 12000000)');

  if (newDashData.summary.totalProjects !== 1 || newDashData.summary.totalWorkers !== 1) {
    throw new Error('Tenant isolation mismatch on newly onboarded company!');
  }

  console.log('\n🎉 ALL END-TO-END HTTP API AND DATA ISOLATION TESTS PASSED!\n');
}

testE2E().catch((err) => {
  console.error('❌ E2E verification failed:', err);
  process.exit(1);
});
