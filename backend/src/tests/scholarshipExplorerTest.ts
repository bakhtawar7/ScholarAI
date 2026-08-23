import { ScholarshipService } from '../services/scholarshipService';
import { prisma } from '../utils/prisma';

async function runScholarshipModuleTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 RUNNING SCHOLARSHIP MANAGEMENT & EXPLORER MODULE TEST SUITE');
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
    // Test 1: Seed / Database Verification
    console.log('📋 Test Group 1: Database Architecture & Demo Label Verification');
    const allScholarships = await prisma.scholarship.findMany();
    assert(allScholarships.length >= 10, `Database contains seeded scholarships (Count: ${allScholarships.length})`);

    const demoLabeled = allScholarships.filter((s: any) => s.isDemo === true);
    assert(demoLabeled.length > 0, `Seeded scholarships are flagged isDemo=true (${demoLabeled.length})`);

    /**
     * The invariant changed deliberately: the "[DEMO DATA] " title prefix was removed by
     * src/scripts/stripDemoPrefix.ts because it polluted search results and chat replies,
     * leaving the isDemo boolean as the single source of the badge. This assertion used to
     * require the prefix and so contradicted that decision — it went unnoticed because the
     * suite had no npm script and was never run.
     */
    const stillPrefixed = allScholarships.filter((s: any) => String(s.title || '').includes('[DEMO DATA]'));
    assert(
      stillPrefixed.length === 0,
      `No scholarship title retains the legacy [DEMO DATA] prefix (found ${stillPrefixed.length})`
    );

    const firstScholarship = allScholarships[0];
    assert(!!firstScholarship.title, 'Scholarship has title field');
    assert(!!firstScholarship.provider, 'Scholarship has provider field');
    assert(!!firstScholarship.hostCountry, 'Scholarship has hostCountry/country field');
    assert(!!firstScholarship.degreeLevels, 'Scholarship has degreeLevels field');
    assert(!!firstScholarship.fieldsOfStudy, 'Scholarship has fieldsOfStudy field');
    assert(!!firstScholarship.fundingType, 'Scholarship has fundingType field');
    assert(!!firstScholarship.applicationProcess, 'Scholarship has applicationProcess field');
    assert(!!firstScholarship.officialUrl, 'Scholarship has officialUrl field');
    assert(!!firstScholarship.verificationStatus, 'Scholarship has verificationStatus field');
    assert(firstScholarship.lastVerifiedAt !== null, 'Scholarship has lastVerifiedAt date');
    assert(firstScholarship.createdAt !== null, 'Scholarship has createdAt date');
    assert(firstScholarship.updatedAt !== null, 'Scholarship has updatedAt date');

    // Test 2: General Query & Format
    console.log('\n🔍 Test Group 2: GET Scholarships & Formatted Architecture');
    const defaultSearch = await ScholarshipService.searchScholarships({ limit: 12, page: 1 });
    assert(defaultSearch.total >= 10, `GET scholarships returned total count: ${defaultSearch.total}`);
    assert(
      defaultSearch.items.length >= 10,
      `GET scholarships returned items array (Length: ${defaultSearch.items.length})`
    );
    assert(defaultSearch.page === 1, 'Default page is 1');
    assert(defaultSearch.limit === 12, 'Default limit is 12');

    const formattedItem = defaultSearch.items[0]!;
    assert(Array.isArray(formattedItem.degreeLevels), 'degreeLevels is parsed JSON array');
    assert(Array.isArray(formattedItem.fieldsOfStudy), 'fieldsOfStudy is parsed JSON array');
    assert(Array.isArray(formattedItem.requiredDocuments), 'requiredDocuments is parsed JSON array');
    assert(typeof formattedItem.languageRequirements === 'object', 'languageRequirements is parsed JSON object');

    /**
     * These three used to assert `typeof === 'string'`, which passed only because
     * formatScholarship invented prose whenever the column was empty — "No rigid minimum
     * GPA threshold; holistic academic profile evaluated", "Open to all international
     * applicants globally", and a synthesised eligibility summary. Those were claims about
     * a real funding programme that nobody had made, so absent values are now returned as
     * null and rendered as "Not stated" by the UI.
     *
     * The contract is therefore: a non-empty string, or null. Never a placeholder.
     */
    const FABRICATED = [
      'No rigid minimum GPA threshold',
      'Open to all international applicants globally',
      'Open to high-achieving candidates',
      'holistic academic profile evaluated',
    ];

    for (const field of ['gpaRequirements', 'nationalityRequirements', 'eligibilityDescription'] as const) {
      const value = (formattedItem as any)[field];
      assert(
        value === null || (typeof value === 'string' && value.trim().length > 0),
        `${field} is a real string or null, never an empty string`,
        value
      );
      assert(
        typeof value !== 'string' || !FABRICATED.some((f) => value.includes(f)),
        `${field} carries no fabricated placeholder text`,
        value
      );
    }

    // Same rule for the financial fields: a missing tuition figure must not read as a
    // favourable one, since a student could choose where to apply based on it.
    for (const field of ['tuitionCoverage', 'stipendAmount'] as const) {
      const value = (formattedItem as any)[field];
      assert(
        value === null || (typeof value === 'string' && value.trim().length > 0),
        `${field} is a real string or null`,
        value
      );
    }

    // Test 3: Filter Facets
    console.log('\n📊 Test Group 3: Metadata Filter Facets');
    const facets = await ScholarshipService.getFilterFacets();
    assert(facets.countries.length > 0, `Country facets returned (${facets.countries.length} countries)`);
    assert(
      facets.fundingTypes.length > 0,
      `Funding type facets returned (${facets.fundingTypes.length} funding types)`
    );
    assert(
      facets.degreeLevels.length > 0,
      `Degree level facets returned (${facets.degreeLevels.length} degree levels)`
    );
    assert(facets.fieldsOfStudy.length > 0, `Field of study facets returned (${facets.fieldsOfStudy.length} fields)`);

    // Test 4: Keyword Search
    console.log('\n🔎 Test Group 4: Keyword Search');
    const erasmusSearch = await ScholarshipService.searchScholarships({ q: 'Erasmus' });
    assert(
      erasmusSearch.items.some((s: any) => s.title.includes('Erasmus')),
      'Search by title "Erasmus" returns matching record'
    );

    const cambridgeSearch = await ScholarshipService.searchScholarships({ q: 'Cambridge' });
    assert(
      cambridgeSearch.items.some((s: any) => s.title.includes('Gates Cambridge')),
      'Search by university "Cambridge" returns Gates Cambridge'
    );

    const japanSearch = await ScholarshipService.searchScholarships({ q: 'Japan' });
    assert(
      japanSearch.items.some((s: any) => s.country === 'Japan' || s.title.includes('MEXT')),
      'Search by country "Japan" returns MEXT scholarship'
    );

    // Test 5: Multi-Faceted Filters
    console.log('\n🎯 Test Group 5: Multi-Faceted Filters');
    // Country Filter
    const germanyOnly = await ScholarshipService.searchScholarships({ hostCountry: 'Germany' });
    assert(
      germanyOnly.items.every((s: any) => s.country === 'Germany'),
      'Country filter "Germany" only returns German scholarships'
    );

    // Degree Level Filter
    const phdOnly = await ScholarshipService.searchScholarships({ degreeLevel: 'PHD' });
    assert(
      phdOnly.items.every((s: any) => s.degreeLevels.includes('PHD')),
      'Degree filter "PHD" only returns PhD-eligible scholarships'
    );

    // Field Filter
    const aiOnly = await ScholarshipService.searchScholarships({ field: 'Artificial Intelligence' });
    assert(
      aiOnly.items.every((s: any) =>
        s.fieldsOfStudy.some((f: any) => f.includes('Artificial Intelligence') || f.includes('Computer Science'))
      ),
      'Field filter "Artificial Intelligence" matches computing programs'
    );

    // Funding Type Filter
    const fullFundingOnly = await ScholarshipService.searchScholarships({ fundingType: 'FULL_FUNDING' });
    assert(
      fullFundingOnly.items.every((s: any) => s.fundingType === 'FULL_FUNDING'),
      'Funding filter "FULL_FUNDING" returns full funding items'
    );

    // Deadline Filter
    const upcomingDeadlines = await ScholarshipService.searchScholarships({ deadline: 'upcoming' });
    assert(
      upcomingDeadlines.items.length > 0,
      `Upcoming deadline filter returned ${upcomingDeadlines.items.length} active scholarships`
    );

    // Min GPA Filter
    const gpaFilter = await ScholarshipService.searchScholarships({ minGpa: 3.3 });
    assert(
      gpaFilter.items.every((s: any) => s.minGpa === null || s.minGpa <= 3.3),
      'minGpa filter 3.3 returns items with minGpa <= 3.3 or null'
    );

    // Test 6: Sorting
    console.log('\n🔀 Test Group 6: Sorting Options');
    const deadlineAsc = await ScholarshipService.searchScholarships({ sortBy: 'deadline_asc' });
    let isDeadlineSorted = true;
    for (let i = 0; i < deadlineAsc.items.length - 1; i++) {
      const d1 = deadlineAsc.items[i]!.deadline ? new Date(deadlineAsc.items[i]!.deadline!).getTime() : Infinity;
      const d2 = deadlineAsc.items[i + 1]!.deadline
        ? new Date(deadlineAsc.items[i + 1]!.deadline!).getTime()
        : Infinity;
      if (d1 > d2) isDeadlineSorted = false;
    }
    assert(isDeadlineSorted, 'sortBy "deadline_asc" correctly sorts by earliest deadline');

    const titleAsc = await ScholarshipService.searchScholarships({ sortBy: 'title_asc' });
    const isTitleSorted = titleAsc.items.every((item: any, idx: number) => {
      if (idx === 0) return true;
      return item.title.localeCompare(titleAsc.items[idx - 1]!.title) >= 0;
    });
    assert(isTitleSorted, 'sortBy "title_asc" correctly sorts alphabetically');

    // Test 7: Pagination
    console.log('\n📄 Test Group 7: Pagination');
    const page1 = await ScholarshipService.searchScholarships({ page: 1, limit: 4 });
    const page2 = await ScholarshipService.searchScholarships({ page: 2, limit: 4 });
    assert(page1.items.length === 4, 'Page 1 has exactly 4 items with limit=4');
    assert(page2.items.length === 4, 'Page 2 has exactly 4 items with limit=4');
    assert(page1.items[0]!.id !== page2.items[0]!.id, 'Page 1 and Page 2 contain different scholarship items');
    assert(page1.totalPages === Math.ceil(page1.total / 4), 'totalPages calculated accurately');

    // Test 8: GET Scholarship by ID
    console.log('\n🎯 Test Group 8: GET Scholarship By ID');
    const targetId = firstScholarship.id;
    const detail = await ScholarshipService.getScholarshipById(targetId);
    assert(!!detail && detail.id === targetId, `Retrieved scholarship by ID: ${detail?.title}`);
    assert(!!detail && detail.officialUrl.startsWith('http'), `Valid officialUrl: ${detail?.officialUrl}`);
    assert(
      !!detail && detail.requiredDocuments.length > 0,
      `Required documents count: ${detail?.requiredDocuments.length}`
    );

    // Test 9: User Profile Matching & Auth Augmentation
    console.log('\n👤 Test Group 9: User Profile Matching & Status Augmentation');
    const demoUser = await prisma.user.findUnique({
      where: { email: 'student@example.com' },
      include: { profile: true },
    });
    assert(demoUser !== null, 'Demo user student@example.com found in database');

    if (demoUser) {
      const userSearch = await ScholarshipService.searchScholarships({
        userId: demoUser.id,
        sortBy: 'match',
        limit: 5,
      });

      assert(userSearch.items[0]!.userMatch !== null, 'Scholarship response includes computed userMatch object');
      assert(
        userSearch.items[0]!.userMatch!.matchPercentage >= 70,
        `Top match percentage is high (${userSearch.items[0]!.userMatch!.matchPercentage}%)`
      );
      assert(userSearch.items[0]!.userMatch!.matchReasons.length > 0, 'Match reasons list is populated');

      const savedCount = userSearch.items.filter((s: any) => s.isSaved).length;
      assert(savedCount > 0, `isSaved flag augmented correctly (Saved count: ${savedCount})`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Unexpected Error running test suite:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runScholarshipModuleTests();
