import * as Sentry from '@sentry/node';
import { config } from '../config';
import { logger } from './logger';

/**
 * Sentry initialisation and safe capture helpers.
 *
 * Privacy is the design constraint here. This app handles credentials, JWTs, CV text and
 * SOP drafts — none of which may leave the process. Rather than relying on Sentry's
 * default scrubbing, every event passes through `scrubEvent` below, which drops request
 * bodies entirely and allowlists the headers that are safe to keep.
 *
 * No DSN means Sentry stays inert: `isSentryEnabled()` is false and every capture helper
 * becomes a no-op, so local development and CI make no outbound calls.
 */

/** Header names that must never reach Sentry. */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
]);

/** Query/extra keys whose values are replaced with a placeholder. */
const SENSITIVE_KEY_PATTERN =
  /pass(word)?|secret|token|jwt|api[-_]?key|authorization|cookie|cvtext|cv_text|drafttext|draft_text|sop|resume|credential|otp|dsn/i;

const REDACTED = '[redacted]';

function scrubObject(input: any, depth = 0): any {
  if (input === null || input === undefined) return input;
  if (depth > 4) return REDACTED;

  if (Array.isArray(input)) return input.map((v) => scrubObject(v, depth + 1));

  if (typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = REDACTED;
      } else if (typeof value === 'object') {
        out[key] = scrubObject(value, depth + 1);
      } else if (typeof value === 'string' && value.length > 500) {
        // Long free-text is almost certainly document content (CV/SOP) — drop the body,
        // keep the shape so the event is still diagnosable.
        out[key] = `${REDACTED} (${value.length} chars)`;
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  return input;
}

/**
 * Final gate before an event is sent.
 *
 * Strips request bodies, non-allowlisted headers, and any sensitive-looking key in
 * query params or extra context. Keeps the user id but never the email or profile.
 */
function scrubEvent(event: Sentry.Event): Sentry.Event | null {
  if (event.request) {
    // Bodies can contain passwords, CV text and SOP drafts. Never send them.
    delete event.request.data;
    delete event.request.cookies;

    if (event.request.headers) {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(event.request.headers)) {
        if (!SENSITIVE_HEADERS.has(name.toLowerCase())) headers[name] = String(value);
      }
      event.request.headers = headers;
    }

    if (event.request.query_string && typeof event.request.query_string === 'object') {
      event.request.query_string = scrubObject(event.request.query_string);
    }
  }

  // Identify the account for triage, but carry no other personal data.
  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : {};
  }

  if (event.extra) event.extra = scrubObject(event.extra);
  if (event.contexts?.state) delete event.contexts.state;

  return event;
}

let initialised = false;

export function initSentry(): void {
  if (initialised) return;

  if (!config.sentry.dsn) {
    logger.info('Sentry is not configured (SENTRY_DSN unset) — error reporting disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.sentry.environment,
      release: config.sentry.release,
      tracesSampleRate: config.sentry.tracesSampleRate,
      // Breadcrumbs can capture request/response payloads; keep them off.
      sendDefaultPii: false,
      maxValueLength: 2000,
      beforeSend: (event) => scrubEvent(event),
      beforeSendTransaction: (event) => scrubEvent(event as Sentry.Event) as any,
      initialScope: {
        tags: { app: 'ScholarAI', component: 'backend' },
      },
    });

    initialised = true;
    logger.info('Sentry initialised', {
      environment: config.sentry.environment,
      tracesSampleRate: config.sentry.tracesSampleRate,
    });
  } catch (err: any) {
    // A misconfigured DSN must never stop the API from booting.
    logger.error('Sentry initialisation failed — continuing without error reporting', { message: err?.message });
  }
}

export function isSentryEnabled(): boolean {
  return initialised;
}

export interface CaptureContext {
  /** Logical area, e.g. 'external-search', 'email', 'database', 'ai'. */
  area?: string;
  /** Authenticated user id, when known. Never an email. */
  userId?: string;
  /** Extra diagnostic detail. Scrubbed before sending. */
  extra?: Record<string, any>;
  level?: Sentry.SeverityLevel;
}

/**
 * Reports an exception. Safe to call unconditionally — a no-op without a DSN.
 * Never throws, so a reporting failure cannot break the calling request.
 */
export function captureException(err: unknown, context: CaptureContext = {}): void {
  if (!initialised) return;

  try {
    Sentry.withScope((scope) => {
      if (context.area) scope.setTag('area', context.area);
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.level) scope.setLevel(context.level);
      if (context.extra) scope.setContext('detail', scrubObject(context.extra));
      Sentry.captureException(err);
    });
  } catch {
    // Reporting is best-effort by definition.
  }
}

/** Reports a noteworthy non-exception condition (quota exhausted, delivery failure). */
export function captureMessage(message: string, context: CaptureContext = {}): void {
  if (!initialised) return;

  try {
    Sentry.withScope((scope) => {
      if (context.area) scope.setTag('area', context.area);
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.extra) scope.setContext('detail', scrubObject(context.extra));
      Sentry.captureMessage(message, context.level || 'warning');
    });
  } catch {
    // Best-effort.
  }
}

/** Flushes buffered events during shutdown so in-flight reports are not lost. */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialised) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Best-effort.
  }
}

export { Sentry };
