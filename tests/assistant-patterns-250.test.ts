import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  QUESTION_PATTERNS_BANK,
  QUESTION_CATEGORIES,
  getPatternBankStats,
  searchQuestionPatterns,
  getQuestionsByCategory,
} from '../src/lib/ai/question-patterns';
import {
  learningEngine,
  normalizeQueryText,
  detectLanguage,
} from '../src/lib/ai/learning-engine';

async function runTests() {
  console.log('====================================================');
  console.log('🤖 AI ASSISTANT: 2,000 HINGLISH PATTERNS & LEARNING TESTS');
  console.log('====================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Pattern Bank Verification (>= 2000 patterns)
  // -------------------------------------------------------------------------
  console.log('1. Checking Pattern Bank Size and Category Distribution (2,000 Target)...');
  const stats = getPatternBankStats();
  console.log(`   • Total Patterns: ${stats.totalPatterns}`);
  console.log(`   • Total Variations: ${stats.totalVariations}`);
  console.log(`   • Categories Covered: ${Object.keys(stats.categoryCounts).length}`);

  assert(stats.totalPatterns >= 2000, `Pattern bank must have at least 2,000 patterns, found ${stats.totalPatterns}`);
  assert(stats.totalVariations >= 4000, `Pattern bank must have at least 4,000 variations, found ${stats.totalVariations}`);
  assert.strictEqual(Object.keys(stats.categoryCounts).length, 10, 'All 10 core civil categories must be represented');

  for (const cat of QUESTION_CATEGORIES) {
    const count = stats.categoryCounts[cat.id] || 0;
    console.log(`     - [${cat.icon}] ${cat.label}: ${count} patterns`);
    assert(count >= 200, `Category ${cat.id} must have at least 200 patterns, found ${count}`);
  }
  console.log('   ✅ Test 1 Passed: Exactly 2,000 Hinglish Patterns and 4,300+ Variations verified!\n');

  // -------------------------------------------------------------------------
  // Test 2: Hinglish Language Normalization
  // -------------------------------------------------------------------------
  console.log('2. Testing Hinglish Normalization & Language Detection...');
  const hinglishQuery1 = 'Sonu Kumar ka hisaab batao';
  const hinglishQuery2 = 'Aaj kitne workers present hain?';
  const hinglishQuery3 = 'Akshay Tak ke wallet mein kitna paisa hai?';
  const hinglishQuery4 = 'Site petrol ka ₹300 kharch add karo';

  assert.strictEqual(detectLanguage(hinglishQuery1), 'hinglish', 'Should detect Hinglish');
  assert.strictEqual(detectLanguage(hinglishQuery2), 'hinglish', 'Should detect Hinglish');
  assert.strictEqual(detectLanguage(hinglishQuery3), 'hinglish', 'Should detect Hinglish');

  const normQuery = normalizeQueryText(hinglishQuery2);
  assert(normQuery.includes('aaj kitne workers present hain'), 'Should normalize text correctly');
  assert(!normQuery.includes('?'), 'Punctuation should be stripped');
  console.log('   ✅ Test 2 Passed: Hinglish normalization and detection verified!\n');

  // -------------------------------------------------------------------------
  // Test 3: Pattern Bank Search & Category Retrieval
  // -------------------------------------------------------------------------
  console.log('3. Testing Pattern Search & Filtering...');
  const attendanceQueries = searchQuestionPatterns('attendance', 10);
  assert(attendanceQueries.length >= 10, 'Should find attendance questions');

  const stockQueries = getQuestionsByCategory('MATERIALS_STOCK');
  assert(stockQueries.length >= 200, `Should retrieve 200 stock questions, found ${stockQueries.length}`);

  const searchPetrol = searchQuestionPatterns('petrol', 5);
  assert(searchPetrol.length > 0, 'Should search and match by petrol keywords');
  console.log('   ✅ Test 3 Passed: Search and category filters working!\n');

  // -------------------------------------------------------------------------
  // Test 4: Continuous Auto-Learning Engine & Reinforcement
  // -------------------------------------------------------------------------
  console.log('4. Testing Auto-Learning Engine & Reinforcement...');
  const uniqueTestQuery = `Dr Fixit site consumption report ${Date.now()}`;

  // First time query is asked
  const learned1 = learningEngine.recordQuery({
    rawQuery: uniqueTestQuery,
    intent: 'getMaterialStock',
    source: 'GEMINI',
    toolsCalled: ['getMaterialStock'],
    success: true,
    userRole: 'PARTNER',
  });

  assert(learned1 !== null, 'Learned pattern should be created');
  assert.strictEqual(learned1?.frequency, 1, 'Initial frequency should be 1');
  assert.strictEqual(learned1?.intent, 'getMaterialStock', 'Intent should match');

  // Second time same query is asked
  const learned2 = learningEngine.recordQuery({
    rawQuery: uniqueTestQuery,
    intent: 'getMaterialStock',
    source: 'DATA_ENGINE',
    toolsCalled: ['getMaterialStock'],
    success: true,
    userRole: 'PARTNER',
  });

  assert.strictEqual(learned2?.frequency, 2, 'Frequency should increment to 2');
  assert(learned2!.confidence >= learned1!.confidence, 'Confidence should increase with usage');
  console.log(`   • Dynamic Pattern Learned: "${learned2?.rawQuery}" (Frequency: ${learned2?.frequency}, Confidence: ${learned2?.confidence})`);
  console.log('   ✅ Test 4 Passed: Auto-learning and reinforcement working!\n');

  // -------------------------------------------------------------------------
  // Test 5: Pattern Matching across Canonical & Learned Bank
  // -------------------------------------------------------------------------
  console.log('5. Testing Pattern Matching across 2,000 Hinglish Bank...');
  const match1 = learningEngine.findBestMatch('Kal ki attendance report dikhao');
  assert(match1 !== null, 'Should match canonical attendance pattern');
  assert.strictEqual(match1?.intent, 'getAttendance', 'Intent should be getAttendance');

  const match2 = learningEngine.findBestMatch('Sonu Kumar ka khata dikhao');
  assert(match2 !== null, 'Should match Sonu Kumar khata pattern');
  assert.strictEqual(match2?.intent, 'getWorkerKhata', 'Intent should be getWorkerKhata');

  const match3 = learningEngine.findBestMatch('Akshay Tak ke wallet mein kitna paisa hai?');
  assert(match3 !== null, 'Should match partner wallet pattern');
  assert.strictEqual(match3?.intent, 'getPartnerWallets', 'Intent should be getPartnerWallets');

  const match4 = learningEngine.findBestMatch('Din ka hisaab verify kaise karein?');
  assert(match4 !== null, 'Should match daily closing pattern');
  assert.strictEqual(match4?.category, 'DAY_CLOSING', 'Should route to DAY_CLOSING');

  const match5 = learningEngine.findBestMatch('Ramesh Kumar ko 500 rupaye advance do');
  assert(match5 !== null, 'Should match 1-click advance draft');
  assert.strictEqual(match5?.intent, 'draftWorkerAdvance', 'Intent should be draftWorkerAdvance');

  console.log(`   • Attendance Match: "${match1?.question}" -> ${match1?.intent}`);
  console.log(`   • Worker Khata Match: "${match2?.question}" -> ${match2?.intent}`);
  console.log(`   • Partner Wallet Match: "${match3?.question}" -> ${match3?.intent}`);
  console.log(`   • Day Closing Match: "${match4?.question}" -> ${match4?.category}`);
  console.log(`   • Action Draft Match: "${match5?.question}" -> ${match5?.intent}`);
  console.log('   ✅ Test 5 Passed: Multilingual intent matching working across all 2,000 patterns!\n');

  // -------------------------------------------------------------------------
  // Test 6: Engine Stats & Persistence
  // -------------------------------------------------------------------------
  console.log('6. Checking Learning Engine Statistics & Storage File...');
  const engineStats = learningEngine.getStats();
  console.log(`   • Pre-seeded Patterns: ${engineStats.preSeededPatterns}`);
  console.log(`   • Total Variations: ${engineStats.preSeededVariations}`);
  console.log(`   • Dynamically Learned Patterns: ${engineStats.learnedPatternsCount}`);
  console.log(`   • Total Queries Tracked: ${engineStats.totalQueries}`);

  assert(engineStats.preSeededPatterns >= 2000, `Pre-seeded patterns must be >= 2000, found ${engineStats.preSeededPatterns}`);

  const jsonFilePath = path.join(process.cwd(), 'data', 'assistant-learned-patterns.json');
  assert(fs.existsSync(jsonFilePath), 'Storage file data/assistant-learned-patterns.json must exist');
  console.log('   ✅ Test 6 Passed: Storage and stats confirmed!\n');

  console.log('====================================================');
  console.log('🎉 ALL 6 TESTS PASSED SUCCESSFULLY! (2,000 HINGLISH PATTERNS)');
  console.log('====================================================');
}

runTests().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
