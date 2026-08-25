import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

/**
 * Values that must never silently fall back to a shipped default in production.
 * A guessable JWT secret lets anyone mint a valid token for any account, so the
 * process refuses to boot rather than run insecurely.
 */
const INSECURE_DEFAULT_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';

function requireInProduction(name: string, value: string | undefined, fallback: string): string {
  if (value && value.trim().length > 0) return value;
  if (isProduction) {
    throw new Error(
      `[config] ${name} is required when NODE_ENV=production. Refusing to start with an insecure default.`
    );
  }
  return fallback;
}

const jwtSecret = requireInProduction('JWT_SECRET', process.env.JWT_SECRET, INSECURE_DEFAULT_JWT_SECRET);

if (isProduction && jwtSecret.length < 32) {
  throw new Error('[config] JWT_SECRET must be at least 32 characters in production.');
}

if (!process.env.DATABASE_URL) {
  // Prisma reads DATABASE_URL directly from the environment; without it the
  // schema's env("DATABASE_URL") resolves to nothing and every query fails.
  if (isProduction) {
    throw new Error('[config] DATABASE_URL is required when NODE_ENV=production.');
  }
  process.env.DATABASE_URL = 'file:./dev.db';
}

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * LLM provider.
 *
 * The code uses the OpenAI SDK, but any provider exposing an OpenAI-compatible
 * `/chat/completions` endpoint works by setting LLM_BASE_URL. Google's Gemini does:
 *   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
 *   LLM_MODEL=gemini-3.6-flash
 *
 * Leave LLM_BASE_URL unset for OpenAI itself.
 */
const llmBaseUrl = (process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || '').trim().replace(/\/+$/, '');
const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';

/** Best-effort provider label, used only for startup logging. */
const llmProvider = !llmApiKey
  ? 'none'
  : /generativelanguage\.googleapis\.com/i.test(llmBaseUrl)
    ? 'gemini'
    : llmBaseUrl
      ? 'openai-compatible'
      : 'openai';

const defaultModel = llmProvider === 'gemini' ? 'gemini-3.6-flash' : 'gpt-4o-mini';

/**
 * Reasoning models (Gemini 3.x, o-series) spend part of the completion budget on
 * internal thinking tokens before emitting any visible text. A budget sized for a
 * non-reasoning model returns an empty `content` with finish_reason "stop", which
 * looks exactly like a broken integration. Default generously and allow an override.
 */
const defaultMaxTokens = llmProvider === 'gemini' ? 4000 : 1200;

/**
 * Comma-separated allowlist. Falls back to FRONTEND_URL so a single-origin
 * deployment needs no extra configuration.
 */
const corsOrigins = (process.env.CORS_ORIGINS || frontendUrl)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Accounts allowed to reach catalogue-mutating and automation endpoints.
 * Seeded/registered users are STUDENT by default, so this is the only way to
 * become ADMIN without direct database access.
 */
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Explicit external-search provider selection (empty = auto-detect the first configured). */
const searchProvider = (process.env.SCHOLARSHIP_SEARCH_PROVIDER || '').trim().toLowerCase();

/**
 * Gemini Google-Search grounding key + model, resolved INDEPENDENTLY of the chat LLM so
 * grounded live discovery keeps working when the chat model is a non-Gemini provider
 * (e.g. Groq or OpenAI). Resolution order:
 *   1. explicit GEMINI_SEARCH_API_KEY,
 *   2. SCHOLARSHIP_SEARCH_API_KEY when SCHOLARSHIP_SEARCH_PROVIDER=gemini,
 *   3. the chat key — but only when the chat model itself is Gemini (backwards compatible).
 */
const geminiSearchApiKey =
  (process.env.GEMINI_SEARCH_API_KEY || '').trim() ||
  (searchProvider === 'gemini' ? (process.env.SCHOLARSHIP_SEARCH_API_KEY || '').trim() : '') ||
  (llmProvider === 'gemini' ? llmApiKey : '');
const geminiSearchModel =
  (process.env.GEMINI_SEARCH_MODEL || process.env.SCHOLARSHIP_SEARCH_MODEL || '').trim() ||
  (llmProvider === 'gemini' ? process.env.LLM_MODEL || process.env.OPENAI_MODEL || defaultModel : 'gemini-2.5-flash');

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 5000,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  openaiApiKey: llmApiKey,
  openaiModel: process.env.LLM_MODEL || process.env.OPENAI_MODEL || defaultModel,
  /** Empty string means "use the SDK default" (OpenAI). */
  llmBaseUrl,
  llmProvider,
  llmMaxTokens: Number(process.env.LLM_MAX_TOKENS) || defaultMaxTokens,
  frontendUrl,
  corsOrigins,
  adminEmails,
  /** Set AUTOMATION_ENABLED=false to run the API without the background scheduler. */
  automationEnabled: process.env.AUTOMATION_ENABLED !== 'false',
  /** Trust X-Forwarded-For when the app sits behind a reverse proxy / load balancer. */
  trustProxy: process.env.TRUST_PROXY === 'true',
  /**
   * Re-read the account from the database on every authenticated request, so deleted
   * accounts, role changes and password resets take effect immediately instead of
   * persisting for the remainder of the token's lifetime. Costs one primary-key lookup
   * per request. Set to 'false' only if that lookup becomes a measured bottleneck.
   */
  strictSessionCheck: process.env.AUTH_STRICT_SESSION_CHECK !== 'false',
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  /**
   * External scholarship search.
   *
   * 'gemini' uses Google Search grounding via the existing Gemini key (no extra signup).
   * 'serper' | 'tavily' | 'brave' use a dedicated search API and require
   * SCHOLARSHIP_SEARCH_API_KEY. Empty means auto-detect the first configured provider.
   */
  searchProvider,
  searchApiKey: process.env.SCHOLARSHIP_SEARCH_API_KEY || '',
  searchApiUrl: (process.env.SCHOLARSHIP_SEARCH_API_URL || '').trim(),
  /** Model used for grounded search; defaults to the chat model. */
  searchModel: (process.env.SCHOLARSHIP_SEARCH_MODEL || '').trim(),
  /** Gemini grounding search key/model, decoupled from the chat LLM (see above). */
  geminiSearchApiKey,
  geminiSearchModel,
  /**
   * Groq compound web-search model, used when SCHOLARSHIP_SEARCH_PROVIDER=groq. Groq's
   * `compound`/`compound-mini` systems run server-side web search with the existing chat key,
   * so live discovery needs no separate search-vendor signup. Defaults to `compound-mini`:
   * the full `compound` model's larger internal expansion can trip Groq's per-request token
   * ceiling (HTTP 413).
   */
  groqSearchModel: (process.env.GROQ_SEARCH_MODEL || '').trim() || 'groq/compound-mini',
  /** External-first discovery. Set false to fall back to knowledge-base-only search. */
  externalDiscoveryEnabled: process.env.EXTERNAL_DISCOVERY_ENABLED !== 'false',
  /**
   * Keyless SERP fallback (DuckDuckGo HTML endpoint), tried last in the provider chain.
   * Keeps live discovery working when no search key is set or the keyed provider is out
   * of quota — without it those cases silently downgrade to a database-only answer.
   */
  searchAllowKeyless: process.env.SCHOLARSHIP_SEARCH_ALLOW_KEYLESS !== 'false',
  /**
   * Fetch the provider's own page (robots.txt-respecting) to extract from, instead of
   * relying on search snippets alone. Materially improves extraction quality.
   */
  fetchSourcePages: process.env.DISCOVERY_FETCH_PAGES !== 'false',
  /** Max provider pages retrieved per discovery request. */
  discoveryMaxPages: Number(process.env.DISCOVERY_MAX_PAGES) || 5,

  /**
   * Anti-hallucination gate. When true (default) an extracted scholarship is kept only if
   * its officialUrl was actually among the search results, and a record with an unreachable
   * official link is discarded. Set false to relax this: results that could not be fully
   * auto-verified are surfaced as UNVERIFIED rather than dropped, and when the LLM extracts
   * nothing structured, the real pages the live search returned are shown as unverified
   * candidates. Lower precision, higher recall — useful when strict mode shows nothing.
   */
  discoveryStrictVerification: process.env.DISCOVERY_STRICT_VERIFICATION !== 'false',

  /**
   * Live URL reachability checks during verification. Disable in offline/CI
   * environments so verification does not depend on outbound network access.
   */
  urlCheckEnabled: process.env.URL_CHECK_ENABLED !== 'false',

  /**
   * Days to retain raw CV text. Analysis results (scores, extracted skills) are kept
   * indefinitely; only the source document text is purged, since that is the sensitive
   * part. 0 disables purging.
   */
  cvRetentionDays: Number(process.env.CV_RETENTION_DAYS ?? 90),

  /** SMTP delivery. Without a host, notifications are logged rather than emailed. */
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'ScholarAI <no-reply@localhost>',
    secure: process.env.SMTP_SECURE === 'true',
  },

  /**
   * Resend transactional email.
   *
   * Preferred over raw SMTP when configured: deliverMessages() tries Resend first and
   * falls back to SMTP, then to logging. Without a key the app behaves exactly as before.
   */
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || '',
    fromName: process.env.RESEND_FROM_NAME || 'ScholarAI',
    /** Optional reply-to on outbound mail. */
    replyTo: process.env.RESEND_REPLY_TO || '',
  },

  /**
   * Sentry error reporting. No DSN means Sentry stays completely inert — no outbound
   * calls, every capture helper a no-op.
   */
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.SENTRY_ENVIRONMENT || nodeEnv,
    release: process.env.SENTRY_RELEASE || `scholarai@${process.env.APP_VERSION || '1.0.0'}`,
    /** 0 disables performance tracing; 0.1 = 10% of transactions. */
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? (isProduction ? 0.1 : 0)),
  },

  /** Serve Swagger UI at /api/docs. Disable to hide the docs in a locked-down deploy. */
  docsEnabled: process.env.API_DOCS_ENABLED !== 'false',
  appName: 'ScholarAI',
  appVersion: process.env.APP_VERSION || '1.0.0',
};

export const isUsingInsecureJwtSecret = jwtSecret === INSECURE_DEFAULT_JWT_SECRET;
