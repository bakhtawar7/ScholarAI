import { executeToolCall, toolDefinitions } from '../tools/chatbotTools';
import { OrchestratorAgent } from '../agents/orchestratorAgent';
import { ProfileService } from '../services/profileService';
import { prisma } from '../utils/prisma';

/**
 * Comprehensive Automated Test Suite for AI Scholarship Chatbot & 15 Tools
 */
async function runChatbotOrchestratorTests() {
  console.log('🤖 Starting AI Scholarship Chatbot & 15 Tools Test Suite...\n');
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

  // Setup Demo User & Profile
  let userA = await prisma.user.findFirst({
    where: { email: 'student@example.com' },
    include: { profile: true },
  });

  if (!userA) {
    userA = await prisma.user.create({
      data: {
        email: 'test_student@example.com',
        passwordHash: 'dummyHash',
        profile: {
          create: {
            fullName: 'Alex Morgan',
            countryOfResidence: 'Germany',
            nationality: 'Germany',
            currentDegreeLevel: 'BACHELORS',
            currentDegreeName: 'B.Sc. Computer Science',
            fieldOfStudy: 'Computer Science',
            university: 'Technical University of Munich',
            gpa: 3.75,
            maxGpa: 4.0,
            graduationYear: 2026,
            targetDegreeLevel: 'MASTERS',
            targetCountries: JSON.stringify(['Germany', 'United Kingdom']),
            preferredFields: JSON.stringify(['Computer Science', 'Artificial Intelligence']),
            languageTests: JSON.stringify({ IELTS: '7.5' }),
          },
        },
      },
      include: { profile: true },
    });
  }

  const userIdA = userA.id;

  // Setup a sample scholarship if needed
  let sampleScholarship = await prisma.scholarship.findFirst();
  if (!sampleScholarship) {
    sampleScholarship = await prisma.scholarship.create({
      data: {
        title: 'DAAD Helmut Schmidt Masters Fellowship',
        provider: 'DAAD German Academic Exchange Service',
        hostCountry: 'Germany',
        degreeLevels: JSON.stringify(['MASTERS']),
        fieldsOfStudy: JSON.stringify(['Computer Science', 'Public Policy', 'Data Science']),
        fundingType: 'FULL_FUNDING',
        tuitionCoverage: '100% Tuition Waiver',
        stipendAmount: '€934/month',
        travelAllowance: true,
        accommodationCoverage: true,
        minGpa: 3.2,
        maxGpaScale: 4.0,
        eligibleNationalities: JSON.stringify([]),
        languageRequirements: JSON.stringify({ IELTS: '6.5' }),
        applicationProcess: 'Submit via DAAD portal with certified transcripts and motivation letter.',
        officialUrl: 'https://www.daad.de/en/',
      },
    });
  }

  let sampleScholarship2 = await prisma.scholarship.findFirst({
    where: { id: { not: sampleScholarship.id } },
  });
  if (!sampleScholarship2) {
    sampleScholarship2 = await prisma.scholarship.create({
      data: {
        title: 'Chevening UK Leadership Scholarship',
        provider: 'UK Foreign, Commonwealth & Development Office',
        hostCountry: 'United Kingdom',
        degreeLevels: JSON.stringify(['MASTERS']),
        fieldsOfStudy: JSON.stringify(['Computer Science', 'Engineering', 'Economics']),
        fundingType: 'FULL_FUNDING',
        tuitionCoverage: '100% Tuition Waiver',
        stipendAmount: '£1,340/month',
        travelAllowance: true,
        accommodationCoverage: true,
        minGpa: 3.3,
        maxGpaScale: 4.0,
        eligibleNationalities: JSON.stringify([]),
        languageRequirements: JSON.stringify({ IELTS: '7.0' }),
        applicationProcess: 'Submit via Chevening online application system with 2 reference letters.',
        officialUrl: 'https://www.chevening.org/',
      },
    });
  }

  const scholarshipId = sampleScholarship.id;
  const scholarshipId2 = sampleScholarship2.id;

  // ----------------------------------------------------
  // TOOL 1: searchScholarships
  // ----------------------------------------------------
  {
    const res = await executeToolCall('searchScholarships', { q: 'Germany', fundingType: 'FULL_FUNDING' }, userIdA);
    assert(res && typeof res.total === 'number' && Array.isArray(res.items), 'Tool 1: searchScholarships returns structured items');
    assert(res.items.length > 0, 'Tool 1b: searchScholarships finds records');
  }

  // ----------------------------------------------------
  // TOOL 2: getScholarshipDetails (and getScholarship alias)
  // ----------------------------------------------------
  {
    const res1 = await executeToolCall('getScholarshipDetails', { scholarshipId }, userIdA);
    const res2 = await executeToolCall('getScholarshipDetails', { titleKeyword: sampleScholarship.title.split(' ')[0] }, userIdA);
    assert(res1 && res1.id === scholarshipId, 'Tool 2a: getScholarshipDetails resolves by UUID');
    assert(res2 && res2.id === scholarshipId, 'Tool 2b: getScholarshipDetails resolves by title keyword');
  }

  // ----------------------------------------------------
  // TOOL 3: getStudentProfile
  // ----------------------------------------------------
  {
    const profileRes = await executeToolCall('getStudentProfile', {}, userIdA);
    assert(profileRes && profileRes.fieldOfStudy === 'Computer Science', 'Tool 3: getStudentProfile returns active student attributes');
  }

  // ----------------------------------------------------
  // TOOL 4: checkEligibility
  // ----------------------------------------------------
  {
    const eligRes = await executeToolCall('checkEligibility', { scholarshipId }, userIdA);
    assert(typeof eligRes.matchScore === 'number' && eligRes.matchScore >= 0, 'Tool 4a: checkEligibility returns matchScore');
    assert(['ELIGIBLE', 'POTENTIALLY_ELIGIBLE', 'NOT_ELIGIBLE', 'INSUFFICIENT_INFORMATION'].includes(eligRes.eligibilityStatus), 'Tool 4b: checkEligibility returns valid status');
    assert(Array.isArray(eligRes.matchingCriteria) && eligRes.disclaimer, 'Tool 4c: checkEligibility includes matchingCriteria and disclaimer');
  }

  // ----------------------------------------------------
  // TOOL 5: getRecommendations
  // ----------------------------------------------------
  {
    const recs = await executeToolCall('getRecommendations', { limit: 3 }, userIdA);
    assert(Array.isArray(recs) && recs.length > 0, 'Tool 5: getRecommendations returns ranked recommendations');
  }

  // ----------------------------------------------------
  // TOOL 6: compareScholarships
  // ----------------------------------------------------
  {
    const comp = await executeToolCall('compareScholarships', { scholarshipIds: [scholarshipId, scholarshipId2] }, userIdA);
    assert(Array.isArray(comp) && comp.length >= 2, 'Tool 6: compareScholarships returns side-by-side comparison array');
  }

  // ----------------------------------------------------
  // TOOL 7, 8, 9: saveScholarship, getSavedScholarships, removeSavedScholarship
  // ----------------------------------------------------
  {
    // Save
    const saveRes = await executeToolCall('saveScholarship', { scholarshipId }, userIdA);
    assert(saveRes && saveRes.success === true, 'Tool 7: saveScholarship bookmarks scholarship');

    // Get Saved
    const savedList = await executeToolCall('getSavedScholarships', {}, userIdA);
    assert(Array.isArray(savedList) && savedList.some((s: any) => s.id === scholarshipId), 'Tool 9: getSavedScholarships returns saved items');

    // Remove Saved
    const removeRes = await executeToolCall('removeSavedScholarship', { scholarshipId }, userIdA);
    assert(removeRes && removeRes.success === true, 'Tool 8: removeSavedScholarship deletes bookmark');
  }

  // ----------------------------------------------------
  // TOOL 10, 11, 12: createApplication, getApplications, updateApplicationStatus
  // ----------------------------------------------------
  {
    // Create Application
    const appRes = await executeToolCall('createApplication', { scholarshipId, status: 'INTERESTED', notes: 'Preparing initial draft' }, userIdA);
    assert(appRes && appRes.success === true, 'Tool 10: createApplication creates application tracker entry');

    // Get Applications
    const appsList = await executeToolCall('getApplications', {}, userIdA);
    assert(Array.isArray(appsList) && appsList.length > 0, 'Tool 11: getApplications retrieves tracked applications');

    // Update Application Status
    const updateAppRes = await executeToolCall('updateApplicationStatus', { scholarshipId, status: 'PREPARING', notes: 'SOP draft ready' }, userIdA);
    assert(updateAppRes && updateAppRes.success === true && updateAppRes.status === 'PREPARING', 'Tool 12: updateApplicationStatus updates status');
  }

  // ----------------------------------------------------
  // TOOL 13: getUpcomingDeadlines
  // ----------------------------------------------------
  {
    const deads = await executeToolCall('getUpcomingDeadlines', {}, userIdA);
    assert(Array.isArray(deads), 'Tool 13: getUpcomingDeadlines returns deadline items array');
  }

  // ----------------------------------------------------
  // TOOL 14: createReminder
  // ----------------------------------------------------
  {
    const reminderRes = await executeToolCall('createReminder', {
      title: 'Submit DAAD Motivation Letter',
      dueDate: '2026-11-01T00:00:00Z',
      daysBefore: 5,
    }, userIdA);
    assert(reminderRes && reminderRes.success === true, 'Tool 14: createReminder persists reminder');
  }

  // ----------------------------------------------------
  // TOOL 15: updateStudentProfile
  // ----------------------------------------------------
  {
    const updateProfRes = await executeToolCall('updateStudentProfile', { gpa: 3.82 }, userIdA);
    assert(updateProfRes && updateProfRes.success === true && updateProfRes.profile.gpa === 3.82, 'Tool 15: updateStudentProfile updates student profile');
  }

  // ----------------------------------------------------
  // SECURITY & USER ISOLATION BOUNDARY TEST
  // ----------------------------------------------------
  {
    const userB = await prisma.user.upsert({
      where: { email: 'student_b@example.com' },
      update: {},
      create: {
        email: 'student_b@example.com',
        passwordHash: 'dummyHashB',
      },
    });

    await ProfileService.updateProfile(userB.id, {
      fullName: 'Secret User B',
      fieldOfStudy: 'Biology',
      university: 'Sorbonne',
      nationality: 'France',
      countryOfResidence: 'France',
    });

    const userBProfile = await executeToolCall('getStudentProfile', {}, userB.id);
    const userAProfile = await executeToolCall('getStudentProfile', {}, userIdA);

    assert(
      userBProfile.fullName === 'Secret User B' && userAProfile.fullName !== 'Secret User B',
      'Security: User profile retrieval strictly isolated by authenticated userId'
    );

    const userBApplications = await executeToolCall('getApplications', {}, userB.id);
    assert(
      Array.isArray(userBApplications) && !userBApplications.some((a: any) => a.userId === userIdA),
      'Security: User B cannot view User A applications'
    );
  }

  // ----------------------------------------------------
  // MULTI-STEP CONVERSATION TESTS WITH ORCHESTRATOR AGENT
  // ----------------------------------------------------
  {
    // Create new conversation session
    const conv = await prisma.chatConversation.create({
      data: {
        userId: userIdA,
        title: 'Integration Test Multi-Step Session',
      },
    });

    // Step 1: Search Scholarships
    const reply1 = await OrchestratorAgent.processUserMessage(
      conv.id,
      userIdA,
      'Find fully funded CS scholarships in Germany'
    );
    assert(
      reply1 && reply1.content.toLowerCase().includes('scholarship'),
      'Conversation Step 1: Search scholarships generates informed response',
      reply1.content.slice(0, 100)
    );

    // Step 2: Check Eligibility
    const reply2 = await OrchestratorAgent.processUserMessage(
      conv.id,
      userIdA,
      `Am I eligible for ${sampleScholarship.title}?`
    );
    assert(
      reply2 && (reply2.content.includes('Eligibility') || reply2.content.includes('Match Score')),
      'Conversation Step 2: Eligibility inquiry invokes checkEligibility tool',
      reply2.content.slice(0, 100)
    );

    // Step 3: Deadlines
    const reply3 = await OrchestratorAgent.processUserMessage(
      conv.id,
      userIdA,
      'What is my earliest deadline?'
    );
    assert(
      reply3 && (reply3.content.includes('Deadline') || reply3.content.includes('Cutoff') || reply3.content.includes('tracker')),
      'Conversation Step 3: Deadlines query invokes getUpcomingDeadlines tool',
      reply3.content.slice(0, 100)
    );

    // Step 4: Unrelated Query Redirection
    const reply4 = await OrchestratorAgent.processUserMessage(
      conv.id,
      userIdA,
      'Can you give me a recipe to bake a chocolate cake?'
    );
    assert(
      reply4 && reply4.content.includes('AI Scholarship Copilot') && reply4.content.includes('specialized'),
      'Conversation Step 4: Unrelated query is politely redirected to scholarship domain',
      reply4.content.slice(0, 100)
    );
  }

  console.log(`\n========================================`);
  console.log(`Chatbot Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 All 15 tools, security boundaries, and multi-step conversations verified successfully!');
  } else {
    process.exit(1);
  }
}

runChatbotOrchestratorTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
