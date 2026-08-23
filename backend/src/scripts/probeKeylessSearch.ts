/**
 * Verifies a keyless search fallback and real page retrieval are viable here.
 *
 * The configured Gemini grounding provider is quota-blocked (429), so discovery
 * currently degrades to the database. This checks whether (a) a keyless SERP endpoint
 * returns parseable real result URLs, and (b) those pages can actually be fetched and
 * reduced to text for extraction.
 */

export {};

function decodeDdgUrl(href: string): string {
  // DDG wraps results as /l/?uddg=<encoded>
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return '';
    }
  }
  if (/^https?:\/\//i.test(href)) return href;
  return '';
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ddgSearch(query: string) {
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible; AI-Scholarship-Copilot/1.0)',
      Accept: 'text/html',
    },
    body: new URLSearchParams({ q: query }).toString(),
  });
  const html = await res.text();
  console.log(`  HTTP ${res.status}, ${html.length} bytes`);

  const hits: Array<{ title: string; url: string; snippet: string }> = [];
  const blockRe =
    /<div class="result[^"]*results_links[^"]*"[\s\S]*?(?=<div class="result[^"]*results_links|<\/body>)/g;
  const blocks = html.match(blockRe) || [];
  console.log(`  result blocks matched: ${blocks.length}`);

  for (const b of blocks) {
    const linkM = b.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const snipM = b.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkM) continue;
    const url = decodeDdgUrl(linkM[1]);
    if (!url) continue;
    hits.push({ title: stripTags(linkM[2]), url, snippet: snipM ? stripTags(snipM[1]) : '' });
  }
  return hits;
}

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'AI-Scholarship-Copilot/1.0 (+scholarship discovery)', Accept: 'text/html' },
    });
    const html = await res.text();
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const text = stripTags(body);
    return { status: res.status, bytes: html.length, textLen: text.length, sample: text.slice(0, 200) };
  } catch (err: any) {
    return { status: 0, error: String(err?.message).slice(0, 100) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const queries = [
    'fully funded computer science masters scholarship Europe 2026 2027 international students deadline',
    'DAAD scholarship 2027 official application',
  ];

  for (const q of queries) {
    console.log(`\n=== DDG: ${q}`);
    try {
      const hits = await ddgSearch(q);
      console.log(`  parsed hits: ${hits.length}`);
      hits.slice(0, 6).forEach((h, i) => {
        console.log(`  [${i + 1}] ${h.url}`);
        console.log(`      ${h.title.slice(0, 90)}`);
        console.log(`      snip: ${h.snippet.slice(0, 110)}`);
      });

      // Retrieval check on the first two hits.
      for (const h of hits.slice(0, 2)) {
        const r = await fetchPage(h.url);
        console.log(`  FETCH ${h.url} -> ${JSON.stringify(r).slice(0, 260)}`);
      }
    } catch (err: any) {
      console.log('  ERR', String(err?.message).slice(0, 150));
    }
  }
}

main().then(() => process.exit(0));
