/**
 * Runs every backend suite in one command.
 *
 *   npm test                        # all offline suites
 *   npm test -- --include-network   # also the suites that call live external services
 *   npm test -- --only matching     # substring filter on suite name
 *   npm test -- --keep-db           # leave the scratch database behind for inspection
 *
 * Two problems this solves.
 *
 * Seven of the nine suites had no npm script, so roughly 80 KB of tests were unreachable
 * and silently rotted. Every suite is now enumerated here, and a new file that is not
 * listed shows up as a warning rather than being quietly skipped.
 *
 * Suites also ran against whatever DATABASE_URL pointed at — normally the working dev
 * database. They clean up after themselves, but a crash mid-run left orphaned rows in the
 * database being developed against. Each run now gets a disposable copy instead.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface Suite {
  /** Filename in src/tests, without extension. */
  file: string;
  label: string;
  /** True when the suite calls a live external service (search providers, LLM, SMTP). */
  network?: boolean;
}

const SUITES: Suite[] = [
  { file: 'authAndProfileTest', label: 'Auth & profile' },
  { file: 'scholarshipExplorerTest', label: 'Scholarship explorer' },
  { file: 'matchingEligibilityTest', label: 'Matching & eligibility' },
  { file: 'applicationAndDeadlineAutomationTest', label: 'Applications & deadlines' },
  { file: 'scholarshipVerificationAgentTest', label: 'Verification agent' },
  { file: 'cvAndSOPAssistanceTest', label: 'CV & SOP assistance' },
  { file: 'chatbotOrchestratorTest', label: 'Chatbot orchestrator' },
  { file: 'userJourneyTest', label: 'End-to-end user journeys' },
  { file: 'externalDiscoveryTest', label: 'External discovery (live search)', network: true },
];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const includeNetwork = args.includes('--include-network');
const keepDb = args.includes('--keep-db');
const onlyIndex = args.indexOf('--only');
const onlyFilter = onlyIndex >= 0 ? (args[onlyIndex + 1] || '').toLowerCase() : '';

const testsDir = path.join(__dirname);
const backendRoot = path.resolve(__dirname, '..', '..');

/** Warns about suites on disk that nobody registered here. */
function warnUnregisteredSuites() {
  const onDisk = fs
    .readdirSync(testsDir)
    .filter((f) => f.endsWith('Test.ts'))
    .map((f) => f.replace(/\.ts$/, ''));
  const registered = new Set(SUITES.map((s) => s.file));
  const missing = onDisk.filter((f) => !registered.has(f));

  if (missing.length > 0) {
    console.log(`${YELLOW}Warning:${RESET} these suites exist but are not registered in runAll.ts:`);
    missing.forEach((m) => console.log(`  - ${m}`));
    console.log('');
  }
}

/**
 * Copies the working database to a scratch file and points DATABASE_URL at it.
 *
 * Copying rather than migrating from empty keeps the seeded catalogue the suites read,
 * while guaranteeing they cannot corrupt the database being developed against.
 */
function prepareScratchDatabase(): { url: string; cleanup: () => void } {
  const current = process.env.DATABASE_URL || 'file:./dev.db';
  const fileMatch = /^file:(.+)$/.exec(current);

  if (!fileMatch) {
    // A non-file datasource (Postgres) is used as-is: silently cloning a remote database
    // is not something this script should attempt.
    console.log(`${DIM}Non-file DATABASE_URL detected — running against it directly.${RESET}\n`);
    return { url: current, cleanup: () => undefined };
  }

  const sourcePath = path.resolve(backendRoot, 'prisma', fileMatch[1].replace(/^\.\//, ''));
  if (!fs.existsSync(sourcePath)) {
    console.log(
      `${YELLOW}No database at ${sourcePath} — run "npm run prisma:deploy && npm run prisma:seed" first.${RESET}\n`
    );
    process.exit(1);
  }

  const scratchPath = path.join(path.dirname(sourcePath), `test-run-${process.pid}.db`);
  fs.copyFileSync(sourcePath, scratchPath);

  return {
    url: `file:./${path.basename(scratchPath)}`,
    cleanup: () => {
      if (keepDb) {
        console.log(`${DIM}Scratch database kept at ${scratchPath}${RESET}`);
        return;
      }
      for (const suffix of ['', '-journal', '-wal', '-shm']) {
        const f = `${scratchPath}${suffix}`;
        if (fs.existsSync(f)) {
          try {
            fs.unlinkSync(f);
          } catch {
            /* a lingering handle is not worth failing the run over */
          }
        }
      }
    },
  };
}

function runSuite(suite: Suite, databaseUrl: string): { passed: boolean; durationMs: number } {
  const started = Date.now();
  console.log(`${BOLD}▶ ${suite.label}${RESET} ${DIM}(${suite.file})${RESET}`);

  const result = spawnSync(
    process.execPath,
    [path.join(backendRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'), path.join(testsDir, `${suite.file}.ts`)],
    {
      cwd: backendRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        // Background workflows firing mid-suite would race the assertions.
        AUTOMATION_ENABLED: 'false',
        // Verification asserts on field audits, not on live URL reachability.
        URL_CHECK_ENABLED: process.env.URL_CHECK_ENABLED || 'false',
        /**
         * No outbound mail during tests.
         *
         * The suites were reaching the live Resend API with @example.com recipients on
         * every run: real network calls, real rate-limit consumption, and a
         * non-deterministic ledger — notification-dispatch releases rows a *configured*
         * transport rejected, so whether the second dispatch claimed anything depended on
         * a provider's response. Log-only makes the ledger assertions deterministic.
         */
        RESEND_API_KEY: '',
        RESEND_FROM_EMAIL: '',
        SMTP_HOST: '',
        NODE_ENV: 'test',
      },
    }
  );

  return { passed: result.status === 0, durationMs: Date.now() - started };
}

function main() {
  console.log(`\n${BOLD}ScholarAI backend test suites${RESET}\n`);
  warnUnregisteredSuites();

  let selected = SUITES.filter((s) => includeNetwork || !s.network);
  const skippedForNetwork = SUITES.filter((s) => s.network && !includeNetwork);

  if (onlyFilter) {
    selected = selected.filter(
      (s) => s.file.toLowerCase().includes(onlyFilter) || s.label.toLowerCase().includes(onlyFilter)
    );
    if (selected.length === 0) {
      console.log(`${RED}No suite matches "--only ${onlyFilter}".${RESET}`);
      process.exit(1);
    }
  }

  const scratch = prepareScratchDatabase();
  const results: Array<{ suite: Suite; passed: boolean; durationMs: number }> = [];

  try {
    for (const suite of selected) {
      const outcome = runSuite(suite, scratch.url);
      results.push({ suite, ...outcome });
      console.log('');
    }
  } finally {
    scratch.cleanup();
  }

  const failed = results.filter((r) => !r.passed);

  console.log(`${BOLD}Summary${RESET}`);
  for (const r of results) {
    const mark = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    console.log(`  ${mark}  ${r.suite.label} ${DIM}(${(r.durationMs / 1000).toFixed(1)}s)${RESET}`);
  }
  for (const s of skippedForNetwork) {
    console.log(`  ${YELLOW}SKIP${RESET}  ${s.label} ${DIM}(needs network — pass --include-network)${RESET}`);
  }

  console.log('');
  if (failed.length > 0) {
    console.log(`${RED}${failed.length} of ${results.length} suite(s) failed.${RESET}\n`);
    process.exit(1);
  }
  console.log(`${GREEN}All ${results.length} suite(s) passed.${RESET}\n`);
}

main();
