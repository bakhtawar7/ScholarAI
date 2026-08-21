import { config } from '../config';
import { logger } from './logger';

export interface UrlCheckResult {
  reachable: boolean;
  statusCode: number | null;
  /** Final URL after redirects, when it differs from the input. */
  finalUrl?: string;
  /** Milliseconds spent on the request. */
  elapsedMs: number;
  notes: string;
  /** True when the check itself could not run (offline, DNS failure, disabled). */
  inconclusive: boolean;
}

const TIMEOUT_MS = Number(process.env.URL_CHECK_TIMEOUT_MS) || 8000;
const MAX_REDIRECTS = 4;

/**
 * Blocks SSRF against internal infrastructure.
 *
 * Scholarship URLs are ingested from external feeds and can be attacker-influenced, so
 * a naive fetch would let a crafted record probe localhost, cloud metadata endpoints or
 * RFC1918 space from inside the network.
 */
function isDisallowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  // Cloud instance metadata.
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;

  // IPv4 literals in private / loopback / link-local ranges.
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true; // multicast / reserved
  }

  // IPv6 loopback and unique-local.
  if (h === '::1' || h.startsWith('[::1]') || h.startsWith('fc') || h.startsWith('fd')) return true;

  return false;
}

/**
 * Checks whether a scholarship's official URL actually resolves.
 *
 * Verification previously only validated URL *syntax*, so a dead link scored
 * `urlReachable: true` and the record stayed VERIFIED. This performs a real request.
 *
 * Uses HEAD first (cheap), falling back to a ranged GET because many university portals
 * reject or mishandle HEAD. Never throws — a failed check returns `inconclusive` so a
 * transient network problem cannot mass-reject the catalogue.
 */
export async function checkUrlReachable(rawUrl: string): Promise<UrlCheckResult> {
  const started = Date.now();
  const base = { statusCode: null, elapsedMs: 0, inconclusive: false };

  if (!config.urlCheckEnabled) {
    return { ...base, reachable: true, inconclusive: true, notes: 'Live URL checking is disabled (URL_CHECK_ENABLED=false).' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ...base, reachable: false, elapsedMs: Date.now() - started, notes: 'Malformed URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ...base, reachable: false, elapsedMs: Date.now() - started, notes: `Unsupported scheme "${parsed.protocol}".` };
  }

  if (isDisallowedHost(parsed.hostname)) {
    logger.warn('Blocked URL check against a private/internal host', { hostname: parsed.hostname });
    return {
      ...base,
      reachable: false,
      elapsedMs: Date.now() - started,
      notes: 'URL points at a private or internal host and was not fetched.',
    };
  }

  const attempt = async (method: 'HEAD' | 'GET') => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(parsed.toString(), {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          // Some portals serve 403 to unknown agents.
          'User-Agent': 'AI-Scholarship-Copilot/1.0 (link verification)',
          Accept: '*/*',
          ...(method === 'GET' ? { Range: 'bytes=0-2047' } : {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let response = await attempt('HEAD');

    // Retry with GET when HEAD is unsupported or blocked.
    if (response.status === 405 || response.status === 403 || response.status === 501) {
      response = await attempt('GET');
    }

    const elapsedMs = Date.now() - started;
    const finalUrl = response.url && response.url !== rawUrl ? response.url : undefined;

    if (response.status >= 200 && response.status < 400) {
      return {
        reachable: true,
        statusCode: response.status,
        finalUrl,
        elapsedMs,
        inconclusive: false,
        notes: `Reachable (HTTP ${response.status}${finalUrl ? `, redirected to ${finalUrl}` : ''}).`,
      };
    }

    // 401/403 means the host answered — the page exists but is gated.
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return {
        reachable: true,
        statusCode: response.status,
        finalUrl,
        elapsedMs,
        inconclusive: true,
        notes: `Host responded with HTTP ${response.status} (access-gated or rate limited); treated as present but unverified.`,
      };
    }

    return {
      reachable: false,
      statusCode: response.status,
      finalUrl,
      elapsedMs,
      inconclusive: false,
      notes: `Unreachable (HTTP ${response.status}).`,
    };
  } catch (err: any) {
    const elapsedMs = Date.now() - started;
    const aborted = err?.name === 'AbortError';
    // A network failure on our side must not be reported as a dead scholarship link.
    return {
      reachable: false,
      statusCode: null,
      elapsedMs,
      inconclusive: true,
      notes: aborted
        ? `No response within ${TIMEOUT_MS}ms — inconclusive.`
        : `Network error during check (${err?.code || err?.message || 'unknown'}) — inconclusive.`,
    };
  }
}
