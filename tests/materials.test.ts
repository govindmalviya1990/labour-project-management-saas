async function testMaterials() {
  console.log('--- STARTING PHASE 5: MATERIALS & INVENTORY TESTS ---');

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

  // 2. Fetch projects for testing
  const projRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Cookie: cookie },
  });
  const projData = await projRes.json();
  if (!projData.projects || projData.projects.length < 2) {
    throw new Error('At least 2 projects required for testing transfer');
  }
  const project1 = projData.projects[0];
  const project2 = projData.projects[1];
  console.log(`✅ Loaded Project 1: ${project1.name} (${project1.id})`);
  console.log(`✅ Loaded Project 2: ${project2.name} (${project2.id})`);

  // 3. Register a Supplier
  console.log('\n3. Testing POST /api/materials/suppliers:');
  const supRes = await fetch(`${BASE_URL}/api/materials/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      name: 'UltraTech Cement Authorized Agency',
      contactPerson: 'Kailash Mehra',
      mobile: '9822011223',
      email: 'sales@ultratechagency.com',
      address: 'Plot 42, Industrial Area, Pune',
      gstNumber: '27AABCU1234F1Z8',
    }),
  });
  if (!supRes.ok) throw new Error(`Create supplier failed: ${await supRes.text()}`);
  const supData = await supRes.json();
  const supplierId = supData.supplier.id;
  console.log('✅ Supplier registered successfully:', supData.supplier.name);

  // 4. Register a Material in Catalog
  console.log('\n4. Testing POST /api/materials:');
  const uniqueCode = `CEM-TST-${Date.now().toString().slice(-4)}`;
  const matRes = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      materialCode: uniqueCode,
      name: 'UltraTech PPC 53 Grade',
      category: 'Cement',
      unit: 'bags',
      openingStock: 0,
      minimumStock: 25,
      purchaseRate: 380,
      supplierId: supplierId,
      notes: 'Standard 50kg bag for structural concrete',
    }),
  });
  if (!matRes.ok) throw new Error(`Create material failed: ${await matRes.text()}`);
  const matData = await matRes.json();
  const materialId = matData.material.id;
  console.log(`✅ Material registered: ${matData.material.name} (${uniqueCode})`);

  // Test duplicate code prevention
  const dupRes = await fetch(`${BASE_URL}/api/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      materialCode: uniqueCode,
      name: 'Duplicate Material',
    }),
  });
  if (dupRes.status === 409) {
    console.log('✅ Duplicate material code rejected with 409 Conflict');
  } else {
    throw new Error('Duplicate material code was not rejected!');
  }

  // 5. Receive 100 bags on Project 1 (GRN)
  console.log('\n5. Testing POST /api/materials/receipts:');
  const receiptRes = await fetch(`${BASE_URL}/api/materials/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      projectId: project1.id,
      materialId: materialId,
      supplierId: supplierId,
      date: new Date().toISOString().split('T')[0],
      quantity: 100,
      purchaseRate: 380,
      invoiceNumber: 'INV-2024-001',
      notes: 'Delivered by truck MH12-AB-1234',
    }),
  });
  if (!receiptRes.ok) throw new Error(`Receipt failed: ${await receiptRes.text()}`);
  const receiptData = await receiptRes.json();
  console.log(`✅ Receipt recorded: 100 bags received at ${project1.name}. Total cost: ₹${receiptData.receipt.totalCost}`);
  if (receiptData.receipt.totalCost !== 38000) {
    throw new Error(`Expected total cost 38000, got ${receiptData.receipt.totalCost}`);
  }

  // Verify Project 1 stock is now 100 bags
  const stockCheck1 = await fetch(`${BASE_URL}/api/materials?projectId=${project1.id}`, {
    headers: { Cookie: cookie },
  });
  const stockData1 = await stockCheck1.json();
  const matInProj1 = stockData1.materials.find((m: any) => m.id === materialId);
  console.log(`✅ Verified Project 1 remaining stock: ${matInProj1?.remainingStock} bags (Expected: 100)`);
  if (matInProj1?.remainingStock !== 100) {
    throw new Error(`Expected Project 1 stock 100, got ${matInProj1?.remainingStock}`);
  }

  // 6. Test Negative Stock Prevention (Section 25)
  console.log('\n6. Testing Negative Stock Prevention (Prompt Section 25):');
  // Attempt to use 150 bags when only 100 are available
  const overUseRes = await fetch(`${BASE_URL}/api/materials/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      projectId: project1.id,
      materialId: materialId,
      date: new Date().toISOString().split('T')[0],
      quantity: 150,
      taskPurpose: 'Foundation concrete',
    }),
  });
  if (overUseRes.status === 400) {
    const overUseData = await overUseRes.json();
    console.log(`✅ Over-usage prevented with 400 Bad Request. Alert: "${overUseData.error}"`);
    if (!overUseData.error.includes('Cannot use 150 bags')) {
      throw new Error(`Unexpected error message: ${overUseData.error}`);
    }
  } else {
    throw new Error(`Negative stock was NOT prevented! Status: ${overUseRes.status}`);
  }

  // 7. Consume 30 bags legitimately on Project 1
  console.log('\n7. Testing POST /api/materials/usage (Legitimate consumption):');
  const usageRes = await fetch(`${BASE_URL}/api/materials/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      projectId: project1.id,
      materialId: materialId,
      date: new Date().toISOString().split('T')[0],
      quantity: 30,
      taskPurpose: 'Column casting Ground Floor',
      notes: 'Poured with 1:1.5:3 mix',
    }),
  });
  if (!usageRes.ok) throw new Error(`Usage failed: ${await usageRes.text()}`);
  const usageData = await usageRes.json();
  console.log(`✅ Consumption recorded: Used 30 bags. New remaining stock: ${usageData.remainingStock} bags`);
  if (usageData.remainingStock !== 70) {
    throw new Error(`Expected remaining stock 70, got ${usageData.remainingStock}`);
  }

  // 8. Test Inter-Project Material Transfer (Section 26 & Section 67)
  console.log('\n8. Testing Inter-Project Transfer (Prompt Section 26 & 67):');
  // Transfer 50 bags from Project 1 to Project 2
  const transferRes = await fetch(`${BASE_URL}/api/materials/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      sourceProjectId: project1.id,
      destinationProjectId: project2.id,
      materialId: materialId,
      date: new Date().toISOString().split('T')[0],
      quantity: 50,
      notes: 'Transfer excess cement to active slab casting site',
    }),
  });
  if (!transferRes.ok) throw new Error(`Transfer failed: ${await transferRes.text()}`);
  const transferData = await transferRes.json();
  console.log(`✅ Transfer executed: ${transferData.message}`);

  // Check Project 1 stock after transfer: should be 70 - 50 = 20 bags
  const stockCheckP1 = await fetch(`${BASE_URL}/api/materials?projectId=${project1.id}`, {
    headers: { Cookie: cookie },
  });
  const matAfterP1 = (await stockCheckP1.json()).materials.find((m: any) => m.id === materialId);
  console.log(`✅ Project 1 Stock after transfer: ${matAfterP1?.remainingStock} bags (Expected: 20)`);
  if (matAfterP1?.remainingStock !== 20) {
    throw new Error(`Expected Project 1 stock 20, got ${matAfterP1?.remainingStock}`);
  }

  // Check Project 2 stock after transfer: should be 0 + 50 = 50 bags
  const stockCheckP2 = await fetch(`${BASE_URL}/api/materials?projectId=${project2.id}`, {
    headers: { Cookie: cookie },
  });
  const matAfterP2 = (await stockCheckP2.json()).materials.find((m: any) => m.id === materialId);
  console.log(`✅ Project 2 Stock after transfer: ${matAfterP2?.remainingStock} bags (Expected: 50)`);
  if (matAfterP2?.remainingStock !== 50) {
    throw new Error(`Expected Project 2 stock 50, got ${matAfterP2?.remainingStock}`);
  }

  // 9. Verify Low Stock Alert Trigger (Minimum stock is 25, Project 1 has 20 <= 25)
  console.log('\n9. Testing Low Stock Alert Threshold:');
  console.log(`✅ Project 1 Low Stock status: ${matAfterP1?.isLowStock ? 'ALERT ACTIVE (True)' : 'False'}`);
  if (!matAfterP1?.isLowStock) {
    throw new Error('Expected low stock alert to be active for Project 1 (20 <= 25)!');
  }

  // 10. Verify NO purchase expense was created for Project 2 due to transfer (Section 67)
  console.log('\n10. Verifying Section 67 Rule (No purchase expense created on transfer):');
  const p2ExpensesRes = await fetch(`${BASE_URL}/api/finance/expenses?projectId=${project2.id}`, {
    headers: { Cookie: cookie },
  });
  const p2Expenses = await p2ExpensesRes.json();
  const transferExpense = p2Expenses.expenses?.find((e: any) => e.description?.includes(uniqueCode) || e.description?.includes('Transfer'));
  if (transferExpense) {
    throw new Error('Violation of Section 67: Purchase expense was improperly created for material transfer!');
  }
  console.log('✅ Verified: Zero purchase expenses created on destination project for transfer.');

  console.log('\n🎉 ALL PHASE 5: MATERIALS & INVENTORY TESTS PASSED PERFECTLY!\n');
}

testMaterials().catch((err) => {
  console.error('❌ PHASE 5 TEST FAILED:', err);
  process.exit(1);
});
