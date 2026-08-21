import * as Sentry from '@sentry/react';

/**
 * Browser error reporting for ScholarAI.
 *
 * Privacy is the design constraint. The SPA holds a JWT in localStorage and the CV/SOP
 * pages hold document text in component state, so nothing is reported by default:
 * `sendDefaultPii` is off, breadcrumbs that could carry a token or draft are dropped,
 * and every event passes `scrubEvent` before it is sent.
 *
 * Without `VITE_SENTRY_DSN` the module stays inert — `initSentry()` returns immediately
 * and each capture helper is a no-op, so development and CI make no outbound calls.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN?.trim() || '';
const REDACTED = '[redacted]';

/** Keys whose values must never leave the browser. */
const SENSITIVE_KEY_PATTERN =
  /pass(word)?|secret|token|jwt|api[-_]?key|authorization|cookie|cvtext|cv_text|drafttext|draft_text|sop|resume|credential|otp|dsn/i;

function scrubValue(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input;
  if (depth > 4) return REDACTED;

  if (Array.isArray(input)) return input.map((v) => scrubValue(v, depth + 1));

  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) out[key] = REDACTED;
      else if (typeof value === 'object') out[key] = scrubValue(value, depth + 1);
      // Long free text on these pages is almost certainly CV or SOP content.
      else if (typeof value === 'string' && value.length > 500) out[key] = `${REDACTED} (${value.length} chars)`;
      else out[key] = value;
    }
    return out;
  }

  return input;
}

/** Drops credentials and query strings from a URL before it is reported. */
function scrubUrl(raw: string): string {
  try {
    const url = new URL(raw, window.location.origin);
    url.username = '';
    url.password = '';
    if (url.search) url.search = '?[redacted]';
    return url.toString();
  } catch {
    return raw.split('?')[0];
  }
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    if (event.request.query_string) event.request.query_string = REDACTED;
  }

  // Keep the account id for triage; never the email or profile.
  if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : {};

  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => scrubBreadcrumb(crumb));
  }

  return event;
}

function scrubBreadcrumb(crumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  const next: Sentry.Breadcrumb = { ...crumb };

  if (next.data) {
    const data = scrubValue(next.data) as Record<string, unknown>;
    if (typeof data.url === 'string') data.url = scrubUrl(data.url);
    next.data = data;
  }

  // Console breadcrumbs carry whatever was logged, which on the CV/SOP pages can be
  // document text. Truncate rather than ship it.
  if (next.category === 'console' && typeof next.message === 'string' && next.message.length > 500) {
    next.message = `${next.message.slice(0, 500)}…[truncated]`;
  }

  return next;
}

let initialised = false;

export function initSentry(): void {
  if (initialised || !DSN) return;

  const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0);
  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

  try {
    Sentry.init({
      dsn: DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || `scholarai-frontend@${appVersion}`,
      tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
      sendDefaultPii: false,
      // Session Replay would record the CV and SOP editors verbatim. Never enable it here.
      integrations: [Sentry.browserTracingIntegration()],
      beforeSend: scrubEvent,
      beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
      initialScope: { tags: { app: 'ScholarAI', component: 'frontend' } },
    });
    initialised = true;
  } catch {
    // A bad DSN must never stop the app from mounting.
  }
}

export function isSentryEnabled(): boolean {
  return initialised;
}

/** Associates subsequent events with the signed-in account. Id only, never the email. */
export function setSentryUser(userId: string | null): void {
  if (!initialised) return;
  try {
    Sentry.setUser(userId ? { id: userId } : null);
  } catch {
    // Best-effort.
  }
}

export interface CaptureContext {
  /** Logical area, e.g. 'render', 'api'. */
  area?: string;
  extra?: Record<string, unknown>;
  level?: Sentry.SeverityLevel;
}

/** Reports an exception. Safe to call unconditionally; never throws. */
export function captureException(error: unknown, context: CaptureContext = {}): void {
  if (!initialised) return;
  try {
    Sentry.withScope((scope) => {
      if (context.area) scope.setTag('area', context.area);
      if (context.level) scope.setLevel(context.level);
      if (context.extra) scope.setContext('detail', scrubValue(context.extra) as Record<string, unknown>);
      Sentry.captureException(error);
    });
  } catch {
    // Reporting is best-effort by definition.
  }
}

export { Sentry };
