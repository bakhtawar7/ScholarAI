import OpenAI from 'openai';
import { config } from '../config';
import { logger } from './logger';

/**
 * Single place that constructs the LLM client.
 *
 * Three services previously each did `new OpenAI({ apiKey })` with no baseURL, which
 * hard-wired the app to api.openai.com. Any OpenAI-compatible provider now works via
 * LLM_BASE_URL — notably Google Gemini, whose compatibility layer supports the
 * chat/completions shape, function calling and response_format that this app relies on.
 *
 * Returns null when no key is configured; every caller already falls back to a
 * deterministic engine in that case.
 */
export function createLlmClient(): OpenAI | null {
  if (!config.openaiApiKey) return null;

  return new OpenAI({
    apiKey: config.openaiApiKey,
    ...(config.llmBaseUrl ? { baseURL: config.llmBaseUrl } : {}),
  });
}

/** Shared singleton — avoids one HTTP agent per service module. */
export const llm = createLlmClient();

export function describeLlm(): string {
  if (!llm) return 'disabled (no API key — deterministic engines only)';
  return `${config.llmProvider} · model=${config.openaiModel} · maxTokens=${config.llmMaxTokens}${
    config.llmBaseUrl ? ` · baseURL=${config.llmBaseUrl}` : ''
  }`;
}

/**
 * Normalises an LLM failure into a log-safe object.
 * Provider SDKs bury the useful part at different depths.
 */
export function llmErrorMeta(err: any) {
  return {
    message: err?.message,
    status: err?.status ?? err?.response?.status,
    type: err?.type ?? err?.error?.type,
    code: err?.code ?? err?.error?.code,
    provider: config.llmProvider,
    model: config.openaiModel,
  };
}

/**
 * Extracts message text, tolerating providers that return an empty string when the
 * completion budget was spent on reasoning tokens.
 */
export function extractContent(message: any, context: string): string {
  const content = typeof message?.content === 'string' ? message.content.trim() : '';
  if (!content) {
    logger.warn('LLM returned empty content', {
      context,
      provider: config.llmProvider,
      model: config.openaiModel,
      hint: 'Reasoning models consume the token budget before emitting text — raise LLM_MAX_TOKENS.',
    });
  }
  return content;
}
