import { config } from '../../config';
import { logger } from '../../utils/logger';
import { captureException, captureMessage } from '../../utils/sentry';

/**
 * Provider-agnostic external web search.
 *
 * Kept behind this interface so the discovery pipeline never depends on a specific
 * vendor. Four providers are supported out of the box; add another by implementing
 * `WebSearchProvider` and registering it in `resolveProvider()`.
 */
export interface SearchHit {
  title: string;
  url: string;
  /** Snippet or extracted page text, when the provider supplies it. */
  snippet: string;
  /** Provider-reported publication/update date, when available. */
  publishedAt?: string;
}

export interface SearchResponse {
  hits: SearchHit[];
  /** Queries actually issued externally — surfaced to the user for transparency. */
  queriesIssued: string[];
  provider: string;
  /** True when the call genuinely reached an external service. */
  external: boolean;
  /** Populated when every provider failed; hits will be empty. */
  error?: string;
  /** Set when an earlier provider in the chain was skipped or failed. */
  fallbackNote?: string;
}

export interface WebSearchProvider {
  readonly name: string;
  readonly configured: boolean;
  /** True for providers that need no API key. */
  readonly keyless?: boolean;
  search(queries: string[], options?: { limitPerQuery?: number; recencyDays?: number }): Promise<SearchResponse>;
}

const REQUEST_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS) || 20_000;

async function postJson(url: string, body: any, headers: Record<string, string>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      const detail = json?.error?.message || json?.message || `HTTP ${res.status}`;
      throw Object.assign(new Error(detail), { status: res.status });
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Google Search grounding via the Gemini API.
 *
 * Uses the same key as the chat model, so no extra provider signup is needed. The model
 * issues its own web queries and returns `groundingMetadata.groundingChunks` containing
 * the real URLs it consulted — those URLs are the external discovery signal.
 */
class GeminiGroundingProvider implements WebSearchProvider {
  readonly name = 'gemini-google-search';

  get configured() {
    return Boolean(config.openaiApiKey) && config.llmProvider === 'gemini';
  }

  async search(queries: string[], options: { limitPerQuery?: number; recencyDays?: number } = {}): Promise<SearchResponse> {
    const model = config.searchModel || config.openaiModel;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      config.openaiApiKey
    )}`;

    const recencyClause = options.recencyDays
      ? ` Prioritise pages published or updated in the last ${options.recencyDays} days.`
      : '';

    // One grounded call covering all queries — the model fans out internally, which is
    // cheaper than one request per query.
    const prompt = [
      'Search the web for currently open scholarship opportunities matching ALL of these searches:',
      ...queries.map((q, i) => `${i + 1}. ${q}`),
      '',
      'Prefer official sources: university admissions pages, government scholarship portals,',
      'and official programme websites. Avoid aggregator blogs and listicles where an official',
      'page exists.' + recencyClause,
      '',
      'For each scholarship you find, state its name, the awarding provider, the host country,',
      'degree level, funding coverage, application deadline, and the official application URL.',
      'Only report scholarships you actually found on a real page. Do not invent any.',
    ].join('\n');

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: Math.max(2000, config.llmMaxTokens), temperature: 0.1 },
    };

    const json = await postJson(endpoint, body, {});
    const candidate = json?.candidates?.[0];
    const grounding = candidate?.groundingMetadata || {};

    const chunks: any[] = Array.isArray(grounding.groundingChunks) ? grounding.groundingChunks : [];
    const narrative: string = (candidate?.content?.parts || [])
      .map((p: any) => p?.text || '')
      .join('\n')
      .trim();

    const hits: SearchHit[] = chunks
      .map((chunk) => {
        const web = chunk?.web || {};
        return {
          title: String(web.title || '').trim(),
          url: String(web.uri || '').trim(),
          snippet: '',
        };
      })
      .filter((h) => h.url);

    // The model's grounded prose carries the structured detail; attach it to the first
    // hit so the extraction stage has the full context to work from.
    if (narrative && hits.length > 0) {
      hits[0] = { ...hits[0], snippet: narrative };
    } else if (narrative && hits.length === 0) {
      hits.push({ title: 'Grounded search summary', url: '', snippet: narrative });
    }

    return {
      hits,
      queriesIssued: Array.isArray(grounding.webSearchQueries) ? grounding.webSearchQueries : queries,
      provider: this.name,
      // Grounding chunks only exist when a real search was performed.
      external: chunks.length > 0,
    };
  }
}

/** Serper.dev — Google SERP API. */
class SerperProvider implements WebSearchProvider {
  readonly name = 'serper';
  get configured() {
    return config.searchProvider === 'serper' && Boolean(config.searchApiKey);
  }

  async search(queries: string[], options: { limitPerQuery?: number; recencyDays?: number } = {}): Promise<SearchResponse> {
    const limit = options.limitPerQuery || 8;
    const url = config.searchApiUrl || 'https://google.serper.dev/search';

    const payload = queries.map((q) => ({
      q,
      num: limit,
      ...(options.recencyDays && options.recencyDays <= 30 ? { tbs: 'qdr:m' } : {}),
    }));

    const json = await postJson(url, payload.length === 1 ? payload[0] : payload, {
      'X-API-KEY': config.searchApiKey,
    });

    const blocks = Array.isArray(json) ? json : [json];
    const hits: SearchHit[] = [];
    for (const block of blocks) {
      for (const r of block?.organic || []) {
        if (r?.link) {
          hits.push({
            title: String(r.title || '').trim(),
            url: String(r.link).trim(),
            snippet: String(r.snippet || '').trim(),
            publishedAt: r.date,
          });
        }
      }
    }

    return { hits, queriesIssued: queries, provider: this.name, external: true };
  }
}

/** Tavily — search API purpose-built for LLM pipelines; returns extracted page content. */
class TavilyProvider implements WebSearchProvider {
  readonly name = 'tavily';
  get configured() {
    return config.searchProvider === 'tavily' && Boolean(config.searchApiKey);
  }

  async search(queries: string[], options: { limitPerQuery?: number; recencyDays?: number } = {}): Promise<SearchResponse> {
    const url = config.searchApiUrl || 'https://api.tavily.com/search';
    const hits: SearchHit[] = [];

    for (const q of queries) {
      const json = await postJson(
        url,
        {
          query: q,
          max_results: options.limitPerQuery || 8,
          search_depth: 'advanced',
          include_answer: false,
          ...(options.recencyDays ? { days: options.recencyDays, topic: 'news' } : {}),
        },
        { Authorization: `Bearer ${config.searchApiKey}` }
      );

      for (const r of json?.results || []) {
        if (r?.url) {
          hits.push({
            title: String(r.title || '').trim(),
            url: String(r.url).trim(),
            // Tavily returns real page text, which materially improves extraction quality.
            snippet: String(r.content || r.raw_content || '').trim().slice(0, 4000),
            publishedAt: r.published_date,
          });
        }
      }
    }

    return { hits, queriesIssued: queries, provider: this.name, external: true };
  }
}

/** Brave Search API. */
class BraveProvider implements WebSearchProvider {
  readonly name = 'brave';
  get configured() {
    return config.searchProvider === 'brave' && Boolean(config.searchApiKey);
  }

  async search(queries: string[], options: { limitPerQuery?: number } = {}): Promise<SearchResponse> {
    const base = config.searchApiUrl || 'https://api.search.brave.com/res/v1/web/search';
    const hits: SearchHit[] = [];

    for (const q of queries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(`${base}?q=${encodeURIComponent(q)}&count=${options.limitPerQuery || 8}`, {
          headers: { Accept: 'application/json', 'X-Subscription-Token': config.searchApiKey },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Brave HTTP ${res.status}`);
        const json: any = await res.json();
        for (const r of json?.web?.results || []) {
          if (r?.url) {
            hits.push({
              title: String(r.title || '').trim(),
              url: String(r.url).trim(),
              snippet: String(r.description || '').trim(),
              publishedAt: r.age,
            });
          }
        }
      } finally {
        clearTimeout(timer);
      }
    }

    return { hits, queriesIssued: queries, provider: this.name, external: true };
  }
}

/**
 * Keyless SERP fallback.
 *
 * Always "configured", because it needs no credentials. It sits last in the chain so a
 * dedicated provider is always preferred, but it guarantees that live discovery still
 * happens on a stock install — without it, a missing or quota-limited key silently turns
 * the external-first pipeline back into a plain database query.
 */
class DuckDuckGoFallbackProvider implements WebSearchProvider {
  readonly name = 'duckduckgo-html';
  readonly keyless = true;

  get configured() {
    // Opt-out only, via SCHOLARSHIP_SEARCH_ALLOW_KEYLESS=false.
    return config.searchAllowKeyless;
  }

  async search(queries: string[], options: { limitPerQuery?: number; recencyDays?: number } = {}): Promise<SearchResponse> {
    const { duckDuckGoSearch } = await import('./duckDuckGoProvider');
    const { hits, error } = await duckDuckGoSearch(queries, options);

    if (error && hits.length === 0) {
      throw Object.assign(new Error(error), { status: 429 });
    }

    return { hits, queriesIssued: queries, provider: this.name, external: hits.length > 0 };
  }
}

const PROVIDERS: WebSearchProvider[] = [
  new SerperProvider(),
  new TavilyProvider(),
  new BraveProvider(),
  new GeminiGroundingProvider(),
  new DuckDuckGoFallbackProvider(),
];

/**
 * Builds the ordered provider chain to attempt.
 *
 * An explicit SCHOLARSHIP_SEARCH_PROVIDER goes first; every other configured provider
 * follows as a fallback. Returning a chain rather than a single provider is deliberate:
 * a quota-exhausted primary (a 429 from Gemini grounding on free-tier keys is routine)
 * previously meant zero live results and a silent downgrade to database-only answers.
 */
export function resolveProviderChain(): WebSearchProvider[] {
  const usable = PROVIDERS.filter((p) => p.configured);

  if (config.searchProvider) {
    const named = usable.find((p) => p.name.startsWith(config.searchProvider));
    if (named) {
      return [named, ...usable.filter((p) => p !== named)];
    }
    logger.warn('Configured search provider is not usable; falling back', {
      requested: config.searchProvider,
      reason: 'missing SCHOLARSHIP_SEARCH_API_KEY or incompatible LLM provider',
      fallbacks: usable.map((p) => p.name),
    });
  }

  return usable;
}

/** First provider in the chain, or null when nothing is usable. */
export function resolveProvider(): WebSearchProvider | null {
  return resolveProviderChain()[0] || null;
}

export function describeSearchProvider(): string {
  const chain = resolveProviderChain();
  if (chain.length === 0) return 'none (external discovery unavailable — set SCHOLARSHIP_SEARCH_API_KEY)';
  return chain.map((p) => p.name).join(' → ');
}

/**
 * Runs an external search across the provider chain, never throwing.
 *
 * Each provider is tried in order until one returns hits. Discovery must degrade to the
 * cached knowledge base rather than failing the user's request, so all provider errors
 * are captured in the response instead of propagating.
 */
export async function externalSearch(
  queries: string[],
  options: { limitPerQuery?: number; recencyDays?: number } = {}
): Promise<SearchResponse> {
  const chain = resolveProviderChain();

  if (chain.length === 0) {
    return {
      hits: [],
      queriesIssued: [],
      provider: 'none',
      external: false,
      error: 'No external search provider is configured.',
    };
  }

  const failures: string[] = [];

  for (const provider of chain) {
    try {
      const started = Date.now();
      const result = await provider.search(queries, options);

      if (result.hits.length === 0) {
        // Not an error, but nothing to extract from — try the next provider.
        failures.push(`${provider.name}: no results`);
        logger.warn('External search returned no hits; trying next provider', { provider: provider.name });
        continue;
      }

      logger.info('External scholarship search completed', {
        provider: result.provider,
        queries: result.queriesIssued.length,
        hits: result.hits.length,
        elapsedMs: Date.now() - started,
        attemptsBefore: failures.length,
      });

      return {
        ...result,
        ...(failures.length > 0
          ? { error: undefined, fallbackNote: `Primary provider unavailable (${failures.join('; ')}).` }
          : {}),
      };
    } catch (err: any) {
      const detail = err?.status === 429 ? 'quota exceeded or throttled' : err?.message || 'provider error';
      failures.push(`${provider.name}: ${detail}`);
      logger.error('External scholarship search failed; trying next provider', {
        provider: provider.name,
        status: err?.status,
        message: err?.message,
      });
      // Reported per provider: a chain that silently falls through to the keyless
      // fallback still looks "successful" from the outside, so the failure of a keyed
      // provider (expired key, exhausted quota) is only visible here.
      captureException(err, {
        area: 'external-search',
        level: 'warning',
        extra: { provider: provider.name, status: err?.status, detail },
      });
    }
  }

  const allFailed = `Every search provider failed — ${failures.join('; ')}.`;
  captureMessage('All external scholarship search providers failed', {
    area: 'external-search',
    level: 'error',
    extra: { providers: chain.map((p) => p.name), failures: failures.slice(0, 10) },
  });

  return {
    hits: [],
    queriesIssued: queries,
    provider: chain.map((p) => p.name).join(' → '),
    external: false,
    error: allFailed,
  };
}
