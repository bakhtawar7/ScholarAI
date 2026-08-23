/**
 * Email transport diagnostic.
 *
 *   npm run check:email                 # report configuration only, send nothing
 *   npm run check:email -- you@mail.com # also attempt one real send to that address
 *
 * Exists because a broken email setup is almost invisible at runtime: every send is
 * fire-and-forget by design, so a rejected sender looks exactly like a quiet system.
 * This prints what will actually happen, and why, before a user is affected.
 */
import { config } from '../config';
import {
  EmailService,
  describeResendSenderProblem,
  isResendConfigured,
  isSandboxSender,
} from '../services/emailService';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const ok = (s: string) => console.log(`${GREEN}  OK  ${RESET}${s}`);
const bad = (s: string) => console.log(`${RED}  FAIL${RESET}  ${s}`);
const warn = (s: string) => console.log(`${YELLOW}  WARN${RESET}  ${s}`);
const note = (s: string) => console.log(`${DIM}        ${s}${RESET}`);

/** Never print a credential; confirming its shape is enough to diagnose. */
function maskKey(key: string): string {
  if (!key) return '(unset)';
  return key.length <= 10 ? '(set)' : `${key.slice(0, 6)}…${key.slice(-4)} (${key.length} chars)`;
}

async function main() {
  const target = process.argv[2];

  console.log('\nScholarAI — email transport check\n');

  console.log('Configuration');
  console.log(`        RESEND_API_KEY     ${maskKey(config.resend.apiKey)}`);
  console.log(`        RESEND_FROM_EMAIL  ${config.resend.fromEmail || '(unset)'}`);
  console.log(`        RESEND_FROM_NAME   ${config.resend.fromName || '(unset)'}`);
  console.log(`        RESEND_REPLY_TO    ${config.resend.replyTo || '(unset)'}`);
  console.log(`        SMTP_HOST          ${config.smtp.host || '(unset)'}`);
  console.log('');

  console.log('Diagnosis');

  const senderProblem = describeResendSenderProblem();

  if (!config.resend.apiKey && !config.smtp.host) {
    bad('No transport configured at all. Every email is written to the log and discarded.');
    note('Set RESEND_API_KEY + RESEND_FROM_EMAIL, or SMTP_HOST + credentials.');
  } else if (senderProblem) {
    bad(senderProblem);
    if (config.smtp.host) {
      note(`SMTP is configured, so sends will fall back to ${config.smtp.host}.`);
    } else {
      note('There is no SMTP fallback, so nothing will be delivered.');
    }
  } else if (isResendConfigured() && isSandboxSender()) {
    warn("Resend is working, but the sandbox sender only delivers to the Resend account owner's own address.");
    note('Any other recipient is rejected with 403. Verify a domain at https://resend.com/domains before launch.');
  } else if (isResendConfigured()) {
    ok(`Resend configured with a custom sender (${config.resend.fromEmail}).`);
    note('This check cannot confirm the domain is verified — a send-only key may not read /domains.');
    note('Pass a recipient to this script to prove delivery end to end.');
  } else if (config.smtp.host) {
    ok(`SMTP configured (${config.smtp.host}:${config.smtp.port}).`);
  }

  console.log('');
  console.log(`Effective transport: ${EmailService.describeTransport()}`);

  const warnings = EmailService.configWarnings();
  if (warnings.length) {
    console.log('');
    console.log('Warnings printed at boot:');
    warnings.forEach((w) => note(`- ${w}`));
  }

  if (!target) {
    console.log('');
    note('No recipient given — nothing was sent. Re-run with an address to attempt a real send:');
    note('  npm run check:email -- you@example.com');
    console.log('');
    return;
  }

  console.log('');
  console.log(`Attempting one real send to ${target} …`);

  const result = await EmailService.sendWelcome(target, { fullName: 'Transport Check' });

  console.log('');
  if (result.sent) {
    ok(`Accepted by "${result.channel}"${result.id ? ` (id ${result.id})` : ''}. Check the inbox, including spam.`);
  } else {
    bad(`Not sent. Channel "${result.channel}". ${result.error || ''}`);
    if (result.channel === 'log') {
      note('"log" means the message never left the process.');
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error(`${RED}Check failed to run:${RESET}`, err?.message || err);
  process.exit(1);
});
