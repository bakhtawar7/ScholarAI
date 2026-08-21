import { logger } from '../../utils/logger';

/**
 * Robots-aware page retrieval for the discovery pipeline.
 *
 * Search snippets alone are thin and often stale, so the extraction stage does better
 * when it can read the provider's own page. That means fetching third-party pages, which
 * this module does under explicit constraints:
 *
 *  - robots.txt is fetched and honoured per origin (cached), including Crawl-delay.
 *  - Only http/https, and never a private/internal host (SSRF).
 *  - One in-flight request per origin with a polite delay between them.
 *  - HTML only, size-capped, and reduced to text — no JS execution, no asset fetching.
 *  - Never throws: a page that cannot be read simply contributes no extra context.
 *
 * Nothing here attempts to defeat authentication, paywalls, CAPTCHAs or bot protection.
 * A 401/403/429 is recorded as "not readable" and the page is skipped.
 */

const USER_AGENT = 'AI-Scholarship-Copilot/1.0 (+scholarship discovery; respects robots.txt)';
const FETCH_TIMEOUT_MS = Number(process.env.PAGE_FETCH_TIMEOUT_MS) || 12_000;
const MAX_HTML_BYTES = Number(process.env.PAGE_FETCH_MAX_BYTES) || 900_000;
const DEFAULT_CRAWL_DELAY_MS = Number(process.env.PAGE_FETCH_DELAY_MS) || 1_000;
const ROBOTS_CACHE_TTL_MS = 30 * 60 * 1000;

export interface RetrievedPage {
  url: string;
  /** Final URL after redirects. */
  finalUrl: string;
  status: number;
  /** Visible text, collapsed and capped. Empty when the page could not be read. */
  text: string;
  /** True when robots.txt disallowed the path — we did not fetch it. */
  robotsBlocked: boolean;
  note: string;
}

interface RobotsRules {
  /** Disallowed path prefixes for `*`. */
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
  expiresAt: number;
}

const robotsCache = new Map<string, RobotsRules>();
/** Serialises requests per origin and enforces the crawl delay. */
const originQueue = new Map<string, Promise<unknown>>();

function isDisallowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true;
  }
  if (h === '::1' || h.startsWith('[::1]') || h.startsWith('fc') || h.startsWith('fd')) return true;
  return false;
}

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parses the `User-agent: *` group of a robots.txt body.
 *
 * Only the wildcard group is consulted, which is the correct group for this crawler
 * since it does not claim any other product token.
 */
function parseRobots(body: string): Omit<RobotsRules, 'expiresAt'> {
  const disallow: string[] = [];
  const allow: string[] = [];
  let crawlDelayMs = DEFAULT_CRAWL_DELAY_MS;

  let inStar = false;
  let sawAnyGroup = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;

    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === 'user-agent') {
      // A new group starts; only track the wildcard one.
      if (!sawAnyGroup || !inStar) inStar = value === '*';
      else if (value !== '*') inStar = false;
      sawAnyGroup = true;
      continue;
    }
    if (!inStar) continue;

    if (field === 'disallow') {
      // "Disallow:" with an empty value means allow everything.
      if (value) disallow.push(value);
    } else if (field === 'allow') {
      if (value) allow.push(value);
    } else if (field === 'crawl-delay') {
      const secs = Number(value);
      if (Number.isFinite(secs) && secs > 0) crawlDelayMs = Math.min(10_000, secs * 1000);
    }
  }

  return { disallow, allow, crawlDelayMs };
}

async function getRobots(origin: string): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() < cached.expiresAt) return cached;

  let rules: Omit<RobotsRules, 'expiresAt'> = { disallow: [], allow: [], crawlDelayMs: DEFAULT_CRAWL_DELAY_MS };

  try {
    const res = await timedFetch(`${origin}/robots.txt`, { headers: { Accept: 'text/plain' } });
    if (res.status >= 200 && res.status < 300) {
      const body = (await res.text()).slice(0, 200_000);
      rules = parseRobots(body);
    }
    // 404 / 5xx / unreachable → no restrictions published; default rules apply.
  } catch {
    // Network failure fetching robots.txt. Stay conservative but usable: default rules.
  }

  const entry: RobotsRules = { ...rules, expiresAt: Date.now() + ROBOTS_CACHE_TTL_MS };
  robotsCache.set(origin, entry);
  return entry;
}

/** Longest-match wins, Allow beating Disallow on equal length — the common convention. */
function isPathAllowed(pathWithQuery: string, rules: RobotsRules): boolean {
  const matchLen = (patterns: string[]) => {
    let best = -1;
    for (const p of patterns) {
      // Support the `*` wildcard and `$` end-anchor.
      if (p.includes('*') || p.endsWith('$')) {
        const re = new RegExp(
          '^' +
            p
              .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*')
              .replace(/\\\$$/, '$')
        );
        if (re.test(pathWithQuery)) best = Math.max(best, p.length);
      } else if (pathWithQuery.startsWith(p)) {
        best = Math.max(best, p.length);
      }
    }
    return best;
  };

  const dis = matchLen(rules.disallow);
  if (dis === -1) return true;
  return matchLen(rules.allow) >= dis;
}

/** Queues work per origin so we never hammer one host in parallel. */
function withOriginLock<T>(origin: string, delayMs: number, fn: () => Promise<T>): Promise<T> {
  const prior = originQueue.get(origin) || Promise.resolve();
  const next = prior
    .catch(() => undefined)
    .then(async () => {
      const result = await fn();
      await new Promise((r) => setTimeout(r, delayMs));
      return result;
    });
  originQueue.set(
    origin,
    next.catch(() => undefined)
  );
  return next;
}

/** Strips markup and collapses whitespace. Keeps the main content, drops chrome. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|nav|footer|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&euro;/gi, '€')
    .replace(/&#(\d+);/g, (_, d) => {
      const code = Number(d);
      return code > 31 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Fetches one page's visible text, honouring robots.txt.
 *
 * Never throws. Returns an empty `text` with an explanatory `note` when the page is
 * blocked, gated, non-HTML or unreachable.
 */
export async function retrievePage(rawUrl: string, maxChars = 12_000): Promise<RetrievedPage> {
  const fail = (note: string, extra: Partial<RetrievedPage> = {}): RetrievedPage => ({
    url: rawUrl,
    finalUrl: rawUrl,
    status: 0,
    text: '',
    robotsBlocked: false,
    note,
    ...extra,
  });

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return fail('Malformed URL.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return fail(`Unsupported scheme "${parsed.protocol}".`);
  }
  if (isDisallowedHost(parsed.hostname)) {
    logger.warn('Blocked page retrieval against a private/internal host', { hostname: parsed.hostname });
    return fail('URL points at a private or internal host.');
  }

  const origin = parsed.origin;

  try {
    const rules = await getRobots(origin);
    const pathWithQuery = parsed.pathname + (parsed.search || '');

    if (!isPathAllowed(pathWithQuery, rules)) {
      logger.info('robots.txt disallows retrieval', { url: rawUrl });
      return fail('robots.txt disallows crawling this path; the page was not fetched.', { robotsBlocked: true });
    }

    return await withOriginLock(origin, rules.crawlDelayMs, async () => {
      const res = await timedFetch(parsed.toString(), { headers: { Accept: 'text/html,application/xhtml+xml' } });

      // Access-gated or rate limited: respect it, do not retry or work around it.
      if (res.status === 401 || res.status === 403 || res.status === 407 || res.status === 429) {
        return fail(`Host responded HTTP ${res.status} (access-gated or rate limited); not read.`, { status: res.status });
      }
      if (res.status < 200 || res.status >= 400) {
        return fail(`Unreachable (HTTP ${res.status}).`, { status: res.status });
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType && !/text\/html|application\/xhtml|text\/plain|application\/xml|text\/xml/.test(contentType)) {
        return fail(`Skipped non-HTML content (${contentType.split(';')[0]}).`, { status: res.status });
      }

      const raw = await res.text();
      const html = raw.length > MAX_HTML_BYTES ? raw.slice(0, MAX_HTML_BYTES) : raw;
      const text = htmlToText(html).slice(0, maxChars);

      return {
        url: rawUrl,
        finalUrl: res.url || rawUrl,
        status: res.status,
        text,
        robotsBlocked: false,
        note: text ? `Read ${text.length} chars of page text.` : 'Page contained no extractable text.',
      };
    });
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return fail(aborted ? `No response within ${FETCH_TIMEOUT_MS}ms.` : `Network error (${err?.code || err?.message || 'unknown'}).`);
  }
}

/** Retrieves several pages with bounded concurrency. */
export async function retrievePages(urls: string[], options: { maxPages?: number; maxCharsPerPage?: number; concurrency?: number } = {}) {
  const maxPages = options.maxPages ?? 6;
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const targets = Array.from(new Set(urls.filter(Boolean))).slice(0, maxPages);

  const results: RetrievedPage[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const index = cursor++;
      results[index] = await retrievePage(targets[index], options.maxCharsPerPage);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return results.filter(Boolean);
}
