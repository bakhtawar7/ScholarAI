/**
 * Reachability probe for keyless external sources.
 *
 * The configured Gemini grounding provider is quota-blocked, so this checks whether
 * official portals, their robots.txt, and public RSS feeds are reachable — those are
 * the legitimate keyless sources the discovery layer can fall back to.
 */
export {};

const TARGETS = [
  ['robots', 'https://www.daad.de/robots.txt'],
  ['robots', 'https://www.chevening.org/robots.txt'],
  ['robots', 'https://erasmus-plus.ec.europa.eu/robots.txt'],
  ['robots', 'https://www.scholarshipportal.com/robots.txt'],
  ['page', 'https://www.daad.de/en/study-and-research-in-germany/scholarships/'],
  ['page', 'https://www.chevening.org/scholarships/'],
  ['rss', 'https://www.daad.de/en/rss/'],
  ['api', 'https://api.duckduckgo.com/?q=daad+scholarship&format=json&no_html=1'],
  ['api', 'https://html.duckduckgo.com/html/?q=daad+scholarship'],
  ['api', 'https://search.marcia.cc/search?q=test&format=json'],
  ['api', 'https://en.wikipedia.org/api/rest_v1/page/summary/Chevening_Scholarship'],
];

async function probe(kind: string, url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'AI-Scholarship-Copilot/1.0 (+discovery)', Accept: '*/*' },
    });
    const body = await res.text();
    const line = `${kind.padEnd(7)} ${String(res.status).padEnd(4)} ${url}`;
    console.log(line);
    console.log(`        bytes=${body.length} type=${res.headers.get('content-type') || '?'}`);
    if (kind === 'robots') {
      const disallowAll = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*$/im.test(body);
      console.log(`        disallow-all-for-*: ${disallowAll}`);
      console.log(`        first lines: ${body.split('\n').slice(0, 6).join(' | ').slice(0, 200)}`);
    } else {
      console.log(`        head: ${body.slice(0, 180).replace(/\s+/g, ' ')}`);
    }
  } catch (err: any) {
    console.log(`${kind.padEnd(7)} ERR  ${url}`);
    console.log(`        ${String(err?.message).slice(0, 140)}`);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  for (const [kind, url] of TARGETS) {
    await probe(kind, url);
  }
}

main().then(() => process.exit(0));
