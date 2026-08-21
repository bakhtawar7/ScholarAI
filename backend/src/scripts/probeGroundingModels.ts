/**
 * Probes which Gemini models can actually run google_search grounding on this key.
 *
 * The 429 on grounding while plain chat succeeds points at a per-feature quota rather
 * than an exhausted key, so this walks the available models and reports, per model,
 * whether grounded search returns real groundingChunks.
 */
import { config } from '../config';

const CANDIDATES = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-flash-latest',
];

async function listModels() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(config.openaiApiKey)}&pageSize=200`
  );
  if (!res.ok) return null;
  const json: any = await res.json();
  return (json?.models || []).map((m: any) => String(m.name).replace('models/', ''));
}

async function tryGrounded(model: string) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    config.openaiApiKey
  )}`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Search the web for the DAAD Helmut-Schmidt scholarship official page.' }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.1 },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = '';
      try {
        const j = JSON.parse(text);
        const violations = j?.error?.details?.flatMap((d: any) => d.violations || []) || [];
        detail = violations.length
          ? violations.map((v: any) => `${v.quotaMetric || ''}|${v.quotaId || ''}`).join(', ')
          : String(j?.error?.status || '');
      } catch {
        detail = text.slice(0, 120);
      }
      return `HTTP ${res.status} ${detail}`;
    }
    const json = JSON.parse(text);
    const chunks = json?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return `OK groundingChunks=${chunks.length}`;
  } catch (err: any) {
    return `ERR ${String(err?.message).slice(0, 100)}`;
  }
}

async function main() {
  const available = await listModels();
  console.log('Models visible to this key:', available ? available.length : 'list call failed');
  if (available) {
    const interesting = available.filter((m: string) => /gemini/.test(m) && !/embedding|imagen|veo|tts|image|native-audio|live/.test(m));
    console.log(interesting.join('\n'));
  }
  console.log('\n=== grounded search per model ===');
  for (const m of CANDIDATES) {
    if (available && !available.includes(m)) {
      console.log(`${m.padEnd(26)} : not available on this key`);
      continue;
    }
    console.log(`${m.padEnd(26)} : ${await tryGrounded(m)}`);
  }
}

main().then(() => process.exit(0));
