import { VerificationService } from '../services/verificationService';
import { ScholarshipService } from '../services/scholarshipService';
import { prisma } from '../utils/prisma';

async function runVerificationAgentTestSuite() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 RUNNING SCHOLARSHIP VERIFICATION AGENT & AUDIT TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Create a test scholarship to verify
    console.log('📋 Test Group 1: 8-Dimension Verification Engine Execution');
    const testScholarship = await prisma.scholarship.create({
      data: {
        title: `[TEST] European Quantum Computing Fellowship ${Date.now()}`,
        provider: 'European Quantum Flagship',
        university: 'ETH Zurich & TU Delft',
        hostCountry: 'Switzerland',
        degreeLevels: JSON.stringify(['MASTERS', 'PHD']),
        fieldsOfStudy: JSON.stringify(['Computer Science', 'Quantum Physics', 'Electrical Engineering']),
        fundingType: 'FULL_FUNDING',
        tuitionCoverage: '100% Full Tuition Waiver (CHF 15,000/yr)',
        stipendAmount: 'CHF 2,200 / month living allowance',
        travelAllowance: true,
        accommodationCoverage: true,
        minGpa: 3.5,
        maxGpaScale: 4.0,
        gpaRequirements: 'Minimum GPA of 3.5/4.0 in Physics or CS',
        eligibleNationalities: JSON.stringify([]),
        nationalityRequirements: 'Open to all international applicants globally.',
        languageRequirements: JSON.stringify({ IELTS: 7.0, TOEFL: 100 }),
        eligibilityDescription: 'Candidates must hold a Bachelor degree in Physics or Computing with quantum mechanics coursework.',
        requiredDocuments: JSON.stringify(['Transcripts', 'SOP', '2 References', 'CV']),
        applicationProcess: 'Submit dossier via ETH quantum portal.',
        deadline: new Date('2026-12-15'),
        officialUrl: 'https://qt.eu/fellowships/quantum-masters-2026',
        sourceUrl: 'https://qt.eu/call',
        verificationStatus: 'PENDING_VERIFICATION',
        isDemo: true,
      },
    });

    // Run AI Verification Agent
    const report = await VerificationService.verifyScholarship(testScholarship.id);

    assert(report.status === 'VERIFIED', `Overall status assigned is VERIFIED (Got: ${report.status})`);
    assert(report.overallConfidence >= 0.85, `Overall confidence is high (${report.overallConfidence})`);
    assert(report.fieldAudits.length === 8, `Audited all 8 required dimensions (Count: ${report.fieldAudits.length})`);

    // Verify 8 core fields
    const requiredFields = [
      'deadline',
      'funding',
      'eligibility',
      'nationality',
      'degree',
      'field',
      'language requirement',
      'application URL',
    ];

    for (const rf of requiredFields) {
      const audit = report.fieldAudits.find((a) => a.field === rf);
      assert(!!audit, `Field "${rf}" audit exists in report`);
      assert(audit?.value !== undefined && audit?.value !== null, `Field "${rf}" has audited value`);
      assert(!!audit?.source, `Field "${rf}" has audited source`);
      assert(typeof audit?.confidence === 'number' && audit.confidence >= 0 && audit.confidence <= 1, `Field "${rf}" has confidence score (${audit?.confidence})`);
      assert(!!audit?.lastVerifiedDate, `Field "${rf}" has lastVerifiedDate`);
      assert(!!audit?.notes, `Field "${rf}" has audit notes`);
    }

    // 2. Test Verification Decisions & Rejection of Bad URLs
    console.log('\n🛑 Test Group 2: Verification Status Distinctions (REJECTED & NEEDS_REVIEW)');
    const brokenScholarship = await prisma.scholarship.create({
      data: {
        title: `[TEST] Suspicious Unverified Grant ${Date.now()}`,
        provider: 'Unknown Entity',
        hostCountry: 'Germany',
        degreeLevels: JSON.stringify([]),
        fieldsOfStudy: JSON.stringify([]),
        fundingType: 'FULL_FUNDING',
        applicationProcess: 'Send email to free gmail address.',
        officialUrl: 'invalid-broken-url-without-protocol',
        verificationStatus: 'PENDING_VERIFICATION',
      },
    });

    const brokenReport = await VerificationService.verifyScholarship(brokenScholarship.id);
    assert(brokenReport.status === 'REJECTED', `Invalid URL scholarship marked REJECTED (Got: ${brokenReport.status})`);
    assert(brokenReport.urlReachable === false, 'urlReachable is false for broken URL');

    // 3. Test Verification Queue Retrieval
    console.log('\n📥 Test Group 3: Verification Queue Endpoint');
    const pendingScholarship = await prisma.scholarship.create({
      data: {
        title: `[TEST] Pending Queue Audit ${Date.now()}`,
        provider: 'European Grant Board',
        hostCountry: 'France',
        degreeLevels: JSON.stringify(['MASTERS']),
        fieldsOfStudy: JSON.stringify(['Engineering']),
        fundingType: 'FULL_FUNDING',
        applicationProcess: 'Submit via consortium portal.',
        officialUrl: 'https://example.edu/apply-scholarship',
        verificationStatus: 'PENDING_VERIFICATION',
      },
    });

    const queue = await VerificationService.getVerificationQueue();
    assert(queue.total > 0, `Verification queue returns pending items (Total: ${queue.total})`);
    assert(queue.items.length > 0, 'Queue items array populated');

    // 4. Test Verification Audit Trail Retrieval
    console.log('\n📜 Test Group 4: Detailed Audit Trail');
    const auditTrail = await VerificationService.getVerificationAudit(testScholarship.id);
    assert(auditTrail.scholarship.id === testScholarship.id, 'Retrieved audit trail for scholarship');
    assert(auditTrail.history.length > 0, `Verification history records count: ${auditTrail.history.length}`);
    assert(auditTrail.currentReport !== null, 'Current report is populated');

    // 5. Test Manual Admin Review Override
    console.log('\n✍️ Test Group 5: Manual Admin Review Override');
    const overrideResult = await VerificationService.submitManualReview(
      testScholarship.id,
      'PARTIALLY_VERIFIED',
      'Official contact confirmed fellowship terms; stipend amount subject to annual revision.',
      'admin-user-123'
    );

    assert(overrideResult.status === 'PARTIALLY_VERIFIED', 'Manual review override set status to PARTIALLY_VERIFIED');

    const reloaded = await prisma.scholarship.findUnique({ where: { id: testScholarship.id } });
    assert(reloaded?.verificationStatus === 'PARTIALLY_VERIFIED', 'Database status updated to PARTIALLY_VERIFIED');

    // Cleanup test records
    await prisma.scholarshipVerification.deleteMany({
      where: { scholarshipId: { in: [testScholarship.id, brokenScholarship.id, pendingScholarship.id] } },
    });
    await prisma.scholarship.deleteMany({
      where: { id: { in: [testScholarship.id, brokenScholarship.id, pendingScholarship.id] } },
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`🏁 VERIFICATION AGENT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('❌ Error during verification agent test:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerificationAgentTestSuite();
