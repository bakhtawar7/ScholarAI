import { MatchingService } from '../services/matchingService';

/**
 * Automated Edge-Case & Structured Output Test Suite for
 * AI Scholarship Matching and Eligibility System.
 */
async function runMatchingEligibilityTests() {
  console.log('🧪 Starting AI Scholarship Matching and Eligibility Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error('   Details:', details);
    }
  }

  // ----------------------------------------------------
  // TEST CASE 1: Missing Student GPA
  // Student has no GPA provided, but scholarship specifies min GPA of 3.2.
  // Expectation: Not hard-rejected; flagged as uncertainCriteria, recommendations provided, status POTENTIALLY_ELIGIBLE
  // ----------------------------------------------------
  {
    const studentProfile = {
      targetDegreeLevel: 'MASTERS',
      fieldOfStudy: 'Computer Science',
      preferredFields: ['Data Science'],
      targetCountries: ['Germany'],
      nationality: 'Pakistan',
      countryOfResidence: 'Pakistan',
      gpa: null, // MISSING GPA
      maxGpa: 4.0,
      languageTests: { IELTS: '7.0' },
    };

    const scholarship = {
      title: 'DAAD Helmut Schmidt Masters Scholarship',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Computer Science', 'Public Policy']),
      hostCountry: 'Germany',
      minGpa: 3.2,
      maxGpaScale: 4.0,
      eligibleNationalities: JSON.stringify([]), // Open to all
      languageRequirements: JSON.stringify({ IELTS: '6.5' }),
      requiredDocuments: JSON.stringify(['Transcripts', 'CV']),
    };

    const result = MatchingService.evaluateCompatibility(studentProfile, scholarship);

    assert(
      result.uncertainCriteria.some((u) => u.toLowerCase().includes('gpa not provided')),
      'Edge Case 1a: Missing GPA is properly captured in uncertainCriteria',
      result.uncertainCriteria
    );
    assert(
      result.recommendations.some((r) => r.toLowerCase().includes('gpa')),
      'Edge Case 1b: Recommendation generated to update profile GPA',
      result.recommendations
    );
    assert(
      result.eligibilityStatus === 'POTENTIALLY_ELIGIBLE',
      'Edge Case 1c: Eligibility status is POTENTIALLY_ELIGIBLE (not false NOT_ELIGIBLE)',
      result.eligibilityStatus
    );
    assert(
      result.breakdown.gpaMatch === 'UNCERTAIN',
      'Edge Case 1d: Breakdown reflects gpaMatch as UNCERTAIN',
      result.breakdown
    );
  }

  // ----------------------------------------------------
  // TEST CASE 2: Missing IELTS / Language Scores
  // Scholarship requires IELTS 6.5, student profile has no language test scores.
  // Expectation: Handled as uncertainCriteria with actionable waiver/test recommendation.
  // ----------------------------------------------------
  {
    const studentProfile = {
      targetDegreeLevel: 'MASTERS',
      fieldOfStudy: 'Data Science',
      preferredFields: ['Computer Science'],
      targetCountries: ['United Kingdom'],
      nationality: 'India',
      countryOfResidence: 'India',
      gpa: 3.8,
      maxGpa: 4.0,
      languageTests: {}, // MISSING IELTS / TOEFL
    };

    const scholarship = {
      title: 'Chevening UK Masters Scholarship',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Data Science', 'Informatics']),
      hostCountry: 'United Kingdom',
      minGpa: 3.0,
      maxGpaScale: 4.0,
      eligibleNationalities: JSON.stringify([]),
      languageRequirements: JSON.stringify({ IELTS: '6.5' }),
      requiredDocuments: JSON.stringify(['SOP', 'Transcripts']),
    };

    const result = MatchingService.evaluateCompatibility(studentProfile, scholarship);

    assert(
      result.uncertainCriteria.some((u) => u.toLowerCase().includes('english language') || u.toLowerCase().includes('ielts')),
      'Edge Case 2a: Missing IELTS is captured in uncertainCriteria',
      result.uncertainCriteria
    );
    assert(
      result.recommendations.some((r) => r.toLowerCase().includes('ielts') || r.toLowerCase().includes('waiver')),
      'Edge Case 2b: Actionable recommendation generated for language test / waiver',
      result.recommendations
    );
    assert(
      result.eligibilityStatus === 'POTENTIALLY_ELIGIBLE',
      'Edge Case 2c: Status is POTENTIALLY_ELIGIBLE rather than hard rejection',
      result.eligibilityStatus
    );
  }

  // ----------------------------------------------------
  // TEST CASE 3: Unknown / Open vs Restricted Nationality Requirement
  // ----------------------------------------------------
  {
    // Subcase 3A: Open to all nationalities
    const studentProfile = {
      targetDegreeLevel: 'MASTERS',
      fieldOfStudy: 'Biotechnology',
      targetCountries: ['Sweden'],
      nationality: 'Brazil',
      countryOfResidence: 'Brazil',
      gpa: 3.6,
      languageTests: { IELTS: '7.5' },
    };

    const openScholarship = {
      title: 'Swedish Institute Global Masters Scholarship',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Biotechnology', 'Life Sciences']),
      hostCountry: 'Sweden',
      eligibleNationalities: JSON.stringify([]), // Open to all international
      languageRequirements: JSON.stringify({ IELTS: '6.5' }),
    };

    const resultOpen = MatchingService.evaluateCompatibility(studentProfile, openScholarship);
    assert(
      resultOpen.matchingCriteria.some((m) => m.toLowerCase().includes('open to all') || m.toLowerCase().includes('worldwide')),
      'Edge Case 3a: Open nationality properly credited in matchingCriteria',
      resultOpen.matchingCriteria
    );
    assert(
      resultOpen.eligibilityStatus === 'ELIGIBLE',
      'Edge Case 3b: Open scholarship with satisfied criteria is ELIGIBLE',
      resultOpen.eligibilityStatus
    );

    // Subcase 3B: Restricted scholarship & student nationality mismatch
    const restrictedScholarship = {
      title: 'Nordic-Baltic Regional Exchange Grant',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Biotechnology']),
      hostCountry: 'Sweden',
      eligibleNationalities: JSON.stringify(['Norway', 'Finland', 'Estonia']),
    };

    const resultRestricted = MatchingService.evaluateCompatibility(studentProfile, restrictedScholarship);
    assert(
      resultRestricted.missingCriteria.some((m) => m.toLowerCase().includes('nationality restriction')),
      'Edge Case 3c: Ineligible nationality captured in missingCriteria',
      resultRestricted.missingCriteria
    );
    assert(
      resultRestricted.eligibilityStatus === 'NOT_ELIGIBLE',
      'Edge Case 3d: Nationality restriction strictly enforces NOT_ELIGIBLE status',
      resultRestricted.eligibilityStatus
    );

    // Subcase 3C: Restricted scholarship & student has unknown/unspecified nationality
    const unspecifiedNatProfile = {
      ...studentProfile,
      nationality: 'Not Specified',
      countryOfResidence: '',
    };
    const resultUnspecified = MatchingService.evaluateCompatibility(unspecifiedNatProfile, restrictedScholarship);
    assert(
      resultUnspecified.uncertainCriteria.some((u) => u.toLowerCase().includes('nationality is not specified')),
      'Edge Case 3e: Unspecified nationality on restricted scholarship is captured in uncertainCriteria',
      resultUnspecified.uncertainCriteria
    );
  }

  // ----------------------------------------------------
  // TEST CASE 4: Scholarship with Multiple Eligible Fields of Study
  // Scholarship lists 5 distinct fields; student profile matches one of them.
  // ----------------------------------------------------
  {
    const studentProfile = {
      targetDegreeLevel: 'PHD',
      fieldOfStudy: 'Artificial Intelligence',
      preferredFields: ['Machine Learning', 'Robotics'],
      targetCountries: ['United States'],
      nationality: 'Canada',
      countryOfResidence: 'Canada',
      gpa: 3.9,
      maxGpa: 4.0,
      languageTests: { TOEFL: '110' },
    };

    const multiFieldScholarship = {
      title: 'Stanford Graduate Fellowship in Science & Engineering',
      degreeLevels: JSON.stringify(['PHD']),
      fieldsOfStudy: JSON.stringify([
        'Computer Science',
        'Artificial Intelligence',
        'Biomedical Informatics',
        'Electrical Engineering',
        'Applied Physics',
      ]),
      hostCountry: 'United States',
      minGpa: 3.5,
      eligibleNationalities: JSON.stringify([]),
      languageRequirements: JSON.stringify({ TOEFL: '100' }),
    };

    const result = MatchingService.evaluateCompatibility(studentProfile, multiFieldScholarship);

    assert(
      result.matchingCriteria.some((m) => m.includes('Artificial Intelligence')),
      'Edge Case 4a: Student field correctly matched within multi-field scholarship array',
      result.matchingCriteria
    );
    assert(
      result.breakdown.fieldMatch === true,
      'Edge Case 4b: Field breakdown marked as matched true',
      result.breakdown
    );
    assert(
      result.matchScore >= 85,
      'Edge Case 4c: Match score is high for perfect multi-field alignment',
      result.matchScore
    );
  }

  // ----------------------------------------------------
  // TEST CASE 5: Scholarship with No GPA Requirement
  // Scholarship evaluates holistically with no minGpa.
  // Expectation: Does not penalize student; awards full GPA points in matchingCriteria.
  // ----------------------------------------------------
  {
    const studentProfile = {
      targetDegreeLevel: 'MASTERS',
      fieldOfStudy: 'Architecture',
      targetCountries: ['Netherlands'],
      nationality: 'Italy',
      countryOfResidence: 'Italy',
      gpa: 3.1, // Modest GPA
      maxGpa: 4.0,
      languageTests: { IELTS: '7.0' },
    };

    const noGpaScholarship = {
      title: 'TU Delft Excellence Scholarship (Portfolio-Based)',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Architecture', 'Urban Planning']),
      hostCountry: 'Netherlands',
      minGpa: null, // NO GPA REQUIREMENT
      maxGpaScale: 4.0,
      eligibleNationalities: JSON.stringify([]),
      languageRequirements: JSON.stringify({ IELTS: '6.5' }),
    };

    const result = MatchingService.evaluateCompatibility(studentProfile, noGpaScholarship);

    assert(
      result.matchingCriteria.some((m) => m.toLowerCase().includes('no strict minimum gpa') || m.toLowerCase().includes('holistic')),
      'Edge Case 5a: No GPA requirement recorded as positive holistic matching criterion',
      result.matchingCriteria
    );
    assert(
      result.breakdown.gpaMatch === 'NOT_REQUIRED',
      'Edge Case 5b: GPA breakdown reflects NOT_REQUIRED',
      result.breakdown
    );
    assert(
      result.eligibilityStatus === 'ELIGIBLE',
      'Edge Case 5c: Status evaluates to ELIGIBLE without GPA penalty',
      result.eligibilityStatus
    );
  }

  // ----------------------------------------------------
  // TEST CASE 6: Profile Hash Generation & Caching Test
  // ----------------------------------------------------
  {
    const profileA = {
      targetDegreeLevel: 'MASTERS',
      fieldOfStudy: 'Computer Science',
      preferredFields: ['AI'],
      targetCountries: ['Germany'],
      gpa: 3.8,
      maxGpa: 4.0,
      nationality: 'Pakistan',
      countryOfResidence: 'Pakistan',
      languageTests: { IELTS: '7.5' },
    };

    const hash1 = MatchingService.generateProfileHash(profileA);
    const hash2 = MatchingService.generateProfileHash(profileA);

    assert(
      hash1 === hash2 && hash1.length === 64,
      'Test 6a: Profile hash is deterministic and 64-char SHA256',
      { hash1 }
    );

    const profileB = { ...profileA, gpa: 3.9 }; // Modified GPA
    const hash3 = MatchingService.generateProfileHash(profileB);

    assert(
      hash1 !== hash3,
      'Test 6b: Profile hash changes when key profile attributes change',
      { hash1, hash3 }
    );
  }

  // ----------------------------------------------------
  // TEST CASE 7: Required Disclaimer & Output Structure Verification
  // ----------------------------------------------------
  {
    const studentProfile = {
      targetDegreeLevel: 'MASTERS',
      fieldOfStudy: 'Computer Science',
      targetCountries: ['Germany'],
      nationality: 'Pakistan',
      gpa: 3.7,
    };

    const scholarship = {
      title: 'Sample Scholarship',
      degreeLevels: JSON.stringify(['MASTERS']),
      fieldsOfStudy: JSON.stringify(['Computer Science']),
      hostCountry: 'Germany',
      minGpa: 3.0,
    };

    const result = MatchingService.evaluateCompatibility(studentProfile, scholarship);

    // Verify all 7 required schema fields
    assert(typeof result.matchScore === 'number' && result.matchScore >= 0 && result.matchScore <= 100, 'Schema: matchScore is valid number (0-100)');
    assert(['ELIGIBLE', 'POTENTIALLY_ELIGIBLE', 'NOT_ELIGIBLE', 'INSUFFICIENT_INFORMATION'].includes(result.eligibilityStatus), 'Schema: eligibilityStatus matches enum');
    assert(Array.isArray(result.matchingCriteria), 'Schema: matchingCriteria is array');
    assert(Array.isArray(result.missingCriteria), 'Schema: missingCriteria is array');
    assert(Array.isArray(result.uncertainCriteria), 'Schema: uncertainCriteria is array');
    assert(Array.isArray(result.warnings), 'Schema: warnings is array');
    assert(Array.isArray(result.recommendations), 'Schema: recommendations is array');
    assert(
      result.warnings.some((w) => w.toLowerCase().includes('ai estimate') && w.toLowerCase().includes('not')) ||
      result.disclaimer.toLowerCase().includes('not constitute guaranteed'),
      'Notice: AI disclaimer is explicitly included to avoid guaranteeing official eligibility',
      result.disclaimer
    );
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 All edge cases and matching requirements verified successfully!');
  } else {
    process.exit(1);
  }
}

runMatchingEligibilityTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
