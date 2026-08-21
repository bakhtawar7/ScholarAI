import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { DeadlineItem } from '../types';
import { LoadingState, ErrorState, InlineError } from '../components/common/States';
import {
  Clock,
  AlertTriangle,
  Calendar,
  Sparkles,
  ExternalLink,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowRight,
  ShieldCheck,
  Bell,
  Play,
  Layers,
} from 'lucide-react';

export const DeadlinesPage: React.FC = () => {
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [automationResult, setAutomationResult] = useState<any | null>(null);

  const fetchDeadlines = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getDeadlines();
      setDeadlines(Array.isArray(data) ? data : []);
    } catch (err) {
      // Surface the failure instead of rendering the "no deadlines" empty state.
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your deadlines.');
      setDeadlines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDeadlines();
  }, [fetchDeadlines]);

  const handleRunAutomation = async () => {
    setRunningAutomation(true);
    setAutomationResult(null);
    try {
      const res = await api.runDeadlineAutomation(true);
      setAutomationResult(res);
      await fetchDeadlines();
    } catch (err) {
      // 403 here is expected for a student account: the sweep is admin-only.
      const message =
        err instanceof ApiError
          ? err.status === 403
            ? 'Running the deadline scan requires an administrator account.'
            : err.message
          : 'Automation scan failed';
      setAutomationResult({ error: message });
    } finally {
      setRunningAutomation(false);
    }
  };

  const filteredDeadlines = deadlines.filter((d) => {
    if (urgencyFilter === 'ALL') return true;
    return d.urgency === urgencyFilter;
  });

  const criticalCount = deadlines.filter((d) => d.urgency === 'CRITICAL').length;
  const urgentCount = deadlines.filter((d) => d.urgency === 'URGENT').length;
  const upcomingCount = deadlines.filter((d) => d.urgency === 'UPCOMING').length;
  const expiredCount = deadlines.filter((d) => d.urgency === 'EXPIRED').length;

  if (loading) {
    return <LoadingState message="Calculating scholarship deadline urgency and countdowns…" />;
  }

  if (loadError) {
    return <ErrorState title="Could not load deadlines" message={loadError} onRetry={() => void fetchDeadlines()} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with Automation Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-rose-400" />
            <span>Scholarship Deadline Tracker</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor submission cutoffs, milestone reminder schedules (30, 14, 7, 3, 1 days), and urgency statuses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAutomation}
            disabled={runningAutomation}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-brand-500/20 flex items-center gap-2"
          >
            {runningAutomation ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
            <span>{runningAutomation ? 'Running Daily Scan...' : 'Trigger Deadline Alert Scan'}</span>
          </button>
        </div>
      </div>

      {/* Automation Result Modal / Banner */}
      {automationResult && (
        <div className="p-4 rounded-3xl bg-dark-card border border-brand-500/40 text-xs space-y-2 shadow-2xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Daily Deadline Automation Audit Result</span>
            </div>
            <button
              onClick={() => setAutomationResult(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-dark-bg/80 border border-dark-border">
              <span className="text-slate-400 block">Checked Scholarships:</span>
              <strong className="text-sm text-white">{automationResult.checkedScholarshipsCount ?? 0}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-dark-bg/80 border border-emerald-500/30">
              <span className="text-emerald-300 block">Notifications Dispatched:</span>
              <strong className="text-sm text-emerald-400">{automationResult.notificationsCreated ?? 0}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-dark-bg/80 border border-dark-border">
              <span className="text-slate-400 block">Duplicates Prevented:</span>
              <strong className="text-sm text-indigo-300">{automationResult.duplicatesSuppressed ?? 0}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-dark-bg/80 border border-dark-border">
              <span className="text-slate-400 block">Submitted Suppressed:</span>
              <strong className="text-sm text-cyan-300">{automationResult.submittedSuppressed ?? 0}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-dark-bg/80 border border-dark-border">
              <span className="text-slate-400 block">Rejected Suppressed:</span>
              <strong className="text-sm text-rose-300">{automationResult.rejectedSuppressed ?? 0}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Urgency Metrics */}
      <div className="p-4 rounded-3xl glass-card border border-dark-border flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none text-xs">
          <button
            onClick={() => setUrgencyFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap ${
              urgencyFilter === 'ALL'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-dark-hover'
            }`}
          >
            All Deadlines ({deadlines.length})
          </button>
          <button
            onClick={() => setUrgencyFilter('CRITICAL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              urgencyFilter === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            <span>🔴 Critical (&le;7d)</span>
            <span className="w-4 h-4 rounded-full bg-dark-bg/80 text-[10px] flex items-center justify-center font-bold">
              {criticalCount}
            </span>
          </button>
          <button
            onClick={() => setUrgencyFilter('URGENT')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              urgencyFilter === 'URGENT'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <span>🟠 Urgent (&le;30d)</span>
            <span className="w-4 h-4 rounded-full bg-dark-bg/80 text-[10px] flex items-center justify-center font-bold">
              {urgentCount}
            </span>
          </button>
          <button
            onClick={() => setUrgencyFilter('UPCOMING')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              urgencyFilter === 'UPCOMING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <span>🟢 On Track (&gt;30d)</span>
            <span className="w-4 h-4 rounded-full bg-dark-bg/80 text-[10px] flex items-center justify-center font-bold">
              {upcomingCount}
            </span>
          </button>
          <button
            onClick={() => setUrgencyFilter('EXPIRED')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              urgencyFilter === 'EXPIRED'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:bg-dark-hover'
            }`}
          >
            <span>Closed / Expired</span>
            <span className="w-4 h-4 rounded-full bg-dark-bg/80 text-[10px] flex items-center justify-center font-bold">
              {expiredCount}
            </span>
          </button>
        </div>
      </div>

      {/* Deadlines List */}
      <div className="space-y-4">
        {filteredDeadlines.length === 0 ? (
          <div className="p-12 text-center glass-card rounded-3xl border border-dark-border text-slate-400 space-y-2 shadow-lg">
            <Calendar className="w-10 h-10 text-brand-400 mx-auto" />
            <h3 className="text-base font-bold text-white">No Tracked Deadlines in this Category</h3>
            <p className="text-xs max-w-md mx-auto">
              Save international scholarships from the Explorer or create an application tracker card to monitor countdown milestones automatically.
            </p>
            <div className="pt-2">
              <Link
                to="/scholarships"
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md"
              >
                <span>Explore Scholarships</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          filteredDeadlines.map((item, idx) => {
            const isCritical = item.urgency === 'CRITICAL';
            const isUrgent = item.urgency === 'URGENT';
            const isExpired = item.daysRemaining < 0;

            return (
              <div
                key={idx}
                className="p-5 rounded-3xl glass-card border border-dark-border hover:border-brand-500/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
              >
                {/* Left: Info */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold border ${
                        isExpired
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : isCritical
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                          : isUrgent
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isExpired ? 'EXPIRED' : `${item.daysRemaining} Days Remaining`}
                    </span>
                    <span className="text-xs text-cyan-400 font-semibold uppercase">
                      {item.scholarship.hostCountry}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400">
                      Funding: <strong className="text-slate-200">{item.scholarship.fundingType}</strong>
                    </span>
                  </div>

                  <Link
                    to={`/scholarships/${item.scholarship.id}`}
                    className="font-bold text-base text-white hover:text-cyan-300 transition line-clamp-1 block"
                  >
                    {item.scholarship.title}
                  </Link>

                  <p className="text-xs text-slate-400">
                    Provider: <span className="text-slate-300">{item.scholarship.provider}</span> • University:{' '}
                    <span className="text-slate-300">{item.scholarship.university || 'Participating Universities'}</span>
                  </p>
                </div>

                {/* Right: Date & Actions */}
                <div className="flex items-center gap-4 text-xs shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-dark-border/40 justify-between md:justify-end">
                  <div className="text-left md:text-right">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <span>{item.deadlineFormatted}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Status: <strong className="text-white">{item.status}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/applications`}
                      className="px-3.5 py-2 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-slate-300 hover:text-white font-semibold transition flex items-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5 text-brand-400" />
                      <span>Tracker</span>
                    </Link>

                    <Link
                      to={`/scholarships/${item.scholarship.id}`}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition shadow-md shadow-brand-600/20 flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DeadlinesPage;
