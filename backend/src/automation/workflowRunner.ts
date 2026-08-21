import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { safeJsonStringify } from '../utils/jsonHelper';
import { captureException } from '../utils/sentry';
import { getWorkflow, WorkflowDefinition, WorkflowMetrics } from './workflowRegistry';

export type TriggerType = 'SCHEDULE' | 'MANUAL' | 'STARTUP';

export interface RunOptions {
  trigger?: TriggerType;
  payload?: Record<string, any>;
  triggeredBy?: string;
  /**
   * Stable identifier for this logical occurrence. Written to a unique column so a
   * second concurrent run of the same occurrence is rejected by the database rather
   * than relying on in-process state.
   */
  lockKey?: string;
}

export interface RunResult {
  runId: string | null;
  workflowKey: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  attempts: number;
  durationMs: number;
  metrics?: WorkflowMetrics;
  error?: string;
}

/** Guards against the same workflow overlapping itself within one process. */
const inFlight = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUniqueViolation(err: any) {
  return err?.code === 'P2002';
}

/**
 * Executes a workflow with retry, durable run logging and overlap protection.
 * Never throws for a workflow-level failure — the failure is recorded and returned,
 * so a scheduler tick or an admin request cannot crash the process.
 */
export async function runWorkflow(workflowKey: string, options: RunOptions = {}): Promise<RunResult> {
  const definition = getWorkflow(workflowKey);

  if (!definition) {
    return {
      runId: null,
      workflowKey,
      status: 'FAILED',
      attempts: 0,
      durationMs: 0,
      error: `Unknown workflow "${workflowKey}"`,
    };
  }

  const trigger = options.trigger || 'MANUAL';

  if (inFlight.has(workflowKey)) {
    logger.warn('Workflow already running — skipping overlapping execution', { workflowKey, trigger });
    return { runId: null, workflowKey, status: 'SKIPPED', attempts: 0, durationMs: 0, error: 'Already running' };
  }

  let run;
  try {
    run = await prisma.workflowRun.create({
      data: {
        workflowKey: definition.key,
        workflowName: definition.name,
        trigger,
        status: 'RUNNING',
        triggeredBy: options.triggeredBy || (trigger === 'SCHEDULE' ? 'scheduler' : null),
        lockKey: options.lockKey || null,
      },
    });
  } catch (err: any) {
    if (isUniqueViolation(err)) {
      // Another process already claimed this occurrence.
      logger.info('Workflow occurrence already claimed elsewhere — skipping', {
        workflowKey,
        lockKey: options.lockKey,
      });
      return { runId: null, workflowKey, status: 'SKIPPED', attempts: 0, durationMs: 0, error: 'Occurrence already claimed' };
    }
    logger.error('Could not create workflow run record', { workflowKey, message: err?.message });
    return { runId: null, workflowKey, status: 'FAILED', attempts: 0, durationMs: 0, error: err?.message };
  }

  inFlight.add(workflowKey);
  const startedAt = Date.now();
  let attempt = 0;
  let lastError: any = null;

  try {
    while (attempt < Math.max(1, definition.maxAttempts)) {
      attempt++;
      try {
        const metrics = await definition.handler({
          payload: options.payload || {},
          log: (message, meta) => logger.info(`[${definition.key}] ${message}`, meta),
        });

        const durationMs = Date.now() - startedAt;
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: 'SUCCESS',
            attempt,
            finishedAt: new Date(),
            durationMs,
            metrics: safeJsonStringify(metrics, '{}'),
            // Release the occupancy lock so a later occurrence can reuse the key.
            lockKey: null,
          },
        });

        logger.info(`Workflow "${definition.key}" succeeded`, { attempt, durationMs, trigger });
        return { runId: run.id, workflowKey: definition.key, status: 'SUCCESS', attempts: attempt, durationMs, metrics };
      } catch (err: any) {
        lastError = err;
        const willRetry = attempt < definition.maxAttempts;
        logger.warn(`Workflow "${definition.key}" attempt ${attempt} failed`, {
          message: err?.message,
          willRetry,
        });
        if (willRetry && definition.retryDelayMs > 0) {
          await sleep(definition.retryDelayMs * attempt); // linear backoff
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        attempt,
        finishedAt: new Date(),
        durationMs,
        errorMessage: String(lastError?.message || 'Unknown error').slice(0, 1000),
        errorStack: lastError?.stack ? String(lastError.stack).slice(0, 4000) : null,
        lockKey: null,
      },
    });

    logger.error(`Workflow "${definition.key}" failed after ${attempt} attempt(s)`, {
      message: lastError?.message,
      trigger,
    });

    // Background failures have no client to surface to — without this a workflow can be
    // failing every run and the only trace is a server log line.
    captureException(lastError, {
      area: 'automation',
      level: 'error',
      extra: { workflowKey: definition.key, workflowName: definition.name, trigger, attempts: attempt, runId: run.id },
    });

    return {
      runId: run.id,
      workflowKey: definition.key,
      status: 'FAILED',
      attempts: attempt,
      durationMs,
      error: lastError?.message || 'Unknown error',
    };
  } finally {
    inFlight.delete(workflowKey);
  }
}

export function isWorkflowRunning(workflowKey: string) {
  return inFlight.has(workflowKey);
}

export function runningWorkflows(): string[] {
  return Array.from(inFlight);
}

/** Workflow definitions plus their latest run, for the admin console. */
export async function listWorkflowStatus(definitions: WorkflowDefinition[]) {
  const latestRuns = await prisma.workflowRun.findMany({
    where: { workflowKey: { in: definitions.map((d) => d.key) } },
    orderBy: { startedAt: 'desc' },
    take: 200,
  });

  const latestByKey = new Map<string, (typeof latestRuns)[number]>();
  for (const run of latestRuns) {
    if (!latestByKey.has(run.workflowKey)) latestByKey.set(run.workflowKey, run);
  }

  return definitions.map((d) => {
    const last = latestByKey.get(d.key);
    return {
      key: d.key,
      name: d.name,
      description: d.description,
      intervalMinutes: d.intervalMinutes,
      manualOnly: Boolean(d.manualOnly),
      maxAttempts: d.maxAttempts,
      isRunning: inFlight.has(d.key),
      lastRun: last
        ? {
            id: last.id,
            status: last.status,
            trigger: last.trigger,
            attempt: last.attempt,
            startedAt: last.startedAt,
            finishedAt: last.finishedAt,
            durationMs: last.durationMs,
            errorMessage: last.errorMessage,
          }
        : null,
    };
  });
}
