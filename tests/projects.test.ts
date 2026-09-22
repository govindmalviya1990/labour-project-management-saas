async function testProjects() {
  console.log('--- STARTING PHASE 2: PROJECTS & SITES TESTS ---');

  const BASE_URL = 'http://localhost:3000';

  // 1. Login as Owner to obtain session cookie
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
  console.log('✅ Logged in as Owner');

  // 2. Fetch Projects List
  console.log('\n2. Testing GET /api/projects:');
  const listRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Cookie: cookie },
  });
  if (!listRes.ok) throw new Error(`GET /api/projects failed: ${listRes.status}`);
  const listData = await listRes.json();
  console.log('✅ Retrieved projects count:', listData.projects.length);
  console.log('✅ Status counts:', listData.statusCounts);
  console.log('✅ Portfolio value:', listData.totalPortfolioValue);

  // 3. Create a New Project
  console.log('\n3. Testing POST /api/projects:');
  const newCode = `PRJ-${Date.now().toString().slice(-4)}`;
  const createRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      name: 'Lotus Business Park Tower D',
      projectCode: newCode,
      projectType: 'Commercial',
      status: 'RUNNING',
      location: 'Sector 128, Expressway',
      clientName: 'Lotus Greens Infra',
      clientMobile: '9899001122',
      projectValue: 7500000,
      estimatedLabourCost: 1500000,
      estimatedMaterialCost: 3500000,
      estimatedOtherExpense: 800000,
      targetUnit: 'sq.ft.',
      targetQuantity: 30000,
      initialSiteName: 'Tower D Core',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`POST /api/projects failed: ${await createRes.text()}`);
  }
  const createData = await createRes.json();
  const createdProject = createData.project;
  console.log('✅ Project created:', createdProject.name, 'ID:', createdProject.id);

  // 4. Test Duplicate Project Code Rejection
  console.log('\n4. Testing Duplicate Project Code Rejection:');
  const dupRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      name: 'Another Project with Same Code',
      projectCode: newCode,
      projectValue: 1000000,
    }),
  });
  if (dupRes.status !== 409) {
    throw new Error(`Expected 409 for duplicate code, got: ${dupRes.status}`);
  }
  console.log('✅ Successfully rejected duplicate project code (409 Conflict)');

  // 5. Test Add Project Site (e.g. Tower D Wing 2)
  console.log('\n5. Testing POST /api/projects/[id]/sites:');
  const siteRes = await fetch(`${BASE_URL}/api/projects/${createdProject.id}/sites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      name: 'Tower D Wing 2',
      location: 'Floors 1-12',
      supervisorName: 'Sonu Yadav',
      supervisorMobile: '9876543212',
    }),
  });
  if (!siteRes.ok) {
    throw new Error(`Failed to create site: ${await siteRes.text()}`);
  }
  const siteData = await siteRes.json();
  console.log('✅ Sub-site created under project:', siteData.site.name);

  // 6. Test GET /api/projects/[id] Single Project Details & Dynamic Financials
  console.log('\n6. Testing GET /api/projects/[id]:');
  const detailRes = await fetch(`${BASE_URL}/api/projects/${createdProject.id}`, {
    headers: { Cookie: cookie },
  });
  if (!detailRes.ok) {
    throw new Error(`GET /api/projects/[id] failed: ${detailRes.status}`);
  }
  const detailData = await detailRes.json();
  console.log('✅ Loaded project details for:', detailData.project.name);
  console.log('✅ Number of sites:', detailData.project.sites.length, '(Expected: 2)');
  console.log('✅ Estimated Total Cost:', detailData.financials.estimatedTotalCost);
  console.log('✅ Estimated Profit:', detailData.financials.estimatedProfit);

  if (detailData.project.sites.length !== 2) {
    throw new Error('Expected 2 sites (initial + added site)');
  }

  // 7. Test PUT /api/projects/[id] (Update project)
  console.log('\n7. Testing PUT /api/projects/[id]:');
  const updateRes = await fetch(`${BASE_URL}/api/projects/${createdProject.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      status: 'COMPLETED',
      notes: 'Final handover completed on schedule',
    }),
  });
  if (!updateRes.ok) {
    throw new Error(`Failed to update project: ${await updateRes.text()}`);
  }
  const updateData = await updateRes.json();
  console.log('✅ Project updated status to:', updateData.project.status);

  // 8. Test DELETE /api/projects/[id] (Soft Delete)
  console.log('\n8. Testing DELETE /api/projects/[id] (Soft Delete):');
  const delRes = await fetch(`${BASE_URL}/api/projects/${createdProject.id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  if (!delRes.ok) {
    throw new Error(`DELETE failed: ${delRes.status}`);
  }
  console.log('✅ Project archived successfully');

  // Verify archived project does not appear in active list
  const listAfterDel = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Cookie: cookie },
  });
  const listAfterData = await listAfterDel.json();
  const found = listAfterData.projects.some((p: any) => p.id === createdProject.id);
  if (found) {
    throw new Error('Archived project still visible in active projects list!');
  }
  console.log('✅ Verified archived project is excluded from active registry');

  console.log('\n🎉 ALL PHASE 2: PROJECTS & SITES TESTS PASSED!\n');
}

testProjects().catch((err) => {
  console.error('❌ Project tests failed:', err);
  process.exit(1);
});
