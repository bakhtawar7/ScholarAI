import { ApplicationService } from '../services/applicationService';
import { DeadlineService } from '../services/deadlineService';
import { DeadlineAutomationService } from '../services/deadlineAutomationService';
import { SavedService } from '../services/savedService';
import { prisma } from '../utils/prisma';

async function runApplicationAndDeadlineTests() {
  console.log('🚀 Starting Application Tracker & Deadline Automation Test Suite...\n');
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

  // Setup Test User
  const testUser = await prisma.user.upsert({
    where: { email: 'tracker_test@example.com' },
    update: {},
    create: {
      email: 'tracker_test@example.com',
      passwordHash: 'dummyHash',
      profile: {
        create: {
          fullName: 'Jordan Lee',
          countryOfResidence: 'Canada',
          nationality: 'Canada',
          currentDegreeLevel: 'BACHELORS',
          currentDegreeName: 'B.Sc. Software Engineering',
          fieldOfStudy: 'Computer Science',
          university: 'University of Toronto',
          gpa: 3.85,
          graduationYear: 2026,
          targetDegreeLevel: 'MASTERS',
        },
      },
    },
  });

  const userId = testUser.id;

  // Clean previous test artifacts for isolation
  await prisma.application.deleteMany({ where: { userId } });
  await prisma.savedScholarship.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { userId } });

  // Setup Sample Scholarships (upcoming 7 days, 14 days, 30 days, and expired)
  const now = new Date();
  const dateIn7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateIn14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const _dateIn30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dateExpired = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const sch7Days = await prisma.scholarship.create({
    data: {
      title: 'DAAD 7-Day Urgent Masters Fellowship',
      provider: 'DAAD Germany',
      hostCountry: 'Germany',
      fundingType: 'FULL_FUNDING',
      deadline: dateIn7Days,
      applicationProcess: 'Online portal',
      officialUrl: 'https://www.daad.de',
      requiredDocuments: JSON.stringify(['Motivation Letter', 'Transcripts']),
    },
  });

  const sch14Days = await prisma.scholarship.create({
    data: {
      title: 'Chevening 14-Day Leadership Award',
      provider: 'UK FCDO',
      hostCountry: 'United Kingdom',
      fundingType: 'FULL_FUNDING',
      deadline: dateIn14Days,
      applicationProcess: 'Chevening portal',
      officialUrl: 'https://www.chevening.org',
      requiredDocuments: JSON.stringify(['References']),
    },
  });

  const schExpired = await prisma.scholarship.create({
    data: {
      title: 'Erasmus Expired Grant',
      provider: 'European Commission',
      hostCountry: 'France',
      fundingType: 'FULL_FUNDING',
      deadline: dateExpired,
      applicationProcess: 'Erasmus portal',
      officialUrl: 'https://erasmus.europa.eu',
    },
  });

  // ----------------------------------------------------
  // TEST 1: Save Scholarship
  // ----------------------------------------------------
  {
    const saved = await SavedService.saveScholarship(userId, sch7Days.id);
    assert(
      Boolean(saved && saved.scholarshipId === sch7Days.id),
      'Test 1: Successfully save scholarship to user account'
    );
  }

  // ----------------------------------------------------
  // TEST 2: Create Application with Initial Status & Checklists
  // ----------------------------------------------------
  let appRecord: any;
  {
    appRecord = await ApplicationService.createApplication(
      userId,
      sch7Days.id,
      'INTERESTED',
      'Initial exploration note'
    );
    assert(appRecord && appRecord.status === 'INTERESTED', 'Test 2a: Create application in INTERESTED status');
    assert(
      Array.isArray(appRecord.checklists) && appRecord.checklists.length >= 6,
      'Test 2b: Automatically generates standard & required document checklist items'
    );
  }

  // ----------------------------------------------------
  // TEST 3: Update Application Status Across All 7 Stages
  // ----------------------------------------------------
  {
    const allStatuses = ['INTERESTED', 'PREPARING', 'READY_TO_APPLY', 'APPLIED', 'INTERVIEW', 'ACCEPTED', 'REJECTED'];
    let statusSuccess = true;

    for (const st of allStatuses) {
      const updated = await ApplicationService.updateStatus(appRecord.id, userId, st);
      if (updated.status !== st) statusSuccess = false;
    }

    assert(
      statusSuccess,
      'Test 3: Supports transitions across all 7 statuses (INTERESTED, PREPARING, READY_TO_APPLY, APPLIED, INTERVIEW, ACCEPTED, REJECTED)'
    );
  }

  // ----------------------------------------------------
  // TEST 4: Notes and Submission Date Recording
  // ----------------------------------------------------
  {
    const submissionDate = new Date('2026-10-15T12:00:00Z');
    const updated = await ApplicationService.updateApplication(appRecord.id, userId, {
      status: 'APPLIED',
      notes: 'Submitted application on official portal. Confirmation ID: DAAD-9912.',
      submissionDate,
    });

    assert(
      Boolean(
        updated.notes?.includes('Confirmation ID: DAAD-9912') &&
        updated.submissionDate &&
        new Date(updated.submissionDate).toISOString() === submissionDate.toISOString()
      ),
      'Test 4: Successfully records notes and custom submission date'
    );
  }

  // ----------------------------------------------------
  // TEST 5: Checklist Management (Add, Toggle, Delete, Template)
  // ----------------------------------------------------
  {
    // Add custom task
    const newTask = await ApplicationService.addChecklistItem(appRecord.id, userId, 'Contact Professor Dr. Weber');
    assert(
      newTask && newTask.item === 'Contact Professor Dr. Weber' && !newTask.isCompleted,
      'Test 5a: Add custom checklist task'
    );

    // Toggle completion
    const toggled = await ApplicationService.toggleChecklistItem(newTask.id, userId);
    assert(toggled.isCompleted === true, 'Test 5b: Toggle checklist item completion');

    // Delete checklist task
    const deleted = await ApplicationService.deleteChecklistItem(newTask.id, userId);
    assert(deleted.success === true, 'Test 5c: Delete checklist item');

    // Populate standard template
    const appsAfterTemplate = await ApplicationService.populateStandardChecklist(appRecord.id, userId);
    const targetApp = appsAfterTemplate.find((a: any) => a.id === appRecord.id);
    assert(
      Boolean(targetApp && targetApp.checklists.some((c: any) => c.item.includes('CV') || c.item.includes('SOP'))),
      'Test 5d: Populate standard template checklist (CV, Transcript, SOP, Recommendations, Passport, Language Certificate)'
    );
  }

  // ----------------------------------------------------
  // TEST 6: View Deadlines and Days Remaining Calculation
  // ----------------------------------------------------
  {
    const deadlines = await DeadlineService.getDeadlines(userId);
    assert(Array.isArray(deadlines) && deadlines.length > 0, 'Test 6a: Fetch aggregated deadlines');

    const d7 = deadlines.find((d: any) => d.scholarship.id === sch7Days.id);
    assert(
      Boolean(d7 && d7.daysRemaining >= 6 && d7.daysRemaining <= 8 && d7.urgency === 'CRITICAL'),
      'Test 6b: Accurate days remaining calculation & CRITICAL urgency tagging (<=7 days)'
    );
  }

  // ----------------------------------------------------
  // TEST 7: Deadline Automation Engine - Milestones & Alerts
  // ----------------------------------------------------
  {
    // Reset status to PREPARING so notification is eligible
    await ApplicationService.updateStatus(appRecord.id, userId, 'PREPARING');

    const automationRes1 = await DeadlineAutomationService.runDeadlineAutomation({ forceAllMilestones: true });
    assert(
      automationRes1.notificationsCreated > 0,
      'Test 7a: Deadline Automation scans upcoming deadlines and creates notifications for 7-day milestone',
      automationRes1
    );

    // Verify notification record in DB
    const notifications = await prisma.notification.findMany({ where: { userId } });
    assert(
      notifications.some((n: any) => n.type === 'DEADLINE' && n.title.includes('DAAD')),
      'Test 7b: Notification record properly persisted in DB with title and link'
    );
  }

  // ----------------------------------------------------
  // TEST 8: Deduplication Protection
  // ----------------------------------------------------
  {
    const automationRes2 = await DeadlineAutomationService.runDeadlineAutomation({ forceAllMilestones: true });
    assert(
      automationRes2.duplicatesSuppressed > 0 && automationRes2.notificationsCreated === 0,
      'Test 8: Prevent duplicate notifications for same scholarship and milestone window'
    );
  }

  // ----------------------------------------------------
  // TEST 9: Edge Case - Suppress Notifications for Already Submitted Applications
  // ----------------------------------------------------
  {
    // Create new application for sch14Days with status APPLIED
    await ApplicationService.createApplication(userId, sch14Days.id, 'APPLIED');

    const automationRes3 = await DeadlineAutomationService.runDeadlineAutomation({ forceAllMilestones: true });
    assert(
      automationRes3.submittedSuppressed > 0,
      'Test 9: Suppress pre-submission deadline warnings for applications already in APPLIED / INTERVIEW / ACCEPTED status'
    );
  }

  // ----------------------------------------------------
  // TEST 10: Edge Case - Suppress Notifications for Rejected Applications
  // ----------------------------------------------------
  {
    // Update sch14Days application to REJECTED
    const app14 = await prisma.application.findFirst({ where: { userId, scholarshipId: sch14Days.id } });
    if (app14) {
      await ApplicationService.updateStatus(app14.id, userId, 'REJECTED');
    }

    const automationRes4 = await DeadlineAutomationService.runDeadlineAutomation({ forceAllMilestones: true });
    assert(
      automationRes4.rejectedSuppressed > 0,
      'Test 10: Suppress notifications for applications in REJECTED status'
    );
  }

  // Clean up created sample scholarships
  await prisma.scholarship.deleteMany({
    where: {
      id: { in: [sch7Days.id, sch14Days.id, schExpired.id] },
    },
  });

  console.log(`\n======================================================`);
  console.log(
    `Application & Deadline Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`
  );
  console.log(`======================================================\n`);

  if (passed === total) {
    console.log('🎉 All Application Tracker & Deadline Automation requirements verified successfully!');
  } else {
    process.exit(1);
  }
}

runApplicationAndDeadlineTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
