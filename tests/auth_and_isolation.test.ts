async function testAuthAndIsolation() {
  console.log('--- STARTING PHASE 1: AUTH & TENANT ISOLATION TESTS ---');

  const BASE_URL = 'http://localhost:3000';

  // 1. Valid Login as Owner
  console.log('\n1. Testing POST /api/auth/login with valid credentials:');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@modernway.com',
      password: 'password123',
    }),
  });
  if (!loginRes.ok) throw new Error(`Login failed with status ${loginRes.status}`);
  const ownerCookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
  const loginData = await loginRes.json();
  console.log(`✅ Logged in as: ${loginData.user.name} (${loginData.user.role})`);

  // 2. Invalid Login Rejection
  console.log('\n2. Testing POST /api/auth/login with wrong password:');
  const wrongLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@modernway.com',
      password: 'WrongPassword999',
    }),
  });
  if (wrongLoginRes.status === 401) {
    console.log('✅ Invalid password successfully rejected with 401 Unauthorized');
  } else {
    throw new Error(`Expected 401, got ${wrongLoginRes.status}`);
  }

  // 3. Unauthenticated Access Protection
  console.log('\n3. Testing Protected Route without auth token:');
  const noAuthRes = await fetch(`${BASE_URL}/api/projects`);
  if (noAuthRes.status === 401) {
    console.log('✅ Unauthenticated request blocked with 401 Unauthorized');
  } else {
    throw new Error(`Expected 401, got ${noAuthRes.status}`);
  }

  // 4. Role-Based Access Control (RBAC)
  console.log('\n4. Testing Role-Based Access Control (RBAC):');
  // Login as Supervisor
  const supLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'supervisor@modernway.com',
      password: 'password123',
    }),
  });
  if (!supLoginRes.ok) throw new Error('Supervisor login failed');
  const supervisorCookie = supLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
  console.log('✅ Logged in as SITE_SUPERVISOR');

  // Supervisor attempting to add team members (restricted to Owner/Manager)
  const forbiddenRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: supervisorCookie },
    body: JSON.stringify({
      name: 'Hacker User',
      email: 'hacker@test.com',
      role: 'OWNER',
      password: 'password123',
    }),
  });
  if (forbiddenRes.status === 403) {
    console.log('✅ Supervisor blocked from administrative actions with 403 Forbidden');
  } else {
    throw new Error(`Expected 403, got ${forbiddenRes.status}`);
  }

  // 5. Multi-Tenant Organization Isolation Test
  console.log('\n5. Testing Multi-Tenant Organization Isolation:');
  // First register user for Tenant B
  const tenantBEmail = `tenant_b_${Date.now()}@apexbuilders.com`;
  const registerBRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Vikram Seth',
      email: tenantBEmail,
      password: 'password123',
      mobile: '9888776655',
    }),
  });
  if (!registerBRes.ok) throw new Error(`Tenant B register failed: ${await registerBRes.text()}`);
  const regCookieB = registerBRes.headers.get('set-cookie')?.split(';')[0] || '';

  // Now onboard organization for Tenant B
  const tenantBOrgRes = await fetch(`${BASE_URL}/api/onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: regCookieB },
    body: JSON.stringify({
      organization: {
        name: 'Apex Infrastructure Group',
        mobile: '9888776655',
        city: 'Mumbai',
        state: 'Maharashtra',
      },
    }),
  });
  if (!tenantBOrgRes.ok) throw new Error(`Tenant B onboarding failed: ${await tenantBOrgRes.text()}`);
  const tenantBCookie = tenantBOrgRes.headers.get('set-cookie')?.split(';')[0] || regCookieB;
  console.log('✅ Created Tenant B organization: Apex Infrastructure Group');

  // Tenant B fetching projects: MUST be empty and MUST NOT see Tenant A projects!
  const tenantBProjectsRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Cookie: tenantBCookie },
  });
  const tenantBProjects = await tenantBProjectsRes.json();
  console.log(`✅ Tenant B sees ${tenantBProjects.projects?.length || 0} projects (Expected: 0 - completely isolated)`);
  if (tenantBProjects.projects && tenantBProjects.projects.length > 0) {
    throw new Error('Tenant data leak! Tenant B saw Tenant A projects!');
  }

  // Tenant A fetching projects: MUST see its own projects
  const tenantAProjectsRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Cookie: ownerCookie },
  });
  const tenantAProjects = await tenantAProjectsRes.json();
  console.log(`✅ Tenant A sees ${tenantAProjects.projects?.length} projects`);
  if (!tenantAProjects.projects || tenantAProjects.projects.length === 0) {
    throw new Error('Tenant A projects missing!');
  }

  console.log('\n🎉 ALL PHASE 1: AUTH & TENANT ISOLATION TESTS PASSED PERFECTLY!\n');
}

testAuthAndIsolation().catch((err) => {
  console.error('❌ AUTH TEST FAILED:', err);
  process.exit(1);
});
