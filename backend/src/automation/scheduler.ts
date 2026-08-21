import { WORKFLOWS } from './workflowRegistry';
import { runWorkflow } from './workflowRunner';
import { logger } from '../utils/logger';
import { config } from '../config';

const timers: NodeJS.Timeout[] = [];
let started = false;

/**
 * Bucket the current time into interval-sized slots. Two processes starting at
 * different moments derive the same key for the same slot, so the unique lockKey
 * column lets only one of them execute that occurrence.
 */
function occurrenceKey(workflowKey: string, intervalMinutes: number): string {
  const slotMs = intervalMinutes * 60_000;
  const slot = Math.floor(Date.now() / slotMs);
  return `${workflowKey}:${slot}`;
}

/**
 * Starts interval timers for every scheduled workflow.
 *
 * Deliberately uses fixed intervals rather than cron: the cadences here are all
 * "every N hours" and this avoids a scheduling dependency. Runs are staggered so
 * several heavy workflows do not fire simultaneously on boot.
 */
export function startScheduler() {
  if (started) {
    logger.warn('Scheduler already started — ignoring duplicate start');
    return;
  }
  started = true;

  const scheduled = WORKFLOWS.filter((w) => !w.manualOnly && w.intervalMinutes > 0);

  scheduled.forEach((workflow, index) => {
    const intervalMs = workflow.intervalMinutes * 60_000;
    // 20s apart, so the first tick of ten workflows does not land at once.
    const initialDelayMs = 20_000 * (index + 1);

    const kickoff = setTimeout(() => {
      void runWorkflow(workflow.key, {
        trigger: 'SCHEDULE',
        lockKey: occurrenceKey(workflow.key, workflow.intervalMinutes),
      });

      const interval = setInterval(() => {
        void runWorkflow(workflow.key, {
          trigger: 'SCHEDULE',
          lockKey: occurrenceKey(workflow.key, workflow.intervalMinutes),
        });
      }, intervalMs);
      interval.unref?.();
      timers.push(interval);
    }, initialDelayMs);

    kickoff.unref?.();
    timers.push(kickoff);
  });

  logger.info('Automation scheduler started', {
    scheduledWorkflows: scheduled.length,
    manualOnly: WORKFLOWS.filter((w) => w.manualOnly || w.intervalMinutes === 0).map((w) => w.key),
    environment: config.nodeEnv,
  });
}

export function stopScheduler() {
  timers.forEach((t) => clearTimeout(t as unknown as NodeJS.Timeout));
  timers.length = 0;
  started = false;
  logger.info('Automation scheduler stopped');
}

export function isSchedulerRunning() {
  return started;
}
