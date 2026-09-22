import { execSync } from 'child_process';

const suites = [
  { name: '1. Calculation Engine Units', file: 'tests/calculations.test.ts' },
  { name: '2. Auth & Multi-Tenant Isolation', file: 'tests/auth_and_isolation.test.ts' },
  { name: '3. Projects & Sites Management', file: 'tests/projects.test.ts' },
  { name: '4. Workers, Attendance & Productivity', file: 'tests/workers_and_attendance.test.ts' },
  { name: '5. Finance, Payments & Khata Ledger', file: 'tests/finance.test.ts' },
  { name: '6. Materials, Stock & Negative Prevention', file: 'tests/materials.test.ts' },
  { name: '7. Financial Matrix, Reports & System', file: 'tests/reports_and_system.test.ts' },
];

console.log('===============================================================');
console.log('   LABOUR & PROJECT MANAGEMENT SAAS - MASTER VERIFICATION QA   ');
console.log('===============================================================\n');

let passed = 0;
let failed = 0;

for (const suite of suites) {
  console.log(`▶ Running Suite [${suite.name}]...`);
  try {
    const output = execSync(`cmd.exe /c "npx.cmd ts-node -T ${suite.file}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    console.log(output);
    console.log(`✔ Passed Suite: ${suite.name}\n---------------------------------------------------------------\n`);
    passed++;
  } catch (err: any) {
    console.error(`✖ FAILED Suite: ${suite.name}`);
    console.error(err.stdout || err.stderr || err.message);
    failed++;
  }
}

console.log('===============================================================');
console.log(`MASTER QA RESULTS: ${passed} PASSED, ${failed} FAILED across ${suites.length} SUITES`);
console.log('===============================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🌟 ALL DOMAIN TEST SUITES VERIFIED AND READY FOR PRODUCTION! 🌟\n');
}
