/**
 * Standalone probe for the external search layer.
 *
 * Answers one question: does a real outbound search actually happen, and what comes
 * back? Run with `npm run probe:search -- "your query"`. Prints the resolved provider,
 * the queries issued, and the URLs returned — no database writes.
 */
import { config } from '../config';
import { externalSearch, describeSearchProvider, resolveProvider } from '../services/discovery/searchProvider';

async function main() {
  const query = process.argv.slice(2).join(' ') || "fully funded Computer Science master's scholarships in Europe";

  console.log('=== Search provider configuration ===');
  console.log('EXTERNAL_DISCOVERY_ENABLED :', config.externalDiscoveryEnabled);
  console.log('SCHOLARSHIP_SEARCH_PROVIDER:', config.searchProvider || '(auto-detect)');
  console.log(
    'SCHOLARSHIP_SEARCH_API_KEY :',
    config.searchApiKey ? `set (${config.searchApiKey.length} chars)` : 'NOT SET'
  );
  console.log('LLM provider / model       :', config.llmProvider, '/', config.openaiModel);
  console.log('Resolved provider          :', describeSearchProvider());
  console.log('Provider object            :', resolveProvider() ? 'resolved' : 'NULL — no live search possible');
  console.log();

  console.log('=== Issuing live external search ===');
  console.log('Query:', query);
  const started = Date.now();
  const res = await externalSearch([query], { limitPerQuery: 8 });
  console.log(`Elapsed: ${Date.now() - started}ms`);
  console.log();

  console.log('provider     :', res.provider);
  console.log(
    'external     :',
    res.external,
    res.external ? '(a real outbound search happened)' : '(NO outbound search)'
  );
  console.log('error        :', res.error || 'none');
  console.log('queriesIssued:', res.queriesIssued);
  console.log('hits         :', res.hits.length);
  console.log();

  res.hits.forEach((h, i) => {
    console.log(`[${i + 1}] ${h.url}`);
    console.log(`    title  : ${h.title || '(none)'}`);
    if (h.snippet) console.log(`    snippet: ${h.snippet.slice(0, 300).replace(/\s+/g, ' ')}...`);
  });

  if (res.hits.length === 0) {
    console.log('No hits returned. Live discovery will fall back to the knowledge base.');
  }
}

main()
  .catch((err) => {
    console.error('Probe failed:', err?.message || err);
    process.exit(1);
  })
  .then(() => process.exit(0));
