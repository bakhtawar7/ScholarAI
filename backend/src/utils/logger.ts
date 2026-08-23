import { config } from '../config';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVEL_ORDER[config.logLevel as Level] ?? LEVEL_ORDER.info;

/** Field names whose values must never reach the logs. */
const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'jwtsecret',
  'openaiapikey',
  'apikey',
  'secret',
  'cvtext',
  'drafttext',
]);

function redact(value: any, depth = 0): any {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[depth-limit]';
  if (Array.isArray(value)) return value.slice(0, 25).map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…[truncated]`;
  return value;
}

function emit(level: Level, message: string, meta?: any) {
  if (LEVEL_ORDER[level] < threshold) return;

  const line = `[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`;
  const payload = meta === undefined ? '' : JSON.stringify(redact(meta));
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(line, payload);
}

export const logger = {
  debug: (message: string, meta?: any) => emit('debug', message, meta),
  info: (message: string, meta?: any) => emit('info', message, meta),
  warn: (message: string, meta?: any) => emit('warn', message, meta),
  error: (message: string, meta?: any) => emit('error', message, meta),
};
