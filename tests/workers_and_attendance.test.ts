async function testWorkersAndAttendance() {
  console.log('--- STARTING PHASE 3: WORKERS, ATTENDANCE, WORK & PRODUCTIVITY TESTS ---');

  const BASE_URL = 'http://localhost:3000';

  // 1. Login
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

  // 2. Fetch Workers List
  console.log('\n2. Testing GET /api/workers:');
  const workersRes = await fetch(`${BASE_URL}/api/workers`, {
    headers: { Cookie: cookie },
  });
  if (!workersRes.ok) throw new Error(`GET /api/workers failed: ${workersRes.status}`);
  const workersData = await workersRes.json();
  console.log('✅ Retrieved workers count:', workersData.workers.length);
  console.log('✅ Active workers:', workersData.summary.activeWorkers);
  console.log('✅ Avg daily wage:', workersData.summary.avgDailyWage);

  // 3. Register New Worker
  console.log('\n3. Testing POST /api/workers:');
  const testWorkerCode = `WRK-T${Date.now().toString().slice(-4)}`;
  const createWorkerRes = await fetch(`${BASE_URL}/api/workers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      name: 'Mohan Lal',
      workerCode: testWorkerCode,
      category: 'Flooring Worker',
      dailyWage: 850,
      wageUnit: 'PER_DAY',
      mobile: '9876543299',
    }),
  });
  if (!createWorkerRes.ok) {
    throw new Error(`Failed to create worker: ${await createWorkerRes.text()}`);
  }
  const createWorkerData = await createWorkerRes.json();
  const createdWorker = createWorkerData.worker;
  console.log('✅ Worker created:', createdWorker.name, 'Code:', createdWorker.workerCode);

  // 4. Duplicate Worker Code Rejection
  console.log('\n4. Testing Duplicate Worker Code Rejection:');
  const dupRes = await fetch(`${BASE_URL}/api/workers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      name: 'Duplicate Worker',
      workerCode: testWorkerCode,
      dailyWage: 500,
    }),
  });
  if (dupRes.status !== 409) {
    throw new Error(`Expected 409 for duplicate worker code, got: ${dupRes.status}`);
  }
  console.log('✅ Duplicate worker code rejected with 409 Conflict');

  // 5. Fetch Projects for Attendance
  const projRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Cookie: cookie },
  });
  const projData = await projRes.json();
  const testProject = projData.projects[0];
  if (!testProject) throw new Error('No test project available');

  // 6. Test Daily Attendance Sheet (GET & POST)
  console.log('\n5. Testing Attendance Sheet API:');
  const todayStr = new Date().toISOString().split('T')[0];

  const sheetRes = await fetch(
    `${BASE_URL}/api/attendance?date=${todayStr}&projectId=${testProject.id}`,
    { headers: { Cookie: cookie } }
  );
  if (!sheetRes.ok) throw new Error(`GET /api/attendance failed: ${sheetRes.status}`);
  const sheetData = await sheetRes.json();
  console.log('✅ Sheet loaded with worker count:', sheetData.sheet.length);

  // Mark attendance for createdWorker: HALF_DAY with 2 hours overtime
  // Daily wage = 850. Half day = 425. Overtime = (850 / 8) * 2 = 212.5. Total = 637.5.
  console.log('\n6. Testing Save Attendance Sheet:');
  const saveAttRes = await fetch(`${BASE_URL}/api/attendance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      date: todayStr,
      projectId: testProject.id,
      records: [
        {
          workerId: createdWorker.id,
          status: 'HALF_DAY',
          shift: 'DAY',
          overtimeHours: 2,
        },
      ],
    }),
  });

  if (!saveAttRes.ok) {
    throw new Error(`POST /api/attendance failed: ${await saveAttRes.text()}`);
  }
  console.log('✅ Saved attendance for worker');

  // Verify attendance record and calculated wage
  const verifySheetRes = await fetch(
    `${BASE_URL}/api/attendance?date=${todayStr}&projectId=${testProject.id}`,
    { headers: { Cookie: cookie } }
  );
  const verifySheetData = await verifySheetRes.json();
  const savedItem = verifySheetData.sheet.find((s: any) => s.workerId === createdWorker.id);
  console.log('✅ Attendance verified status:', savedItem.status);
  console.log('✅ Attendance calculated wage for day:', savedItem.wageForDay, '(Expected: 637.5)');
  if (savedItem.wageForDay !== 637.5) {
    throw new Error(`Expected wage 637.5, got: ${savedItem.wageForDay}`);
  }

  // 7. Test Work Records & Formula (Prompt Section 15: 450 * 12 = ₹5,400)
  console.log('\n7. Testing POST /api/work (Work Quantity * Rate formula):');
  const workRes = await fetch(`${BASE_URL}/api/work`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      date: todayStr,
      projectId: testProject.id,
      workerId: createdWorker.id,
      task: 'Flooring',
      description: 'Living room vitrified tiles installation',
      quantity: 450,
      unit: 'sq.ft.',
      rate: 12,
    }),
  });

  if (!workRes.ok) throw new Error(`POST /api/work failed: ${await workRes.text()}`);
  const workData = await workRes.json();
  console.log('✅ Work record logged:', workData.record.task);
  console.log('✅ Total Work Value:', workData.record.totalWorkValue, '(Expected: 5400)');
  if (workData.record.totalWorkValue !== 5400) {
    throw new Error(`Expected total work value 5400, got: ${workData.record.totalWorkValue}`);
  }

  // 8. Test Worker Productivity API (Prompt Section 16)
  console.log('\n8. Testing GET /api/productivity:');
  const prodRes = await fetch(`${BASE_URL}/api/productivity`, {
    headers: { Cookie: cookie },
  });
  if (!prodRes.ok) throw new Error(`GET /api/productivity failed: ${prodRes.status}`);
  const prodData = await prodRes.json();
  const workerProd = prodData.productivity.find((p: any) => p.workerId === createdWorker.id);
  console.log('✅ Productivity found for worker:', workerProd.name);
  console.log('✅ Days worked:', workerProd.daysWorked);
  console.log('✅ Total quantity:', workerProd.totalQuantity, workerProd.unit);
  console.log('✅ Work Value:', workerProd.workValue);

  console.log('\n🎉 ALL PHASE 3: WORKERS, ATTENDANCE, WORK & PRODUCTIVITY TESTS PASSED!\n');
}

testWorkersAndAttendance().catch((err) => {
  console.error('❌ Phase 3 tests failed:', err);
  process.exit(1);
});
