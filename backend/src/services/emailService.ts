import { Resend } from 'resend';
import { config } from '../config';
import { logger } from '../utils/logger';
import { captureException, captureMessage } from '../utils/sentry';
import { deliverMessages } from './deliveryService';

/**
 * Centralised ScholarAI email service.
 *
 * One place that knows how to render and send every transactional email, so callers pass
 * typed data rather than assembling subjects and bodies themselves.
 *
 * Transport order: Resend when RESEND_API_KEY is set, otherwise the existing SMTP
 * transport, otherwise log-only. That keeps existing SMTP deployments working untouched
 * and makes the whole thing a no-op in local development.
 *
 * Every send is failure-tolerant by contract: `sendEmail` resolves with a result object
 * and never throws, because an email problem must not fail the request that triggered it
 * (registration, a password reset, a workflow batch).
 */

export type EmailEvent =
  | 'welcome'
  | 'password-reset'
  | 'scholarship-match'
  | 'deadline-reminder'
  | 'application-update';

export interface EmailResult {
  sent: boolean;
  /** Which transport handled it. 'log' means nothing left the process. */
  channel: 'resend' | 'smtp' | 'log';
  /** Provider message id, when available. */
  id?: string;
  error?: string;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!config.resend.apiKey) return null;
  if (!resendClient) resendClient = new Resend(config.resend.apiKey);
  return resendClient;
}

export function isResendConfigured(): boolean {
  return Boolean(config.resend.apiKey && config.resend.fromEmail);
}

/** `Name <email>` for the configured sender. */
function fromAddress(): string {
  return `${config.resend.fromName} <${config.resend.fromEmail}>`;
}

/** Escapes user-supplied values before interpolating them into HTML. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND = 'ScholarAI';

/**
 * Shared shell for every email.
 *
 * Inline styles only — email clients strip <style> blocks and external CSS.
 */
function layout(opts: { heading: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string; footerNote?: string }): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<tr><td style="padding:8px 0 24px;">
           <a href="${esc(opts.ctaUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;font-size:15px;">${esc(
          opts.ctaLabel
        )}</a>
         </td></tr>`
      : '';

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;padding:32px;">
        <tr><td style="padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:19px;font-weight:700;color:#4f46e5;">${BRAND}</span>
          <span style="font-size:13px;color:#6b7280;"> · Scholarship discovery assistant</span>
        </td></tr>
        <tr><td style="padding:24px 0 12px;font-size:20px;font-weight:600;color:#111827;">${esc(opts.heading)}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:#374151;padding-bottom:20px;">${opts.bodyHtml}</td></tr>
        ${cta}
        <tr><td style="padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#9ca3af;">
          ${opts.footerNote ? `${esc(opts.footerNote)}<br><br>` : ''}
          Sent by ${BRAND}. Always confirm scholarship details and deadlines on the provider's official page before applying.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Plain-text fallback. Required: some clients and most spam filters want it. */
function toText(lines: string[], ctaUrl?: string): string {
  const body = lines.filter(Boolean).join('\n\n');
  return `${BRAND}\n\n${body}${ctaUrl ? `\n\n${ctaUrl}` : ''}\n\n—\nSent by ${BRAND}. Confirm details on the provider's official page before applying.`;
}

export interface WelcomeData {
  fullName?: string;
  appUrl?: string;
}
export interface PasswordResetData {
  fullName?: string;
  resetUrl: string;
  expiresInMinutes?: number;
}
export interface ScholarshipMatchData {
  fullName?: string;
  scholarships: Array<{ title: string; hostCountry?: string; matchScore?: number; deadline?: string | Date | null; officialUrl?: string }>;
  appUrl?: string;
}
export interface DeadlineReminderData {
  fullName?: string;
  scholarshipTitle: string;
  deadline: string | Date;
  daysRemaining: number;
  officialUrl?: string;
  appUrl?: string;
}
export interface ApplicationUpdateData {
  fullName?: string;
  scholarshipTitle: string;
  status: string;
  notes?: string | null;
  appUrl?: string;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return 'not stated';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? 'not stated'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const appLink = (path = '') => `${config.frontendUrl.replace(/\/+$/, '')}${path}`;

/** Renders one event. Kept pure so templates can be unit-tested without sending. */
export function renderEmail(event: 'welcome', data: WelcomeData): RenderedEmail;
export function renderEmail(event: 'password-reset', data: PasswordResetData): RenderedEmail;
export function renderEmail(event: 'scholarship-match', data: ScholarshipMatchData): RenderedEmail;
export function renderEmail(event: 'deadline-reminder', data: DeadlineReminderData): RenderedEmail;
export function renderEmail(event: 'application-update', data: ApplicationUpdateData): RenderedEmail;
export function renderEmail(event: EmailEvent, data: any): RenderedEmail {
  const name = data?.fullName ? String(data.fullName).split(' ')[0] : 'there';

  switch (event) {
    case 'welcome': {
      const url = data.appUrl || appLink('/scholarships');
      return {
        subject: `Welcome to ${BRAND}`,
        html: layout({
          heading: `Welcome, ${esc(name)}`,
          bodyHtml: `<p>Your ${BRAND} account is ready.</p>
            <p>${BRAND} searches live external sources — official university pages and government scholarship portals — to find current opportunities, then checks them against your academic profile.</p>
            <p>To get the most accurate matches, complete your profile with your degree level, field of study, GPA and target countries.</p>`,
          ctaLabel: 'Find scholarships',
          ctaUrl: url,
        }),
        text: toText(
          [
            `Welcome, ${name}.`,
            `Your ${BRAND} account is ready.`,
            `${BRAND} searches live external sources — official university pages and government scholarship portals — to find current opportunities, then checks them against your profile.`,
            'Complete your profile (degree level, field of study, GPA, target countries) for the most accurate matches.',
          ],
          url
        ),
      };
    }

    case 'password-reset': {
      const mins = data.expiresInMinutes || 60;
      return {
        subject: `Reset your ${BRAND} password`,
        html: layout({
          heading: 'Reset your password',
          bodyHtml: `<p>Hi ${esc(name)},</p>
            <p>We received a request to reset the password for your ${BRAND} account. This link expires in <strong>${esc(
            mins
          )} minutes</strong>.</p>
            <p>If you did not request this, you can ignore this email — your password will not change.</p>`,
          ctaLabel: 'Reset password',
          ctaUrl: data.resetUrl,
          footerNote: 'For your security, never forward this email or share the link.',
        }),
        text: toText(
          [
            `Hi ${name},`,
            `We received a request to reset the password for your ${BRAND} account. This link expires in ${mins} minutes.`,
            'If you did not request this, ignore this email — your password will not change.',
          ],
          data.resetUrl
        ),
      };
    }

    case 'scholarship-match': {
      const list = (data.scholarships || []).slice(0, 5);
      const url = data.appUrl || appLink('/recommendations');
      const items = list
        .map(
          (s: any) =>
            `<li style="margin-bottom:12px;">
               <strong>${esc(s.title)}</strong>${s.hostCountry ? ` — ${esc(s.hostCountry)}` : ''}<br>
               ${s.matchScore !== undefined && s.matchScore !== null ? `Match estimate: <strong>${esc(s.matchScore)}%</strong> · ` : ''}Deadline: ${esc(
              formatDate(s.deadline)
            )}
               ${s.officialUrl ? `<br><a href="${esc(s.officialUrl)}" style="color:#4f46e5;">Official page</a>` : ''}
             </li>`
        )
        .join('');

      return {
        subject:
          list.length === 1
            ? `New scholarship match: ${list[0].title}`.slice(0, 120)
            : `${list.length} new scholarship matches for you`,
        html: layout({
          heading: list.length === 1 ? 'A new match for your profile' : `${list.length} new matches for your profile`,
          bodyHtml: `<p>Hi ${esc(name)},</p>
            <p>${BRAND} found ${list.length === 1 ? 'a scholarship' : 'scholarships'} matching your profile:</p>
            <ul style="padding-left:18px;margin:0;">${items}</ul>`,
          ctaLabel: 'View matches',
          ctaUrl: url,
          footerNote:
            'Match estimates are advisory only and are not an eligibility decision. Confirm official requirements with the provider.',
        }),
        text: toText(
          [
            `Hi ${name},`,
            `${BRAND} found ${list.length === 1 ? 'a scholarship' : `${list.length} scholarships`} matching your profile:`,
            list
              .map(
                (s: any) =>
                  `- ${s.title}${s.hostCountry ? ` (${s.hostCountry})` : ''}\n  Deadline: ${formatDate(s.deadline)}${
                    s.officialUrl ? `\n  ${s.officialUrl}` : ''
                  }`
              )
              .join('\n'),
            'Match estimates are advisory only, not an eligibility decision.',
          ],
          url
        ),
      };
    }

    case 'deadline-reminder': {
      const url = data.appUrl || appLink('/applications');
      const urgent = data.daysRemaining <= 3;
      return {
        subject: `${urgent ? 'Closing soon' : 'Reminder'}: ${data.scholarshipTitle} — ${data.daysRemaining} day${
          data.daysRemaining === 1 ? '' : 's'
        } left`.slice(0, 140),
        html: layout({
          heading: `${data.daysRemaining} day${data.daysRemaining === 1 ? '' : 's'} until this deadline`,
          bodyHtml: `<p>Hi ${esc(name)},</p>
            <p><strong>${esc(data.scholarshipTitle)}</strong> closes on <strong>${esc(formatDate(data.deadline))}</strong>.</p>
            ${urgent ? '<p style="color:#b91c1c;"><strong>This is one of your final reminders for this application.</strong></p>' : ''}
            <p>Check that your documents, transcripts and references are ready before submitting.</p>`,
          ctaLabel: data.officialUrl ? 'Open official page' : 'Open application tracker',
          ctaUrl: data.officialUrl || url,
        }),
        text: toText(
          [
            `Hi ${name},`,
            `${data.scholarshipTitle} closes on ${formatDate(data.deadline)} — ${data.daysRemaining} day(s) remaining.`,
            'Check your documents, transcripts and references are ready before submitting.',
          ],
          data.officialUrl || url
        ),
      };
    }

    case 'application-update': {
      const url = data.appUrl || appLink('/applications');
      const readable = String(data.status || '').replace(/_/g, ' ').toLowerCase();
      return {
        subject: `Application update: ${data.scholarshipTitle}`.slice(0, 140),
        html: layout({
          heading: 'Your application status changed',
          bodyHtml: `<p>Hi ${esc(name)},</p>
            <p>The status of your application for <strong>${esc(data.scholarshipTitle)}</strong> is now
               <strong style="text-transform:capitalize;">${esc(readable)}</strong>.</p>
            ${data.notes ? `<p style="background:#f9fafb;padding:12px;border-radius:6px;"><em>${esc(data.notes)}</em></p>` : ''}`,
          ctaLabel: 'Open application tracker',
          ctaUrl: url,
        }),
        text: toText(
          [
            `Hi ${name},`,
            `The status of your application for ${data.scholarshipTitle} is now ${readable}.`,
            data.notes ? `Notes: ${data.notes}` : '',
          ],
          url
        ),
      };
    }

    default: {
      // Exhaustiveness guard: a new event without a template fails loudly at compile time.
      const never: never = event;
      throw new Error(`No email template for event: ${never}`);
    }
  }
}

/**
 * Sends one rendered email.
 *
 * Never throws. Failures are logged and reported to Sentry, then returned as
 * `{ sent: false }` so the caller can decide whether it matters.
 */
async function sendRendered(to: string, rendered: RenderedEmail, event: EmailEvent, userId?: string): Promise<EmailResult> {
  const recipient = String(to || '').trim();

  if (!recipient || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
    logger.warn('Email not sent — invalid recipient', { event });
    return { sent: false, channel: 'log', error: 'Invalid recipient address.' };
  }

  const resend = getResend();

  if (resend && config.resend.fromEmail) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromAddress(),
        to: recipient,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(config.resend.replyTo ? { replyTo: config.resend.replyTo } : {}),
      });

      if (error) {
        // Resend reports failures in the response rather than throwing.
        throw Object.assign(new Error(error.message || 'Resend rejected the message.'), { name: error.name });
      }

      logger.info('Email sent via Resend', { event, id: data?.id });
      return { sent: true, channel: 'resend', id: data?.id };
    } catch (err: any) {
      logger.error('Resend delivery failed', { event, message: err?.message });
      captureException(err, {
        area: 'email',
        userId,
        extra: { event, transport: 'resend', subject: rendered.subject },
      });
      // Fall through to SMTP so a provider outage is not a total loss.
    }
  }

  // SMTP fallback (or log-only when SMTP is unconfigured).
  try {
    const result = await deliverMessages([{ to: recipient, subject: rendered.subject, text: rendered.text }]);

    if (result.delivered > 0) {
      logger.info('Email sent via SMTP fallback', { event });
      return { sent: true, channel: 'smtp' };
    }

    if (result.channel === 'log') {
      logger.info('Email not dispatched — no transport configured (logged only)', { event, to: recipient });
      return { sent: false, channel: 'log', error: 'No email transport configured (RESEND_API_KEY / SMTP_HOST unset).' };
    }

    const detail = result.errors[0] || 'SMTP delivery failed.';
    captureMessage('Email delivery failed on all transports', {
      area: 'email',
      userId,
      extra: { event, detail },
    });
    return { sent: false, channel: 'smtp', error: detail };
  } catch (err: any) {
    logger.error('Email delivery failed', { event, message: err?.message });
    captureException(err, { area: 'email', userId, extra: { event, transport: 'smtp' } });
    return { sent: false, channel: 'log', error: err?.message || 'Email delivery failed.' };
  }
}

/**
 * ScholarAI transactional email API.
 *
 * Each method renders its template and dispatches it. All of them resolve rather than
 * reject, so `void EmailService.sendWelcome(...)` is a safe fire-and-forget call from a
 * request handler.
 */
export class EmailService {
  static isConfigured(): boolean {
    return isResendConfigured() || Boolean(config.smtp.host);
  }

  /** Describes the active transport, for boot logging and health output. */
  static describeTransport(): string {
    if (isResendConfigured()) return `resend (from ${config.resend.fromEmail})`;
    if (config.resend.apiKey && !config.resend.fromEmail) return 'resend key set but RESEND_FROM_EMAIL missing — falling back';
    if (config.smtp.host) return `smtp (${config.smtp.host}:${config.smtp.port})`;
    return 'none (emails are logged only)';
  }

  static sendWelcome(to: string, data: WelcomeData = {}, userId?: string): Promise<EmailResult> {
    return sendRendered(to, renderEmail('welcome', data), 'welcome', userId);
  }

  static sendPasswordReset(to: string, data: PasswordResetData, userId?: string): Promise<EmailResult> {
    return sendRendered(to, renderEmail('password-reset', data), 'password-reset', userId);
  }

  static sendScholarshipMatch(to: string, data: ScholarshipMatchData, userId?: string): Promise<EmailResult> {
    if (!data.scholarships || data.scholarships.length === 0) {
      return Promise.resolve({ sent: false, channel: 'log', error: 'No scholarships supplied.' });
    }
    return sendRendered(to, renderEmail('scholarship-match', data), 'scholarship-match', userId);
  }

  static sendDeadlineReminder(to: string, data: DeadlineReminderData, userId?: string): Promise<EmailResult> {
    return sendRendered(to, renderEmail('deadline-reminder', data), 'deadline-reminder', userId);
  }

  static sendApplicationUpdate(to: string, data: ApplicationUpdateData, userId?: string): Promise<EmailResult> {
    return sendRendered(to, renderEmail('application-update', data), 'application-update', userId);
  }
}
