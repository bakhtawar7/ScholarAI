// Must stay first: Sentry patches http, express and Prisma at import time.
import './instrument';

import express from 'express';
import cors from 'cors';
import { config, isUsingInsecureJwtSecret } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { securityHeaders, requestLogger } from './middleware/security';
import { globalRateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { prisma, disconnectPrisma } from './utils/prisma';
import { describeLlm } from './utils/llmClient';
import { captureException, flushSentry, isSentryEnabled } from './utils/sentry';
import { EmailService } from './services/emailService';
import { mountApiDocs } from './docs';
import { startScheduler, stopScheduler } from './automation/scheduler';

import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';
import scholarshipRoutes from './routes/scholarshipRoutes';
import recommendationRoutes from './routes/recommendationRoutes';
import savedRoutes from './routes/savedRoutes';
import applicationRoutes from './routes/applicationRoutes';
import deadlineRoutes from './routes/deadlineRoutes';
import notificationRoutes from './routes/notificationRoutes';
import documentRoutes from './routes/documentRoutes';
import chatRoutes from './routes/chatRoutes';
import automationRoutes from './routes/automationRoutes';

const app = express();

if (config.trustProxy) {
  // Required for correct client IPs (and therefore correct rate limiting) behind a proxy.
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

app.use(securityHeaders);
app.use(requestLogger);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin/non-browser callers (curl, health probes) which send no Origin.
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
        return callback(null, true);
      }
      logger.warn('Blocked cross-origin request', { origin });
      return callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400,
  })
);

// Document uploads go through multer (multipart); JSON bodies stay small on purpose.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Mounted before the API rate limiter: the reference page pulls several static assets,
// and loading the docs should not eat into a developer's request budget for real calls.
mountApiDocs(app);

app.use('/api', globalRateLimiter);

/** Liveness — no dependencies touched, safe for aggressive probing. */
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'AI Scholarship Copilot API',
    version: process.env.APP_VERSION || '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

/** Readiness — verifies the database is actually reachable. */
app.get('/api/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error('Readiness probe failed', { message: err?.message });
    // A failing readiness probe is the earliest signal of a database outage.
    captureException(err, { area: 'database', extra: { probe: 'readiness' }, level: 'error' });
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/scholarships', scholarshipRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/deadlines', deadlineRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/automation', automationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  if (isUsingInsecureJwtSecret) {
    logger.warn('JWT_SECRET is unset — using the development-only default. Set JWT_SECRET before deploying.');
  }
  // Make the active provider explicit at boot: a key pointed at the wrong baseURL is
  // otherwise indistinguishable from having no key at all.
  logger.info(`LLM: ${describeLlm()}`);
  if (!config.openaiApiKey) {
    logger.warn('No LLM API key set — AI features fall back to deterministic engines.');
  }
  if (config.adminEmails.length === 0) {
    logger.warn('ADMIN_EMAILS is unset — no account can reach admin-only catalogue/automation routes.');
  }
  // Same reasoning for outbound mail and error reporting: silence here is ambiguous, so
  // state which transport is live rather than letting a missing key look like success.
  logger.info(`Email: ${EmailService.describeTransport()}`);
  for (const warning of EmailService.configWarnings()) {
    logger.warn(`Email configuration: ${warning}`);
  }
  if (!isSentryEnabled()) {
    logger.warn('SENTRY_DSN is unset — errors are logged locally only.');
  }

  const server = app.listen(config.port, () => {
    logger.info(`AI Scholarship Copilot API listening on port ${config.port}`, {
      environment: config.nodeEnv,
      automation: config.automationEnabled,
      docs: config.docsEnabled ? '/api/docs' : 'disabled',
    });
    if (config.automationEnabled) startScheduler();
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    stopScheduler();
    server.close(async () => {
      // Flush before disconnecting: buffered events are lost once the process exits.
      await flushSentry();
      await disconnectPrisma();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Escape hatch if in-flight connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
    captureException(reason, { area: 'process', extra: { kind: 'unhandledRejection' }, level: 'error' });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — exiting', { message: err.message, stack: err.stack });
    captureException(err, { area: 'process', extra: { kind: 'uncaughtException' }, level: 'fatal' });
    // Give Sentry a moment to deliver the report, but exit either way.
    void flushSentry(1500).finally(() => process.exit(1));
  });
}

export default app;
