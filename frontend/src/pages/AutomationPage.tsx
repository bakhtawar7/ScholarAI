import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../services/api';
import { LoadingState, ErrorState, EmptyState, InlineError } from '../components/common/States';
import {
  Workflow,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface WorkflowSummary {
  key: string;
  name: string;
  description: string;
  intervalMinutes: number;
  manualOnly: boolean;
  maxAttempts: number;
  isRunning: boolean;
  lastRun: null | {
    id: string;
    status: string;
    trigger: string;
    attempt: number;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
  };
}

interface RunRecord {
  id: string;
  workflowKey: string;
  workflowName: string;
  trigger: string;
  status: string;
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  metrics: Record<string, any> | null;
  errorMessage: string | null;
  triggeredBy: string | null;
}

function formatInterval(minutes: number): string {
  if (minutes === 0) return 'Manual / event only';
  if (minutes < 60) return `Every ${minutes} min`;
  const hours = minutes / 60;
  if (hours < 24) return `Every ${hours} h`;
  return `Every ${hours / 24} day${hours / 24 > 1 ? 's' : ''}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

const STATUS_STYLE: Record<string, { cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  SUCCESS: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 },
  FAILED: { cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30', Icon: XCircle },
  RUNNING: { cls: 'bg-brand-500/15 text-brand-300 border-brand-500/30', Icon: Loader2 },
  SKIPPED: { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', Icon: SkipForward },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const style = STATUS_STYLE[status] || {
    cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    Icon: Clock,
  };
  const { Icon } = style;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold border ${style.cls}`}
    >
      <Icon className={`w-3 h-3 ${status === 'RUNNING' ? 'animate-spin' : ''}`} aria-hidden="true" />
      {status}
    </span>
  );
};

export const AutomationPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [triggeringKey, setTriggeringKey] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setLoadError(null);
    try {
      const [wf, runsRes, statsRes] = await Promise.all([
        api.getAutomationWorkflows(),
        api.getAutomationRuns({ limit: 25 }),
        api.getAutomationStats(),
      ]);
      setWorkflows(wf.workflows || []);
      setSchedulerRunning(Boolean(wf.schedulerRunning));
      setRuns(runsRes.items || []);
      setStats(statsRes);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load automation state.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTrigger = async (key: string, name: string) => {
    setTriggeringKey(key);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await api.runAutomationWorkflow(key);
      setActionNotice(
        `"${name}" completed in ${formatDuration(result.durationMs)} (${result.attempts} attempt${
          result.attempts === 1 ? '' : 's'
        }).`
      );
      await load(false);
    } catch (err) {
      if (err instanceof ApiError) {
        // 409 = an overlapping run already holds this workflow; 500 = the run itself failed.
        setActionError(
          err.status === 409
            ? `"${name}" is already running. Wait for it to finish and try again.`
            : `"${name}" failed: ${err.message}`
        );
      } else {
        setActionError(`Could not trigger "${name}".`);
      }
      await load(false);
    } finally {
      setTriggeringKey(null);
    }
  };

  if (loading) return <LoadingState message="Loading automation workflows and run history…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center shrink-0">
              <Workflow className="w-5 h-5 text-white" aria-hidden="true" />
            </span>
            Automation Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            In-app scheduled workflows for discovery, verification, matching, reminders and notification dispatch.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-dark-card border border-dark-border hover:border-brand-500/50 text-slate-200 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {actionError && <InlineError message={actionError} onDismiss={() => setActionError(null)} />}
      {actionNotice && (
        <div
          role="status"
          className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1">{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)} aria-label="Dismiss" className="font-bold px-1">
            ×
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Scheduler',
            value: schedulerRunning ? 'Active' : 'Stopped',
            accent: schedulerRunning ? 'text-emerald-400' : 'text-rose-400',
            Icon: Activity,
          },
          {
            label: 'Workflows',
            value: stats?.registeredWorkflows ?? workflows.length,
            accent: 'text-white',
            Icon: Workflow,
          },
          { label: 'Runs (24 h)', value: stats?.runsLast24h ?? 0, accent: 'text-white', Icon: Clock },
          {
            label: 'Failures (24 h)',
            value: stats?.failuresLast24h ?? 0,
            accent: (stats?.failuresLast24h ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400',
            Icon: AlertTriangle,
          },
          { label: 'Running now', value: stats?.currentlyRunning ?? 0, accent: 'text-brand-300', Icon: Loader2 },
        ].map(({ label, value, accent, Icon }) => (
          <div key={label} className="p-4 rounded-2xl glass-card border border-dark-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xs text-slate-400 font-medium">{label}</span>
              <Icon className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            </div>
            <div className={`text-xl font-extrabold ${accent}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Workflow list */}
      <section aria-labelledby="workflows-heading" className="space-y-3">
        <h2 id="workflows-heading" className="text-sm font-bold text-white">
          Registered workflows
        </h2>

        {workflows.length === 0 ? (
          <EmptyState title="No workflows registered" message="The automation registry returned no workflows." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {workflows.map((wf) => (
              <div key={wf.key} className="p-4 rounded-2xl glass-card border border-dark-border space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{wf.name}</h3>
                    <code className="text-2xs text-brand-300">{wf.key}</code>
                  </div>
                  {wf.lastRun ? (
                    <StatusBadge status={wf.isRunning ? 'RUNNING' : wf.lastRun.status} />
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-bold border bg-slate-500/15 text-slate-400 border-slate-500/30">
                      NEVER RUN
                    </span>
                  )}
                </div>

                <p className="text-2xs text-slate-400 leading-relaxed">{wf.description}</p>

                <dl className="grid grid-cols-2 gap-2 text-2xs">
                  <div>
                    <dt className="text-slate-500">Schedule</dt>
                    <dd className="text-slate-200 font-medium">{formatInterval(wf.intervalMinutes)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Max attempts</dt>
                    <dd className="text-slate-200 font-medium">{wf.maxAttempts}</dd>
                  </div>
                  {wf.lastRun && (
                    <>
                      <div>
                        <dt className="text-slate-500">Last run</dt>
                        <dd className="text-slate-200 font-medium">
                          {new Date(wf.lastRun.startedAt).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Duration</dt>
                        <dd className="text-slate-200 font-medium">{formatDuration(wf.lastRun.durationMs)}</dd>
                      </div>
                    </>
                  )}
                </dl>

                {wf.lastRun?.errorMessage && (
                  <p className="text-2xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg p-2 break-words">
                    {wf.lastRun.errorMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleTrigger(wf.key, wf.name)}
                  disabled={triggeringKey !== null || wf.isRunning}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                >
                  {triggeringKey === wf.key ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      Running…
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      Run now
                    </>
                  )}
                </button>
                {wf.manualOnly && (
                  <p className="text-2xs text-amber-300/80">
                    Requires an input payload — trigger via the API with <code>{'{ payload: { … } }'}</code>.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Run history */}
      <section aria-labelledby="runs-heading" className="space-y-3">
        <h2 id="runs-heading" className="text-sm font-bold text-white">
          Recent run history
        </h2>

        {runs.length === 0 ? (
          <EmptyState
            title="No runs recorded yet"
            message="Workflows write a durable record on every execution. Trigger one above, or wait for the scheduler."
          />
        ) : (
          <div className="rounded-2xl glass-card border border-dark-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Workflow execution history</caption>
                <thead className="bg-dark-bg/60 text-slate-400">
                  <tr>
                    <th scope="col" className="text-left font-semibold px-3 py-2.5 w-8" />
                    <th scope="col" className="text-left font-semibold px-3 py-2.5">
                      Workflow
                    </th>
                    <th scope="col" className="text-left font-semibold px-3 py-2.5">
                      Status
                    </th>
                    <th scope="col" className="text-left font-semibold px-3 py-2.5">
                      Trigger
                    </th>
                    <th scope="col" className="text-left font-semibold px-3 py-2.5">
                      Started
                    </th>
                    <th scope="col" className="text-left font-semibold px-3 py-2.5">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const isOpen = expandedRun === run.id;
                    return (
                      <React.Fragment key={run.id}>
                        <tr className="border-t border-dark-border/70 hover:bg-dark-hover/40">
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => setExpandedRun(isOpen ? null : run.id)}
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${run.workflowName}`}
                              className="text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
                            >
                              {isOpen ? (
                                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-slate-200 font-medium">{run.workflowName}</td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={run.status} />
                          </td>
                          <td className="px-3 py-2.5 text-slate-400">{run.trigger}</td>
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                            {new Date(run.startedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                            {formatDuration(run.durationMs)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-t border-dark-border/40 bg-dark-bg/40">
                            <td colSpan={6} className="px-4 py-3 space-y-2">
                              {run.triggeredBy && (
                                <p className="text-2xs text-slate-400">
                                  Triggered by <span className="text-slate-200">{run.triggeredBy}</span> · attempt{' '}
                                  {run.attempt}
                                </p>
                              )}
                              {run.errorMessage && (
                                <p className="text-2xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg p-2 break-words">
                                  {run.errorMessage}
                                </p>
                              )}
                              {run.metrics ? (
                                <pre className="text-2xs text-slate-300 bg-dark-bg border border-dark-border rounded-lg p-2.5 overflow-auto max-h-56">
                                  {JSON.stringify(run.metrics, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-2xs text-slate-500">No metrics recorded for this run.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
