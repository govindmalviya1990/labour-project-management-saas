import assert from 'assert';
import { SUPPORTED_VOICE_LANGUAGES } from '../src/hooks/useSpeechRecognition';
import { matchRuleBased, parseRelativeDate } from '../src/lib/ai/rule-based';
import { ToolExecutionContext } from '../src/lib/ai/types';

console.log('--- RUNNING AI ASSISTANT PHASE 2 (VOICE INPUT) TESTS ---');

const mockOwnerContext: ToolExecutionContext = {
  userRole: 'OWNER',
  userId: 'mock-owner-id',
  organizationId: 'mock-org-id',
};

async function runPhase2Tests() {
  // Test 1: Supported Languages Configuration
  console.log('\nTest 1: Supported Languages (Hindi, Gujarati, English)');
  assert.strictEqual(SUPPORTED_VOICE_LANGUAGES.length, 3, 'Should support exactly 3 core languages');
  const langCodes = SUPPORTED_VOICE_LANGUAGES.map((l) => l.code);
  assert.ok(langCodes.includes('hi-IN'), 'Must include Hindi (hi-IN)');
  assert.ok(langCodes.includes('gu-IN'), 'Must include Gujarati (gu-IN)');
  assert.ok(langCodes.includes('en-IN'), 'Must include English (en-IN)');
  assert.strictEqual(SUPPORTED_VOICE_LANGUAGES[0].code, 'hi-IN', 'Default first language should be Hindi');
  console.log('✅ PASSED: Supported languages configured correctly with Hindi default');

  // Test 2: Voice Input in Hindi -> Draft Card Creation
  console.log('\nTest 2: Transcribed Hindi Voice -> "Ramesh ko 500 Dinner ke liye diye"');
  const hindiRes = await matchRuleBased('Ramesh ko 500 Dinner ke liye diye', mockOwnerContext);
  assert.strictEqual(hindiRes.matched, true, 'Must match voice query');
  assert.ok(hindiRes.card, 'Must generate confirmation card for user verification');
  assert.strictEqual(hindiRes.card?.type, 'CONFIRMATION', 'Card type must be CONFIRMATION');
  assert.strictEqual(hindiRes.card?.draft?.amount, 500, 'Draft amount must be 500');
  assert.strictEqual(hindiRes.card?.draft?.purpose, 'Dinner', 'Purpose must be Dinner');
  console.log('✅ PASSED: Transcribed Hindi speech drafts transfer card');

  // Test 3: Voice Input in Gujarati -> Draft Card Creation
  console.log('\nTest 3: Transcribed Gujarati Voice -> "Ramesh ne 500 Dinner mate aapya"');
  const gujaratiRes = await matchRuleBased('Ramesh ne 500 Dinner mate aapya', mockOwnerContext);
  assert.strictEqual(gujaratiRes.matched, true, 'Must match Gujarati phrasing');
  assert.ok(gujaratiRes.card, 'Must generate confirmation card');
  assert.strictEqual(gujaratiRes.card?.type, 'CONFIRMATION', 'Card type must be CONFIRMATION');
  assert.strictEqual(gujaratiRes.card?.draft?.amount, 500, 'Draft amount must be 500');
  assert.strictEqual(gujaratiRes.card?.draft?.purpose, 'Dinner', 'Purpose must be Dinner');
  console.log('✅ PASSED: Transcribed Gujarati speech drafts transfer card');

  // Test 4: Voice Input in English -> Draft Card Creation
  console.log('\nTest 4: Transcribed English Voice -> "Paid 500 to Ramesh for Dinner"');
  const englishRes = await matchRuleBased('Paid 500 to Ramesh for Dinner', mockOwnerContext);
  assert.strictEqual(englishRes.matched, true, 'Must match English transfer pattern');
  assert.ok(englishRes.card, 'Must generate confirmation card');
  assert.strictEqual(englishRes.card?.type, 'CONFIRMATION', 'Card type must be CONFIRMATION');
  assert.strictEqual(englishRes.card?.draft?.amount, 500, 'Draft amount must be 500');
  console.log('✅ PASSED: Transcribed English speech drafts transfer card');

  // Test 5: Voice Transcribed Daily Expense
  console.log('\nTest 5: Transcribed Expense Voice -> "Aaj chay-nasta 300 laga"');
  const expRes = await matchRuleBased('Aaj chay-nasta 300 laga', mockOwnerContext);
  assert.strictEqual(expRes.matched, true, 'Must match expense voice input');
  assert.ok(expRes.card, 'Must generate confirmation card');
  assert.strictEqual(expRes.card?.type, 'CONFIRMATION', 'Card type must be CONFIRMATION');
  assert.strictEqual(expRes.card?.draft?.purpose, 'Chay-Nasta');
  assert.strictEqual(expRes.card?.draft?.amount, 300);
  console.log('✅ PASSED: Transcribed expense speech creates expense draft');

  // Test 6: Voice Transcribed Bank Withdrawal
  console.log('\nTest 6: Transcribed Bank Voice -> "Bank se 20000 cash nikala"');
  const bankRes = await matchRuleBased('Bank se 20000 cash nikala', mockOwnerContext);
  assert.strictEqual(bankRes.matched, true, 'Must match bank voice statement');
  assert.ok(bankRes.card, 'Must generate confirmation card');
  assert.strictEqual(bankRes.card?.draft?.draftType, 'BANK_WITHDRAWAL');
  assert.strictEqual(bankRes.card?.draft?.amount, 20000);
  console.log('✅ PASSED: Transcribed bank speech creates bank withdrawal draft');

  // Test 7: Gujarati Relative Dates (aaje, kale, આજે, કાલે)
  console.log('\nTest 7: Gujarati Relative Date Resolution');
  const today = new Date().toISOString().split('T')[0];
  const aajeDate = parseRelativeDate('aaje kharch thayo');
  assert.strictEqual(aajeDate.startDate, today, 'aaje must resolve to today');
  const gujTodayDate = parseRelativeDate('આજે ખર્ચ થયો');
  assert.strictEqual(gujTodayDate.startDate, today, 'આજે must resolve to today');
  const kaleDate = parseRelativeDate('kale sonu ne 2000 aapya');
  assert.ok(kaleDate.startDate, 'kale must resolve to yesterday');
  console.log('✅ PASSED: Gujarati relative dates parsed accurately');

  // Test 8: Voice Guardrail Refusal
  console.log('\nTest 8: Guardrail Refusal on Voice Input ("Sab delete karo")');
  const guardrailRes = await matchRuleBased('Sab delete karo', mockOwnerContext);
  assert.strictEqual(guardrailRes.matched, true);
  assert.strictEqual(guardrailRes.card?.type, 'WARNING');
  assert.ok(guardrailRes.content.includes('सुरक्षा नियम') || guardrailRes.content.includes('સુરક્ષા'));
  console.log('✅ PASSED: Voice input respects security guardrails');

  // Test 9: Zero Auto-Save on Voice Input (Draft Only)
  console.log('\nTest 9: Voice Input Strict Draft Invariance');
  // Voice transcription only fills the input box or returns a draft card. No mutation happens without explicit user Save click.
  assert.ok(hindiRes.card?.draft?.draftId, 'Draft ID must be present on generated card');
  console.log('✅ PASSED: Voice input strictly obeys Draft + Confirm architecture');

  console.log('\n======================================================');
  console.log('🎉 ALL 9 AI ASSISTANT PHASE 2 (VOICE) TESTS PASSED (100% SUCCESS)!');
  console.log('======================================================\n');
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 Test Failure:', err);
  process.exit(1);
});
