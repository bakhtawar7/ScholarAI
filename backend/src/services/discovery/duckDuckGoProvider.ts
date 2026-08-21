import { logger } from '../../utils/logger';
import { SearchHit } from './searchProvider';

/**
 * Keyless SERP fallback via DuckDuckGo's HTML endpoint.
 *
 * Rationale: every keyed provider (Serper/Tavily/Brave) needs a paid signup, and the
 * Gemini grounding path is subject to a separate per-feature quota that returns 429 on
 * free keys. Without a keyless option the "external-first" pipeline degrades to a plain
 * database query on any stock install, which is exactly the behaviour this architecture
 * is meant to eliminate. This provider keeps live discovery working out of the box.
 *
 * Constraints honoured:
 *  - `html.duckduckgo.com/robots.txt` publishes `Allow: /` for `*`, so this path is
 *    permitted. (`duckduckgo.com/html` is disallowed and is NOT used.)
 *  - Results only; no login, no CAPTCHA solving, no rate-limit evasion. A 202/403/429
 *    is surfaced as an error and the caller falls back.
 *  - One request per query, sequential, with a delay between queries.
 */

const ENDPOINT = 'https://html.duckduckgo.com/html/';
const REQUEST_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS) || 20_000;
const INTER_QUERY_DELAY_MS = Number(process.env.SEARCH_QUERY_DELAY_MS) || 1_200;
/** Pause before the single retry when the endpoint throttles a burst. */
const THROTTLE_BACKOFF_MS = Number(process.env.SEARCH_THROTTLE_BACKOFF_MS) || 2_500;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, d) => {
      const code = Number(d);
      return code > 31 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** DDG wraps outbound links as `//duckduckgo.com/l/?uddg=<encoded>`. */
function unwrapUrl(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      const decoded = decodeURIComponent(m[1]);
      return /^https?:\/\//i.test(decoded) ? decoded : '';
    } catch {
      return '';
    }
  }
  if (href.startsWith('//')) return `https:${href}`;
  return /^https?:\/\//i.test(href) ? href : '';
}

function parseResults(html: string): SearchHit[] {
  const hits: SearchHit[] = [];

  // Each organic result sits in a `result results_links...` container.
  const blocks = html.match(/<div class="result[^"]*results_links[^"]*"[\s\S]*?(?=<div class="result[^"]*results_links|<\/body>)/g) || [];

  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;

    const url = unwrapUrl(linkMatch[1]);
    if (!url) continue;

    const snippetMatch = block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/);

    hits.push({
      title: stripTags(linkMatch[2]).slice(0, 300),
      url,
      snippet: snippetMatch ? stripTags(snippetMatch[1]).slice(0, 1200) : '',
    });
  }

  return hits;
}

/**
 * Runs one query. Throws on a hard failure so the caller can record it.
 */
async function searchOne(query: string, recencyDays?: number): Promise<SearchHit[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body = new URLSearchParams({ q: query, kl: 'wt-wt' });
    // DDG time filter: d/w/m/y. Map the requested window onto the closest bucket.
    if (recencyDays) {
      body.set('df', recencyDays <= 7 ? 'w' : recencyDays <= 31 ? 'm' : 'y');
    }

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // A generic desktop UA; the endpoint serves a bot-challenge page to unknown
        // clients. This identifies as a normal browser rather than defeating any
        // protection — if a challenge is returned we give up rather than solve it.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: body.toString(),
    });

    if (res.status === 202 || res.status === 403 || res.status === 429) {
      throw Object.assign(new Error(`Search endpoint returned HTTP ${res.status} (throttled or challenged).`), {
        status: res.status,
      });
    }
    if (!res.ok) {
      throw Object.assign(new Error(`Search endpoint HTTP ${res.status}.`), { status: res.status });
    }

    const html = await res.text();

    // An anomaly/challenge interstitial rather than a SERP.
    if (/anomaly-modal|challenge-form|Unfortunately, bots/i.test(html)) {
      throw Object.assign(new Error('Search endpoint served a bot challenge; skipped.'), { status: 429 });
    }

    return parseResults(html);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Searches all queries sequentially, tolerating per-query failures.
 *
 * The endpoint throttles bursts with HTTP 202, so queries are spaced out, retried once
 * after a backoff, and abandoned as a group once it is clearly throttling — continuing to
 * hammer it would neither succeed nor be polite.
 */
export async function duckDuckGoSearch(
  queries: string[],
  options: { limitPerQuery?: number; recencyDays?: number } = {}
): Promise<{ hits: SearchHit[]; error?: string }> {
  const limit = options.limitPerQuery || 8;
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  let firstError: string | undefined;
  let succeeded = 0;
  let consecutiveThrottles = 0;

  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, INTER_QUERY_DELAY_MS));

    // Back off entirely once the host has throttled us twice in a row.
    if (consecutiveThrottles >= 2) {
      logger.warn('Keyless search abandoned after repeated throttling', { remaining: queries.length - i });
      break;
    }

    let attempt = 0;
    while (attempt < 2) {
      try {
        const found = await searchOne(queries[i], options.recencyDays);
        succeeded++;
        consecutiveThrottles = 0;
        for (const hit of found.slice(0, limit)) {
          const key = hit.url.replace(/[#?].*$/, '');
          if (seen.has(key)) continue;
          seen.add(key);
          hits.push(hit);
        }
        break;
      } catch (err: any) {
        const throttled = err?.status === 202 || err?.status === 429 || err?.status === 403;
        attempt++;

        if (throttled && attempt < 2) {
          // One retry after a longer pause; bursts are the usual trigger.
          await new Promise((r) => setTimeout(r, THROTTLE_BACKOFF_MS));
          continue;
        }

        if (throttled) consecutiveThrottles++;
        if (!firstError) firstError = err?.message || 'Search failed.';
        logger.warn('Keyless search query failed', {
          query: queries[i].slice(0, 80),
          message: err?.message,
          attempts: attempt,
        });
        break;
      }
    }

    // Stop early once we already have plenty to extract from.
    if (hits.length >= limit * 2) break;
  }

  return { hits, ...(succeeded === 0 ? { error: firstError || 'All search queries failed.' } : {}) };
}
