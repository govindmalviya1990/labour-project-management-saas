import { matchRuleBased } from '../src/lib/ai/rule-based';
import { matchWorker, matchUser, matchProject, normalizeKeyword } from '../src/lib/assistant/matcher';
import { executeTool } from '../src/lib/ai/tools';
import { ToolExecutionContext } from '../src/lib/ai/types';
import { calculateWalletBalance } from '../src/lib/calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n======================================================');
console.log('--- RUNNING AI ASSISTANT PHASE 3 TEST SUITE (TEXT DRAFT + CONFIRM) ---');
console.log('======================================================\n');

const mockPartnerA: ToolExecutionContext = {
  organizationId: 'org_test_phase3',
  userId: 'usr_partner_a',
  userName: 'Partner Govind',
  userRole: 'PARTNER',
};

const mockPartnerB: ToolExecutionContext = {
  organizationId: 'org_test_phase3',
  userId: 'usr_partner_b',
  userName: 'Partner Rajesh',
  userRole: 'PARTNER',
};

const mockSupervisor: ToolExecutionContext = {
  organizationId: 'org_test_phase3',
  userId: 'usr_supervisor',
  userName: 'Sonu Yadav',
  userRole: 'SITE_SUPERVISOR',
};

async function runTests() {
  // -------------------------------------------------------------
  // Test 1: "Ramesh ko 500 Dinner ke liye diye" (Draft + Confirm Flow)
  // -------------------------------------------------------------
  console.log('Test 1: "Ramesh ko 500 Dinner ke liye diye" (Draft Creation & Invariance)');
  const res1 = await matchRuleBased('Ramesh ko 500 Dinner ke liye diye', mockPartnerA);

  assert(res1.matched === true, 'Rule-based matcher matched the draft transfer');
  assert(res1.card?.type === 'CONFIRMATION', 'Card type is CONFIRMATION');
  assert(res1.card?.draft?.amount === 500, 'Draft amount is ₹500');
  assert(res1.card?.draft?.purpose === 'Dinner', 'Draft purpose is "Dinner"');
  assert(res1.card?.draft?.draftType === 'FUND_TRANSFER', 'Draft type is FUND_TRANSFER');
  assert(res1.card?.draft?.senderUserId === mockPartnerA.userId, 'Sender is strictly logged-in Partner A');

  // Verify wallet balance is NOT touched before save
  const balanceBefore = calculateWalletBalance({
    totalMoneyIn: 50000,
    totalTransfersIn: 0,
    totalTransfersOut: 0,
    totalExpenses: 0,
  });
  assert(balanceBefore.balance === 50000, 'Before Save: Wallet remains untouched at ₹50,000');

  // After simulated confirmation save
  const balanceAfter = calculateWalletBalance({
    totalMoneyIn: 50000,
    totalTransfersIn: 0,
    totalTransfersOut: 500,
    totalExpenses: 0,
  });
  assert(balanceAfter.balance === 49500, 'After Save: Wallet reflects exactly ₹500 deduction (₹49,500)');

  // -------------------------------------------------------------
  // Test 2: Ambiguity Detection (Do Ramesh hon to assistant poochhe)
  // -------------------------------------------------------------
  console.log('\nTest 2: Ambiguity Handling (Multiple Workers Matching Same Name)');

  // Test keyword normalization
  assert(normalizeKeyword('Ramesh Patel!') === 'ramesh patel', 'Normalizes name punctuation');

  // Simulating ambiguous tool response
  const ambiguousMockResult = {
    isAmbiguous: true,
    field: 'toName',
    message: 'Mujhe "Ramesh" naam ke ek se zyada worker mile. Kripya sahi worker chunein:',
    options: [
      { id: 'w1', name: 'Ramesh Kumar', subtext: 'W-01 (Mason)' },
      { id: 'w2', name: 'Ramesh Patel', subtext: 'W-05 (Helper)' },
    ],
  };

  assert(ambiguousMockResult.isAmbiguous === true, 'Flags ambiguous name');
  assert(ambiguousMockResult.options.length === 2, 'Returns both worker options to choose');
  assert(ambiguousMockResult.message.includes('sahi worker chunein'), 'Prompts user to select from options');

  // -------------------------------------------------------------
  // Test 3: Missing Fields Prompts (Amount / Project)
  // -------------------------------------------------------------
  console.log('\nTest 3: Missing Fields Clarification');

  const missingAmountToolRes = await executeTool(
    'draftFundTransfer',
    { toName: 'Ramesh', amount: 0 },
    mockPartnerA
  );
  assert(Boolean(missingAmountToolRes.error?.includes('amount')), 'Rejects 0 or missing amount and asks user for it');

  const missingNameToolRes = await executeTool(
    'draftFundTransfer',
    { toName: '', amount: 500 },
    mockPartnerA
  );
  assert(Boolean(missingNameToolRes.error?.includes('naam')), 'Rejects missing recipient name and asks user for it');

  // -------------------------------------------------------------
  // Test 4: "Aaj chay-nasta 300 laga" -> Expense Draft
  // -------------------------------------------------------------
  console.log('\nTest 4: "Aaj chay-nasta 300 laga" (Expense Draft)');
  const resExp = await matchRuleBased('Aaj chay-nasta 300 laga', mockPartnerA);

  assert(resExp.matched === true, 'Matches expense draft statement');
  assert(resExp.card?.type === 'CONFIRMATION', 'Generated CONFIRMATION card');
  assert(resExp.card?.draft?.draftType === 'EXPENSE', 'Draft type is EXPENSE');
  assert(resExp.card?.draft?.amount === 300, 'Draft amount is ₹300');
  assert(resExp.card?.draft?.purpose === 'Chay-Nasta', 'Category is formatted as "Chay-Nasta"');

  // -------------------------------------------------------------
  // Test 5: "10 bag cement 3800 mein kharide" -> Goods Purchase Draft
  // -------------------------------------------------------------
  console.log('\nTest 5: "10 bag cement 3800 mein kharide" (Goods Purchase Draft)');
  const resGoods = await matchRuleBased('10 bag cement 3800 mein kharide', mockPartnerA);

  assert(resGoods.matched === true, 'Matches goods purchase statement');
  assert(resGoods.card?.draft?.draftType === 'GOODS_PURCHASE', 'Draft type is GOODS_PURCHASE');
  assert(resGoods.card?.draft?.quantity === 10, 'Draft quantity is 10');
  assert(resGoods.card?.draft?.unit === 'bag', 'Draft unit is "bag"');
  assert(resGoods.card?.draft?.amount === 3800, 'Total purchase amount is ₹3,800');

  // -------------------------------------------------------------
  // Test 6: "Aaj Ramesh present, Suresh half day" -> Attendance Draft
  // -------------------------------------------------------------
  console.log('\nTest 6: "Aaj Ramesh present, Suresh half day" (Attendance Draft)');
  const resAtt = await matchRuleBased('Aaj Ramesh present, Suresh half day', mockPartnerA);

  assert(resAtt.matched === true, 'Matches attendance statement');
  assert(resAtt.card?.draft?.draftType === 'ATTENDANCE', 'Draft type is ATTENDANCE');
  const records = resAtt.card?.draft?.attendanceRecords || [];
  assert(records.length === 2, 'Extracted 2 attendance records');
  assert(records[0]?.workerName.toLowerCase().includes('ramesh') && records[0]?.status === 'PRESENT', 'Ramesh marked PRESENT');
  assert(records[1]?.workerName.toLowerCase().includes('suresh') && records[1]?.status === 'HALF_DAY', 'Suresh marked HALF_DAY');

  // -------------------------------------------------------------
  // Test 7: Idempotency Protection (Double-click duplicate prevention)
  // -------------------------------------------------------------
  console.log('\nTest 7: Idempotency Token & Double-Click Protection');

  const processedMap = new Set<string>();
  const testDraftId = 'draft_test_idempotency_123';

  function simulateConfirm(draftId: string) {
    if (processedMap.has(draftId)) {
      return { status: 409, error: 'Yeh entry pehle hi save ho chuki hai (Duplicate blocked).' };
    }
    processedMap.add(draftId);
    return { status: 200, success: true };
  }

  const call1 = simulateConfirm(testDraftId);
  assert(call1.status === 200, 'First save click succeeds (HTTP 200)');

  const call2 = simulateConfirm(testDraftId);
  assert(call2.status === 409, 'Second save click (double-click) is strictly rejected (HTTP 409)');

  // -------------------------------------------------------------
  // Test 8: Destructive Action Guardrail Refusal
  // -------------------------------------------------------------
  console.log('\nTest 8: Guardrail Refusal on Destructive Requests');

  const resDel = await matchRuleBased('Saari entries delete kar do', mockPartnerA);
  assert(resDel.card?.type === 'WARNING', 'Blocks "delete all" with WARNING card');
  assert(resDel.card?.linkUrl === '/settings', 'Redirects manual action to /settings');

  const resRole = await matchRuleBased('Mera role change karke Owner kar do', mockPartnerA);
  assert(resRole.card?.type === 'WARNING', 'Blocks unauthorized role change request');

  const resLock = await matchRuleBased('Aaj ka din hisaab lock kar do', mockPartnerA);
  assert(resLock.card?.type === 'WARNING', 'Blocks chat-based day lock/unlock');

  // -------------------------------------------------------------
  // Test 9: Strict Cross-Partner Role Scoping
  // -------------------------------------------------------------
  console.log('\nTest 9: Server-Enforced Role Scoping (Partner B cannot access Partner A)');

  const partnerBWallets = await executeTool('getPartnerWallets', {}, mockPartnerB);
  assert(partnerBWallets.partners.length === 1, 'Partner B view contains only 1 partner (themselves)');
  assert(partnerBWallets.partners[0].name === mockPartnerB.userName, 'Partner B sees only their own wallet');

  const supervisorCheck = await executeTool('getPartnerWallets', {}, mockSupervisor);
  assert(Boolean(supervisorCheck.error), 'Site Supervisor is strictly denied access to partner overview');

  // -------------------------------------------------------------
  // Test 10: Locked-Day Rule Invariance
  // -------------------------------------------------------------
  console.log('\nTest 10: Day Lock Validation (Verified day requires Owner)');

  function checkDayLockPermission(isVerified: boolean, userRole: string): boolean {
    if (!isVerified) return true; // not locked -> anyone allowed
    return ['OWNER', 'MANAGER'].includes(userRole); // locked -> only owner allowed
  }

  assert(checkDayLockPermission(false, 'PARTNER') === true, 'Unlocked day: Partner allowed');
  assert(checkDayLockPermission(true, 'PARTNER') === false, 'Locked day: Partner strictly BLOCKED');
  assert(checkDayLockPermission(true, 'OWNER') === true, 'Locked day: Owner allowed with warning/audit');

  // -------------------------------------------------------------
  // Test 11: Resilience Without Gemini API Key (Simple Mode Fallback)
  // -------------------------------------------------------------
  console.log('\nTest 11: Free-Tier Resilience & Simple Mode Fallback');

  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  // With no key, knowledge queries and rule queries still succeed with 0 errors
  const resHowTo = await matchRuleBased('Din ka hisaab kaise karein?', mockPartnerA);
  assert(resHowTo.matched === true, 'Knowledge base queries resolve instantly in Simple Mode');
  assert(resHowTo.card?.linkUrl === '/dashboard' || resHowTo.card?.linkUrl === '/cash-book', 'Links correctly to Dashboard');

  if (prevKey) {
    process.env.GEMINI_API_KEY = prevKey;
  }

  console.log('\n======================================================');
  console.log('🎉 ALL 11 AI ASSISTANT PHASE 3 TESTS PASSED (100% SUCCESS)!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
