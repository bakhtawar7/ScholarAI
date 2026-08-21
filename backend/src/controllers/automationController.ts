import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { WORKFLOWS, getWorkflow } from '../automation/workflowRegistry';
import { runWorkflow, listWorkflowStatus, runningWorkflows } from '../automation/workflowRunner';
import { isSchedulerRunning } from '../automation/scheduler';
import { parseJsonField } from '../utils/jsonHelper';

export const triggerWorkflowSchema = z.object({
  params: z.object({ key: z.string().min(1) }),
  body: z
    .object({
      // Free-form per-workflow input; capped so a manual trigger cannot be used
      // to push an unbounded payload into a run record.
      payload: z.record(z.any()).optional(),
    })
    .strip()
    .default({}),
});

export const runsQuerySchema = z.object({
  query: z
    .object({
      workflowKey: z.string().max(64).optional(),
      status: z.enum(['RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strip(),
});

function serialiseRun(run: any) {
  return {
    id: run.id,
    workflowKey: run.workflowKey,
    workflowName: run.workflowName,
    trigger: run.trigger,
    status: run.status,
    attempt: run.attempt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: run.durationMs,
    metrics: parseJsonField(run.metrics, null),
    errorMessage: run.errorMessage,
    triggeredBy: run.triggeredBy,
  };
}

export class AutomationController {
  /** Workflow catalogue plus scheduler state and each workflow's last run. */
  static async listWorkflows(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workflows = await listWorkflowStatus(WORKFLOWS);
      res.status(200).json({
        schedulerRunning: isSchedulerRunning(),
        currentlyRunning: runningWorkflows(),
        total: workflows.length,
        workflows,
      });
    } catch (err) {
      next(err);
    }
  }

  /** Paginated execution history. */
  static async listRuns(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { workflowKey, status, page, limit } = req.query as unknown as {
        workflowKey?: string;
        status?: string;
        page: number;
        limit: number;
      };

      const where: any = {};
      if (workflowKey) where.workflowKey = workflowKey;
      if (status) where.status = status;

      const [total, runs] = await Promise.all([
        prisma.workflowRun.count({ where }),
        prisma.workflowRun.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      res.status(200).json({
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        items: runs.map(serialiseRun),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const run = await prisma.workflowRun.findUnique({ where: { id: req.params.id } });
      if (!run) return res.status(404).json({ error: 'Workflow run not found' });
      res.status(200).json(serialiseRun(run));
    } catch (err) {
      next(err);
    }
  }

  /** Runs a workflow immediately. Awaited so the admin sees the real outcome. */
  static async triggerWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const definition = getWorkflow(key);

      if (!definition) {
        return res.status(404).json({
          error: `Unknown workflow "${key}"`,
          availableWorkflows: WORKFLOWS.map((w) => w.key),
        });
      }

      const result = await runWorkflow(key, {
        trigger: 'MANUAL',
        payload: req.body?.payload || {},
        triggeredBy: req.user ? `${req.user.email} (${req.user.id.slice(0, 8)})` : 'admin',
      });

      // 409 when an overlapping run blocked this request; 500 when the run itself failed.
      const httpStatus = result.status === 'SUCCESS' ? 200 : result.status === 'SKIPPED' ? 409 : 500;
      res.status(httpStatus).json({
        workflow: { key: definition.key, name: definition.name },
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /** Aggregate health for the admin dashboard header. */
  static async getStats(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [total, last24h, failed24h, running] = await Promise.all([
        prisma.workflowRun.count(),
        prisma.workflowRun.count({ where: { startedAt: { gte: since } } }),
        prisma.workflowRun.count({ where: { startedAt: { gte: since }, status: 'FAILED' } }),
        prisma.workflowRun.count({ where: { status: 'RUNNING' } }),
      ]);

      res.status(200).json({
        schedulerRunning: isSchedulerRunning(),
        totalRuns: total,
        runsLast24h: last24h,
        failuresLast24h: failed24h,
        currentlyRunning: running,
        registeredWorkflows: WORKFLOWS.length,
      });
    } catch (err) {
      next(err);
    }
  }
}
