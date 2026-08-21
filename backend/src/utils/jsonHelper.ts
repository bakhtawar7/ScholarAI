export function parseJsonField<T>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(value: any, fallbackStr = '[]'): string {
  if (value === null || value === undefined) return fallbackStr;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
