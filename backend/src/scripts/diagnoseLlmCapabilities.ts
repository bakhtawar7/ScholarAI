/**
 * Diagnoses which Gemini capabilities the configured key can actually reach.
 *
 * Distinguishes "the key is out of quota entirely" from "only grounded search is
 * blocked", because the two failure modes need different fixes.
 */
import { config } from '../config';
import { llm } from '../utils/llmClient';

async function tryPlainChat() {
  if (!llm) return 'no LLM client (no API key)';
  try {
    const r = await llm.chat.completions.create(
      { model: config.openaiModel, messages: [{ role: 'user', content: 'Reply with the single word: OK' }], max_tokens: 2000 },
      { timeout: 30_000 }
    );
    return `OK — content="${(r.choices?.[0]?.message?.content || '').trim().slice(0, 40)}"`;
  } catch (err: any) {
    return `FAILED — status=${err?.status} message=${String(err?.message).slice(0, 200)}`;
  }
}

async function tryGrounded() {
  const model = config.searchModel || config.openaiModel;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    config.openaiApiKey
  )}`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Search the web: DAAD scholarship deadline 2026. Cite sources.' }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
      }),
    });
    const text = await res.text();
    if (!res.ok) return `FAILED — HTTP ${res.status}: ${text.slice(0, 300)}`;
    const json = JSON.parse(text);
    const chunks = json?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return `OK — groundingChunks=${chunks.length}`;
  } catch (err: any) {
    return `FAILED — ${String(err?.message).slice(0, 200)}`;
  }
}

async function main() {
  console.log('model:', config.openaiModel, '| provider:', config.llmProvider);
  console.log('1. plain chat completion :', await tryPlainChat());
  console.log('2. grounded google_search:', await tryGrounded());
}

main().then(() => process.exit(0));
