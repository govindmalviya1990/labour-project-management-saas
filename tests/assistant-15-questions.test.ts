import { matchRuleBased } from '../src/lib/ai/rule-based';
import { ToolExecutionContext } from '../src/lib/ai/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n======================================================');
console.log('--- TESTING 15 STANDARD QUESTIONS (RULE & TOOLS) ---');
console.log('======================================================\n');

const mockOwnerCtx: ToolExecutionContext = {
  organizationId: 'org_test_15',
  userId: 'usr_akshay',
  userName: 'Akshay Tak',
  userRole: 'OWNER',
};

async function testAll15Questions() {
  // Q1: Aaj kitna kharcha hua?
  console.log('1. Testing "Aaj kitna kharcha hua?"');
  const res1 = await matchRuleBased('Aaj kitna kharcha hua?', mockOwnerCtx);
  assert(res1.matched === true, 'Q1 matched as expense query');
  assert(res1.card?.type === 'EXPENSES', 'Q1 returns EXPENSES card');

  // Q2: Akshay Tak ke wallet mein kitna paisa hai?
  console.log('\n2. Testing "Akshay Tak ke wallet mein kitna paisa hai?"');
  const res2 = await matchRuleBased('Akshay Tak ke wallet mein kitna paisa hai?', mockOwnerCtx);
  assert(res2.matched === true, 'Q2 matched partner wallet');
  assert(res2.card?.type === 'PARTNERS', 'Q2 returns PARTNERS card');

  // Q3: Sonu Kumar ka kitna payment baki hai?
  console.log('\n3. Testing "Sonu Kumar ka kitna payment baki hai?"');
  const res3 = await matchRuleBased('Sonu Kumar ka kitna payment baki hai?', mockOwnerCtx);
  assert(res3.matched === true, 'Q3 matched worker ledger/dues');
  assert(res3.card?.type === 'SUMMARY', 'Q3 returns SUMMARY card');

  // Q4: Is mahine kis worker ko kitna payment diya?
  console.log('\n4. Testing "Is mahine kis worker ko kitna payment diya?"');
  const res4 = await matchRuleBased('Is mahine kis worker ko kitna payment diya?', mockOwnerCtx);
  assert(res4.matched === true, 'Q4 matched worker payouts');
  assert(res4.card?.type === 'SUMMARY', 'Q4 returns SUMMARY card');

  // Q5: Kis supplier ka kitna baaki hai?
  console.log('\n5. Testing "Kis supplier ka kitna baaki hai?"');
  const res5 = await matchRuleBased('Kis supplier ka kitna baaki hai?', mockOwnerCtx);
  assert(res5.matched === true, 'Q5 matched supplier ledger');
  assert(res5.card?.type === 'SUMMARY', 'Q5 returns SUMMARY card');
  assert(res5.card?.linkUrl === '/purchases', 'Q5 links to /purchases');

  // Q6: Sabse zyada kharcha kis category mein hua?
  console.log('\n6. Testing "Sabse zyada kharcha kis category mein hua?"');
  const res6 = await matchRuleBased('Sabse zyada kharcha kis category mein hua?', mockOwnerCtx);
  assert(res6.matched === true, 'Q6 matched top expense category');
  assert(res6.card?.type === 'EXPENSES', 'Q6 returns EXPENSES card');

  // Q7: Kal ki attendance dikhao
  console.log('\n7. Testing "Kal ki attendance dikhao"');
  const res7 = await matchRuleBased('Kal ki attendance dikhao', mockOwnerCtx);
  assert(res7.matched === true, 'Q7 matched attendance');
  assert(res7.card?.type === 'SUMMARY', 'Q7 returns SUMMARY card');
  assert(res7.card?.linkUrl === '/attendance', 'Q7 links to /attendance');

  // Q8: Rinku Kumar ka khata batao
  console.log('\n8. Testing "Rinku Kumar ka khata batao"');
  const res8 = await matchRuleBased('Rinku Kumar ka khata batao', mockOwnerCtx);
  assert(res8.matched === true, 'Q8 matched worker khata');
  assert(res8.card?.type === 'SUMMARY', 'Q8 returns SUMMARY card');

  // Q9: Cash in hand aur bank balance kitna hai?
  console.log('\n9. Testing "Cash in hand aur bank balance kitna hai?"');
  const res9 = await matchRuleBased('Cash in hand aur bank balance kitna hai?', mockOwnerCtx);
  assert(res9.matched === true, 'Q9 matched money position');
  assert(res9.card?.type === 'SUMMARY', 'Q9 returns SUMMARY card');
  assert(res9.card?.linkUrl === '/dashboard', 'Q9 links to /dashboard');

  // Q10: Project vastral ka total kharcha aur payment received kitna hai?
  console.log('\n10. Testing "Project vastral ka total kharcha aur payment received kitna hai?"');
  const res10 = await matchRuleBased('Project vastral ka total kharcha aur payment received kitna hai?', mockOwnerCtx);
  assert(res10.matched === true, 'Q10 matched project summary');
  assert(res10.card?.type === 'SUMMARY', 'Q10 returns SUMMARY card');
  assert(Boolean(res10.card?.linkUrl?.includes('/project')), 'Q10 links to /projects');

  // Q11: Is hafte ke petrol ke kharche dikhao
  console.log('\n11. Testing "Is hafte ke petrol ke kharche dikhao"');
  const res11 = await matchRuleBased('Is hafte ke petrol ke kharche dikhao', mockOwnerCtx);
  assert(res11.matched === true, 'Q11 matched petrol expense');
  assert(res11.card?.type === 'EXPENSES', 'Q11 returns EXPENSES card');

  // Q12: Kaun se workers ko advance baaki hai?
  console.log('\n12. Testing "Kaun se workers ko advance baaki hai?"');
  const res12 = await matchRuleBased('Kaun se workers ko advance baaki hai?', mockOwnerCtx);
  assert(res12.matched === true, 'Q12 matched worker advance dues list');
  assert(res12.card?.type === 'SUMMARY', 'Q12 returns SUMMARY card');
  assert(res12.card?.linkUrl === '/workers', 'Q12 links to /workers');

  // Q13: Rajesh Thakur ne kitne paise diye aur kisko?
  console.log('\n13. Testing "Rajesh Thakur ne kitne paise diye aur kisko?"');
  const res13 = await matchRuleBased('Rajesh Thakur ne kitne paise diye aur kisko?', mockOwnerCtx);
  assert(res13.matched === true, 'Q13 matched partner payouts inquiry');
  assert(res13.card?.type === 'SUMMARY', 'Q13 returns SUMMARY card');

  // Q14: Pichhle mahine ka total labour cost?
  console.log('\n14. Testing "Pichhle mahine ka total labour cost?"');
  const res14 = await matchRuleBased('Pichhle mahine ka total labour cost?', mockOwnerCtx);
  assert(res14.matched === true, 'Q14 matched payroll/labour summary');
  assert(res14.card?.type === 'SUMMARY', 'Q14 returns SUMMARY card');
  assert(res14.card?.linkUrl === '/attendance', 'Q14 links to /attendance');

  // Q15: Ek worker ko 500 rupaye advance do
  console.log('\n15. Testing "Ek worker ko 500 rupaye advance do" (Write Guardrail)');
  const res15 = await matchRuleBased('Ek worker ko 500 rupaye advance do', mockOwnerCtx);
  assert(res15.matched === true, 'Q15 matched as draft action');
  // It must be an ambiguous worker prompt OR a pending confirmation card. It must NEVER execute immediately!
  const isProtectedDraft = Boolean(res15.options?.length || res15.card?.draft?.status === 'PENDING' || res15.card?.type === 'CONFIRMATION');
  assert(isProtectedDraft, 'Q15 is protected behind worker selection or confirmation card (NEVER auto-executes)');

  console.log('\n======================================================');
  console.log('🎉 ALL 15 STANDARD QUESTIONS PASSED 100% SUCCESFULLY!');
  console.log('======================================================\n');
}

testAll15Questions().catch((err) => {
  console.error(err);
  process.exit(1);
});
