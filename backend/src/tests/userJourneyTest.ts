/**
 * End-to-end user journey tests.
 *
 * Drives the real Express app in-process via a lightweight HTTP client against a
 * live server, exercising the four journeys the product is specified around.
 * No test framework dependency — this runs under plain ts-node.
 *
 *   npm run test:journeys
 */
import http from 'http';
import app from '../index';
import { prisma } from '../utils/prisma';
import { runWorkflow } from '../automation/workflowRunner';

let baseUrl = '';
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: any, label: string, detail?: any) {
  if (condition) {
    passed++;
    console.log(`    PASS  ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`    FAIL  ${label}${detail !== undefined ? ` → ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
  }
}

interface Res {
  status: number;
  body: any;
}

function request(
  method: string,
  path: string,
  options: { token?: string; body?: any } = {}
): Promise<Res> {
  return new Promise((resolve, reject) => {
    const payload = options.body !== undefined ? JSON.stringify(options.body) : null;
    const url = new URL(baseUrl + path);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let body: any = {};
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = { raw };
          }
          resolve({ status: res.statusCode || 0, body });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const stamp = Date.now();
const student = { email: `journey.student.${stamp}@example.com`, password: 'JourneyTest123', fullName: 'Journey Student' };
const intruder = { email: `journey.intruder.${stamp}@example.com`, password: 'JourneyTest123', fullName: 'Intruder' };

async function main() {
  console.log('\n=== AI Scholarship Copilot — User Journey Tests ===\n');

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening on ${baseUrl}\n`);

  let token = '';
  let intruderToken = '';
  let scholarshipId = '';
  let applicationId = '';

  try {
    // =====================================================================
    console.log('JOURNEY 1: register → profile → recommendations → open → eligibility → save');
    // =====================================================================
    {
      const reg = await request('POST', '/api/auth/register', { body: student });
      assert(reg.status === 201 && reg.body.token, 'Register returns 201 with a token', reg.body);
      token = reg.body.token;

      // Regression: register/login/me previously returned the raw Prisma row, so these
      // JSON columns arrived as the strings "[]"/"{}". The client types them as arrays,
      // so the dashboard crashed on `.join` immediately after signing up.
      const regProfile = reg.body.user?.profile;
      assert(Boolean(regProfile), 'Register response includes a profile');
      assert(
        Array.isArray(regProfile?.targetCountries) &&
          Array.isArray(regProfile?.preferredFields) &&
          Array.isArray(regProfile?.skills),
        'Register response parses profile array columns (regression: were JSON strings)',
        {
          targetCountries: typeof regProfile?.targetCountries,
          preferredFields: typeof regProfile?.preferredFields,
          skills: typeof regProfile?.skills,
        }
      );
      assert(
        regProfile?.languageTests && typeof regProfile.languageTests === 'object' && !Array.isArray(regProfile.languageTests),
        'Register response parses languageTests into an object',
        typeof regProfile?.languageTests
      );

      const me = await request('GET', '/api/auth/me', { token });
      assert(
        Array.isArray(me.body?.profile?.targetCountries) && Array.isArray(me.body?.profile?.skills),
        '/auth/me parses profile array columns',
        typeof me.body?.profile?.targetCountries
      );

      const loginRes = await request('POST', '/api/auth/login', {
        body: { email: student.email, password: student.password },
      });
      assert(
        Array.isArray(loginRes.body?.user?.profile?.targetCountries),
        '/auth/login parses profile array columns',
        typeof loginRes.body?.user?.profile?.targetCountries
      );

      // Weak passwords must be rejected by the new policy.
      const weak = await request('POST', '/api/auth/register', {
        body: { email: `weak.${stamp}@example.com`, password: 'short', fullName: 'Weak' },
      });
      assert(weak.status === 400, 'Weak password is rejected with 400', weak.body);

      // Email casing must not create a second account.
      const dupe = await request('POST', '/api/auth/register', {
        body: { ...student, email: student.email.toUpperCase() },
      });
      assert(dupe.status === 409, 'Same email in different case is rejected as duplicate', dupe.body);

      const profileRes = await request('POST', '/api/profile', {
        token,
        body: {
          fullName: 'Journey Student',
          nationality: 'Pakistan',
          countryOfResidence: 'Pakistan',
          currentDegreeLevel: 'BACHELORS',
          fieldOfStudy: 'Computer Science',
          university: 'NUST',
          gpa: 3.7,
          maxGpa: 4.0,
          graduationYear: 2026,
          targetDegreeLevel: 'MASTERS',
          targetCountries: ['Germany', 'Sweden'],
          preferredFields: ['Computer Science', 'Artificial Intelligence'],
          languageTests: { IELTS: 7.5 },
          skills: ['Python', 'React'],
          workExperienceYears: 1.5,
        },
      });
      assert(profileRes.status === 200 && profileRes.body.gpa === 3.7, 'Profile saves and returns parsed values', profileRes.body);
      assert(
        Array.isArray(profileRes.body.targetCountries) && profileRes.body.targetCountries.length === 2,
        'targetCountries round-trips as an array'
      );

      // Partial update must not wipe the JSON array fields.
      const partial = await request('POST', '/api/profile', { token, body: { gpa: 3.8 } });
      assert(
        Array.isArray(partial.body.targetCountries) && partial.body.targetCountries.length === 2,
        'Partial update preserves targetCountries (regression: fields were being erased)',
        partial.body.targetCountries
      );
      assert(partial.body.maxGpa === 4.0, 'Partial update preserves maxGpa (regression: reset to 4.0)', partial.body.maxGpa);

      // Invalid GPA must be a 400, not a 500 from NaN reaching Prisma.
      const badGpa = await request('POST', '/api/profile', { token, body: { gpa: 'not-a-number' } });
      assert(badGpa.status === 400, 'Non-numeric GPA is rejected with 400', badGpa.body);

      const recs = await request('GET', '/api/recommendations', { token });
      assert(recs.status === 200 && Array.isArray(recs.body), 'Recommendations return an array', recs.body);
      assert(recs.body.length > 0, `Recommendations are non-empty (${recs.body.length})`);
      assert(
        recs.body.every((r: any) => typeof r.matchScore === 'number' && r.scholarship?.title),
        'Each recommendation carries a numeric matchScore and scholarship'
      );

      scholarshipId = recs.body[0]?.scholarship?.id;
      assert(Boolean(scholarshipId), 'Top recommendation exposes a scholarship id');

      const detail = await request('GET', `/api/scholarships/${scholarshipId}`, { token });
      assert(detail.status === 200 && detail.body.id === scholarshipId, 'Open scholarship detail', detail.body?.error);
      assert(Array.isArray(detail.body.degreeLevels), 'Detail parses degreeLevels into an array');

      const elig = await request('GET', `/api/scholarships/${scholarshipId}/eligibility`, { token });
      assert(elig.status === 200, 'Eligibility check returns 200', elig.body);
      assert(
        ['ELIGIBLE', 'POTENTIALLY_ELIGIBLE', 'NOT_ELIGIBLE', 'INSUFFICIENT_INFORMATION'].includes(
          elig.body.eligibilityStatus
        ),
        `Eligibility status is a valid enum value (${elig.body.eligibilityStatus})`
      );
      assert(typeof elig.body.disclaimer === 'string' && elig.body.disclaimer.length > 0, 'Eligibility includes an advisory disclaimer');

      const save = await request('POST', `/api/saved/${scholarshipId}`, { token });
      assert(save.status === 201, 'Save scholarship returns 201', save.body);

      const saveAgain = await request('POST', `/api/saved/${scholarshipId}`, { token });
      assert(saveAgain.status === 201, 'Saving twice is idempotent, not a 500', saveAgain.body);

      const savedList = await request('GET', '/api/saved', { token });
      assert(
        savedList.status === 200 && savedList.body.length === 1,
        `Saved list contains exactly one entry (${savedList.body.length})`
      );

      const bogusSave = await request('POST', '/api/saved/00000000-0000-0000-0000-000000000000', { token });
      assert(bogusSave.status === 404, 'Saving a non-existent scholarship returns 404 (not 500)', bogusSave.body);
    }

    // =====================================================================
    console.log('\nJOURNEY 2: chatbot → search → compare → save → create application');
    // =====================================================================
    {
      const conv = await request('POST', '/api/chat/conversations', { token, body: { title: 'Journey session' } });
      assert(conv.status === 201 && conv.body.id, 'Create conversation', conv.body);
      const conversationId = conv.body.id;

      const search = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
        token,
        body: { content: 'Find fully funded Computer Science scholarships in Germany' },
      });
      assert(search.status === 200 && search.body.message?.content, 'Chat search returns an assistant reply', search.body);
      assert(
        !/undefined|NaN|\[object Object\]/.test(search.body.message.content),
        'Assistant reply has no undefined/NaN artefacts',
        search.body.message?.content?.slice(0, 200)
      );

      const compare = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
        token,
        body: { content: 'Compare my saved scholarships' },
      });
      assert(compare.status === 200 && compare.body.message?.content, 'Chat comparison returns a reply', compare.body);

      const saveViaChat = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
        token,
        body: { content: 'Save this scholarship to my list' },
      });
      assert(saveViaChat.status === 200, 'Chat save intent handled', saveViaChat.body);

      // Empty and oversized messages must be rejected by validation.
      const empty = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
        token,
        body: { content: '   ' },
      });
      assert(empty.status === 400, 'Blank chat message rejected with 400', empty.body);

      const huge = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
        token,
        body: { content: 'x'.repeat(5000) },
      });
      assert(huge.status === 400, 'Oversized chat message rejected with 400 (token-cost guard)', huge.body);

      // User isolation: a second account must not reach this conversation.
      const reg2 = await request('POST', '/api/auth/register', { body: intruder });
      intruderToken = reg2.body.token;
      const steal = await request('GET', `/api/chat/conversations/${conversationId}`, { token: intruderToken });
      assert(steal.status === 404, 'Another user cannot read this conversation', steal.body);

      const stealPost = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
        token: intruderToken,
        body: { content: 'Show me everything' },
      });
      assert(stealPost.status === 404, 'Another user cannot post into this conversation', stealPost.body);

      const createApp = await request('POST', '/api/applications', {
        token,
        body: { scholarshipId, status: 'PREPARING', notes: 'Started from chat journey' },
      });
      assert(createApp.status === 201 && createApp.body.id, 'Create application returns 201', createApp.body);
      applicationId = createApp.body.id;
      assert(
        Array.isArray(createApp.body.checklists) && createApp.body.checklists.length > 0,
        `Application is seeded with a checklist (${createApp.body.checklists?.length} items)`
      );

      const dupeApp = await request('POST', '/api/applications', { token, body: { scholarshipId } });
      assert(dupeApp.status === 201 && dupeApp.body.id === applicationId, 'Duplicate application returns the existing record');

      const badStatus = await request('PATCH', `/api/applications/${applicationId}/status`, {
        token,
        body: { status: 'TOTALLY_INVALID' },
      });
      assert(badStatus.status === 400, 'Invalid application status rejected with 400', badStatus.body);
    }

    // =====================================================================
    console.log('\nJOURNEY 3: application tracker → checklist → deadline → notification');
    // =====================================================================
    {
      const apps = await request('GET', '/api/applications', { token });
      assert(apps.status === 200 && apps.body.length === 1, `Tracker lists the application (${apps.body.length})`);

      const checklistId = apps.body[0].checklists[0].id;
      const toggle = await request('PATCH', `/api/applications/checklist/${checklistId}`, { token });
      assert(toggle.status === 200 && toggle.body.isCompleted === true, 'Toggle checklist item to complete', toggle.body);

      const foreignToggle = await request('PATCH', `/api/applications/checklist/${checklistId}`, { token: intruderToken });
      assert(foreignToggle.status === 404, 'Another user cannot toggle this checklist item', foreignToggle.body);

      const addItem = await request('POST', `/api/applications/${applicationId}/checklist`, {
        token,
        body: { item: 'Journey-specific custom document' },
      });
      assert(addItem.status === 201, 'Add custom checklist item', addItem.body);

      const dupeItem = await request('POST', `/api/applications/${applicationId}/checklist`, {
        token,
        body: { item: 'Journey-specific custom document' },
      });
      assert(dupeItem.status === 409, 'Duplicate checklist item rejected with 409', dupeItem.body);

      const populate = await request('POST', `/api/applications/${applicationId}/populate-template`, { token });
      assert(populate.status === 200, 'Populate standard checklist template', populate.body);
      const afterPopulate = await request('GET', '/api/applications', { token });
      const items = afterPopulate.body[0].checklists.map((c: any) => c.item);
      assert(new Set(items).size === items.length, 'Template population created no duplicate checklist rows');

      // Give the application a near-term deadline so the reminder engine has work.
      const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await prisma.scholarship.update({ where: { id: scholarshipId }, data: { deadline: inThreeDays } });

      const deadlines = await request('GET', '/api/deadlines', { token });
      assert(deadlines.status === 200 && deadlines.body.length > 0, 'Deadline tracker returns the tracked scholarship', deadlines.body);
      const entry = deadlines.body.find((d: any) => d.scholarship.id === scholarshipId);
      assert(Boolean(entry), 'Tracked scholarship appears in the deadline list');
      assert(entry?.urgency === 'CRITICAL', `Three-day deadline is CRITICAL (got ${entry?.urgency})`);

      // A student must not be able to trigger the platform-wide sweep.
      const studentSweep = await request('POST', '/api/deadlines/run-automation', { token });
      assert(studentSweep.status === 403, 'Student cannot trigger the deadline sweep (admin only)', studentSweep.body);

      // Run it through the workflow engine instead.
      const run1 = await runWorkflow('deadline-reminder', { trigger: 'MANUAL', triggeredBy: 'journey-test' });
      assert(run1.status === 'SUCCESS', 'Deadline reminder workflow succeeds', run1.error);
      assert((run1.metrics?.notificationsCreated ?? 0) > 0, `Reminder created a notification (${run1.metrics?.notificationsCreated})`);

      const notifs = await request('GET', '/api/notifications', { token });
      assert(notifs.status === 200 && notifs.body.length > 0, 'Notification is visible to the student', notifs.body);
      const deadlineNotif = notifs.body.find((n: any) => n.type === 'DEADLINE');
      assert(Boolean(deadlineNotif), 'A DEADLINE notification exists');

      // Second run must suppress rather than duplicate.
      const run2 = await runWorkflow('deadline-reminder', { trigger: 'MANUAL', triggeredBy: 'journey-test' });
      assert(run2.status === 'SUCCESS', 'Second reminder run succeeds', run2.error);
      assert(
        (run2.metrics?.notificationsCreated ?? 0) === 0 && (run2.metrics?.duplicatesSuppressed ?? 0) > 0,
        `Re-run suppresses duplicates (created=${run2.metrics?.notificationsCreated}, suppressed=${run2.metrics?.duplicatesSuppressed})`
      );

      const read = await request('PATCH', `/api/notifications/${deadlineNotif.id}/read`, { token });
      assert(read.status === 200, 'Mark notification as read', read.body);

      const foreignRead = await request('PATCH', `/api/notifications/${deadlineNotif.id}/read`, { token: intruderToken });
      assert(foreignRead.status === 404, 'Another user cannot mark this notification read', foreignRead.body);
    }

    // =====================================================================
    console.log('\nJOURNEY 4: discovery → verification → database → matching → notification');
    // =====================================================================
    {
      const uniqueTitle = `Journey Test Scholarship ${stamp}`;
      const discovery = await runWorkflow('scholarship-discovery', {
        trigger: 'MANUAL',
        triggeredBy: 'journey-test',
        payload: {
          items: [
            {
              title: uniqueTitle,
              provider: 'Journey Test Foundation',
              country: 'Germany',
              degreeLevels: ['MASTERS'],
              fieldsOfStudy: ['Computer Science', 'Artificial Intelligence'],
              fundingType: 'FULL_FUNDING',
              tuitionCoverage: '100% tuition waiver',
              stipend: '€1,200 per month',
              minGpa: 3.0,
              deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
              officialUrl: `https://example.org/journey-${stamp}`,
              sourceName: 'Journey Test Feed',
              eligibleNationalities: [],
              languageRequirements: { IELTS: 6.5 },
            },
          ],
        },
      });
      assert(discovery.status === 'SUCCESS', 'Discovery workflow succeeds', discovery.error);
      assert(discovery.metrics?.created === 1, `Discovery created one record (created=${discovery.metrics?.created})`);

      const created = await prisma.scholarship.findFirst({ where: { title: uniqueTitle } });
      assert(Boolean(created), 'Discovered scholarship is persisted');
      assert(
        created?.verificationStatus === 'PENDING_VERIFICATION',
        `New record is queued for verification (${created?.verificationStatus})`
      );

      const sources = await prisma.scholarshipSource.count({ where: { scholarshipId: created!.id } });
      assert(sources === 1, 'Source provenance recorded');

      // Re-ingesting the same payload must update, never duplicate.
      const rerun = await runWorkflow('scholarship-discovery', {
        trigger: 'MANUAL',
        triggeredBy: 'journey-test',
        payload: {
          items: [
            {
              title: uniqueTitle,
              provider: 'Journey Test Foundation',
              country: 'Germany',
              officialUrl: `https://example.org/journey-${stamp}`,
            },
          ],
        },
      });
      assert(rerun.metrics?.created === 0 && rerun.metrics?.updated === 1, 'Re-ingestion updates instead of duplicating');
      const countAfter = await prisma.scholarship.count({ where: { title: uniqueTitle } });
      assert(countAfter === 1, `Exactly one row exists for the title (${countAfter})`);

      const verification = await runWorkflow('scholarship-verification', {
        trigger: 'MANUAL',
        triggeredBy: 'journey-test',
        payload: { limit: 25 },
      });
      assert(verification.status === 'SUCCESS', 'Verification workflow succeeds', verification.error);
      assert((verification.metrics?.audited ?? 0) > 0, `Verification audited records (${verification.metrics?.audited})`);

      const verified = await prisma.scholarship.findUnique({ where: { id: created!.id } });
      assert(
        verified?.verificationStatus !== 'PENDING_VERIFICATION',
        `Record left the pending queue (now ${verified?.verificationStatus})`
      );
      assert(Boolean(verified?.verificationReport), 'A verification report was stored');

      const matching = await runWorkflow('personalized-matching', { trigger: 'MANUAL', triggeredBy: 'journey-test' });
      assert(matching.status === 'SUCCESS', 'Matching workflow succeeds', matching.error);
      assert((matching.metrics?.profilesProcessed ?? 0) > 0, `Matching processed profiles (${matching.metrics?.profilesProcessed})`);

      const profile = await prisma.studentProfile.findFirst({
        where: { user: { email: student.email } },
        select: { id: true },
      });
      const match = await prisma.scholarshipMatch.findUnique({
        where: { profileId_scholarshipId: { profileId: profile!.id, scholarshipId: created!.id } },
      });
      assert(Boolean(match), 'A match row exists for the new scholarship');
      assert((match?.matchPercentage ?? 0) >= 80, `New scholarship scores highly for this profile (${match?.matchPercentage})`);

      const notify = await runWorkflow('new-match-notification', {
        trigger: 'MANUAL',
        triggeredBy: 'journey-test',
        payload: { minMatchScore: 75 },
      });
      assert(notify.status === 'SUCCESS', 'Match-notification workflow succeeds', notify.error);
      assert((notify.metrics?.dispatched ?? 0) > 0, `Match notifications dispatched (${notify.metrics?.dispatched})`);

      const notifyAgain = await runWorkflow('new-match-notification', {
        trigger: 'MANUAL',
        triggeredBy: 'journey-test',
        payload: { minMatchScore: 75 },
      });
      assert(
        (notifyAgain.metrics?.dispatched ?? 0) === 0 && (notifyAgain.metrics?.suppressed ?? 0) > 0,
        `Re-run suppresses duplicate match notifications (dispatched=${notifyAgain.metrics?.dispatched})`
      );

      const userNotifs = await request('GET', '/api/notifications', { token });
      const matchNotif = userNotifs.body.find((n: any) => n.type === 'NEW_MATCH');
      assert(Boolean(matchNotif), 'Student received the NEW_MATCH notification');
      assert(
        typeof matchNotif?.link === 'string' && matchNotif.link.includes('/scholarships/'),
        'Match notification deep-links to the scholarship'
      );

      // Dispatch must claim rows so nothing is handed out twice.
      const dispatch1 = await runWorkflow('notification-dispatch', { trigger: 'MANUAL', triggeredBy: 'journey-test' });
      assert((dispatch1.metrics?.dispatched ?? 0) > 0, `Dispatch claimed notifications (${dispatch1.metrics?.dispatched})`);
      const dispatch2 = await runWorkflow('notification-dispatch', { trigger: 'MANUAL', triggeredBy: 'journey-test' });
      assert(
        (dispatch2.metrics?.dispatched ?? 0) === 0,
        `Second dispatch claims nothing (regression: unread rows were re-returned forever) — got ${dispatch2.metrics?.dispatched}`
      );

      // Expired records must be demoted out of the active catalogue.
      await prisma.scholarship.update({
        where: { id: created!.id },
        data: { deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), verificationStatus: 'VERIFIED' },
      });
      const monitor = await runWorkflow('scholarship-update-monitoring', { trigger: 'MANUAL', triggeredBy: 'journey-test' });
      assert(monitor.status === 'SUCCESS', 'Update-monitoring workflow succeeds', monitor.error);
      const expired = await prisma.scholarship.findUnique({ where: { id: created!.id } });
      assert(
        expired?.verificationStatus === 'EXPIRED',
        `Past-deadline record marked EXPIRED (regression: status was computed then discarded) — got ${expired?.verificationStatus}`
      );

      // Every run must be durably recorded.
      const runs = await prisma.workflowRun.count({ where: { triggeredBy: 'journey-test' } });
      assert(runs >= 9, `Workflow runs are persisted to the ledger (${runs})`);
    }

    // =====================================================================
    console.log('\nCROSS-CUTTING: authorization, validation, error handling');
    // =====================================================================
    {
      const noAuth = await request('GET', '/api/applications');
      assert(noAuth.status === 401, 'Protected route without a token returns 401', noAuth.body);

      const badToken = await request('GET', '/api/applications', { token: 'not-a-real-jwt' });
      assert(badToken.status === 401, 'Invalid token returns 401', badToken.body);

      const studentCreate = await request('POST', '/api/scholarships', {
        token,
        body: {
          title: 'Unauthorized Catalogue Write',
          provider: 'Attacker',
          hostCountry: 'Nowhere',
          degreeLevels: ['MASTERS'],
          fieldsOfStudy: ['Computer Science'],
          applicationProcess: 'Attempting to write to the shared catalogue.',
          officialUrl: 'https://example.org/attack',
        },
      });
      assert(studentCreate.status === 403, 'Student cannot create scholarships (broken access control fix)', studentCreate.body);

      const studentDelete = await request('DELETE', `/api/scholarships/${scholarshipId}`, { token });
      assert(studentDelete.status === 403, 'Student cannot delete scholarships', studentDelete.body);

      const studentQueue = await request('GET', '/api/scholarships/verification/queue', { token });
      assert(studentQueue.status === 403, 'Student cannot read the verification queue', studentQueue.body);

      const studentAutomation = await request('GET', '/api/automation/workflows', { token });
      assert(studentAutomation.status === 403, 'Student cannot read the automation console', studentAutomation.body);

      const anonAutomation = await request('POST', '/api/automation/workflows/scholarship-discovery/run');
      assert(anonAutomation.status === 401, 'Anonymous cannot trigger workflows', anonAutomation.body);

      const badId = await request('GET', '/api/scholarships/not-a-uuid', { token });
      assert(badId.status === 400, 'Malformed scholarship id returns 400', badId.body);

      const missing = await request('GET', '/api/scholarships/00000000-0000-0000-0000-000000000000', { token });
      assert(missing.status === 404, 'Unknown scholarship id returns 404', missing.body);

      const unknownRoute = await request('GET', '/api/does-not-exist');
      assert(unknownRoute.status === 404 && unknownRoute.body.error, 'Unknown route returns a JSON 404', unknownRoute.body);

      const health = await request('GET', '/api/health');
      assert(health.status === 200 && health.body.status === 'online', 'Health endpoint responds', health.body);

      const ready = await request('GET', '/api/health/ready');
      assert(ready.status === 200 && ready.body.database === 'connected', 'Readiness probe confirms the database', ready.body);

      // Cross-user data isolation on list endpoints.
      const intruderSaved = await request('GET', '/api/saved', { token: intruderToken });
      assert(intruderSaved.status === 200 && intruderSaved.body.length === 0, 'A new user sees no other user’s saved items');
      const intruderApps = await request('GET', '/api/applications', { token: intruderToken });
      assert(intruderApps.status === 200 && intruderApps.body.length === 0, 'A new user sees no other user’s applications');

      // Pagination bounds must be enforced.
      const overLimit = await request('GET', '/api/scholarships?limit=99999', { token });
      assert(overLimit.status === 400, 'Excessive page limit rejected with 400', overLimit.body);
    }
  } finally {
    // Clean up everything this run created.
    await prisma.user.deleteMany({ where: { email: { in: [student.email, intruder.email, `weak.${stamp}@example.com`] } } });
    await prisma.scholarship.deleteMany({ where: { title: { contains: `Journey Test Scholarship ${stamp}` } } });
    await prisma.workflowRun.deleteMany({ where: { triggeredBy: 'journey-test' } });
    await prisma.$disconnect();
    server.close();
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log(`${'='.repeat(60)}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\nJourney test harness crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
