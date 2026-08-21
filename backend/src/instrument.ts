/**
 * Sentry bootstrap.
 *
 * Must be imported before express, Prisma or the OpenAI SDK so `@sentry/node` can patch
 * them for request context and tracing — that is the only reason this is a separate module
 * rather than a call inside `index.ts`. Keep it as the first import there.
 *
 * Without `SENTRY_DSN` this is a no-op: nothing is patched that would emit, and every
 * capture helper short-circuits.
 */
import { initSentry } from './utils/sentry';

initSentry();
