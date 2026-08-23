import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { DeadlineItem, Application, ScholarshipMatch } from '../types';
import { EligibilityExplanationModal } from '../components/scholarships/EligibilityExplanationModal';
import { LoadingState, ErrorState, InlineError } from '../components/common/States';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Info,
  KanbanSquare,
  RefreshCw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partialFailures, setPartialFailures] = useState<string[]>([]);
  const [selectedScholarship, setSelectedScholarship] = useState<any | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<ScholarshipMatch | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setPartialFailures([]);

    // allSettled rather than swallowing each rejection with .catch(() => []):
    // the dashboard still renders what loaded, but the user is told what did not.
    const [recsRes, deadsRes, appsRes] = await Promise.allSettled([
      api.getRecommendations(),
      api.getDeadlines(),
      api.getApplications(),
    ]);

    const failed: string[] = [];
    if (recsRes.status === 'fulfilled') setRecommendations(recsRes.value || []);
    else failed.push('recommendations');
    if (deadsRes.status === 'fulfilled') setDeadlines(deadsRes.value || []);
    else failed.push('deadlines');
    if (appsRes.status === 'fulfilled') setApplications(appsRes.value || []);
    else failed.push('applications');

    if (failed.length === 3) {
      setLoadError('Could not load your dashboard. Please check your connection and try again.');
    } else {
      setPartialFailures(failed);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRecalculateAll = async () => {
    setRecalculating(true);
    setActionError(null);
    try {
      await api.recalculateMatches();
      await fetchDashboardData();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? `Could not recalculate matches: ${err.message}` : 'Could not recalculate matches.'
      );
    } finally {
      setRecalculating(false);
    }
  };

  const profile = user?.profile;
  // No recommendations means no score — showing a hardcoded 94% invented data.
  const topMatchScore = recommendations.length > 0 ? Math.round(recommendations[0].matchPercentage ?? 0) : null;
  const urgentCount = deadlines.filter((d) => d.urgency === 'CRITICAL' || d.urgency === 'URGENT').length;

  if (loading) {
    return <LoadingState message="Loading your Copilot dashboard…" />;
  }

  if (loadError) {
    return <ErrorState title="Dashboard unavailable" message={loadError} onRetry={() => void fetchDashboardData()} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome & Academic Profile Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-dark-card border border-brand-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 text-xs font-semibold mb-3">
              <Target className="w-3.5 h-3.5" aria-hidden="true" />
              <span>AI Matching Active</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              Student Dashboard — {profile?.fullName || 'Student'}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              {/* Placeholders were previously invented values ("Computer Science", GPA 3.65),
                  which read as real profile data on an unfilled profile. */}
              {profile?.fieldOfStudy || 'Field not set'} • {profile?.university || 'University not set'}
              {profile?.gpa ? ` (GPA: ${profile.gpa}/${profile.maxGpa || 4.0})` : ' (GPA not set)'}
            </p>
          </div>

          <Link
            to="/profile"
            className="px-4 py-2.5 rounded-xl bg-dark-bg border border-dark-border hover:border-brand-500/50 text-slate-200 text-xs font-semibold transition shrink-0"
          >
            Edit Academic Profile
          </Link>
        </div>
      </div>

      {/* Partial-failure and action-error banners: the page still renders, but the
          user is told which sections are stale rather than silently seeing zeros. */}
      {partialFailures.length > 0 && (
        <InlineError
          message={`Could not load: ${partialFailures.join(', ')}. Other sections may be incomplete.`}
          onDismiss={() => setPartialFailures([])}
        />
      )}
      {actionError && <InlineError message={actionError} onDismiss={() => setActionError(null)} />}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-card border border-dark-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Top Match Score</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{topMatchScore !== null ? `${topMatchScore}%` : '—'}</div>
          <p className="text-2xs text-emerald-400 mt-1">
            {topMatchScore !== null ? 'Direct academic compatibility' : 'Complete your profile for matches'}
          </p>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-dark-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Applications</span>
            <KanbanSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{applications.length}</div>
          <p className="text-2xs text-indigo-400 mt-1">In active preparation</p>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-dark-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Urgent Deadlines</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{urgentCount}</div>
          <p className="text-2xs text-rose-400 mt-1">Within 30 days</p>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-dark-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Top Destinations</span>
            <GraduationCap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-white truncate">
            {/* Coerce defensively: if the API ever returns the raw JSON string for this
                column, Array.isArray guards against calling .join on a string. */}
            {(Array.isArray(profile?.targetCountries) && profile.targetCountries.length > 0
              ? profile.targetCountries.slice(0, 2).join(', ')
              : null) || 'Not set'}
          </div>
          <p className="text-2xs text-cyan-400 mt-1">{profile?.targetDegreeLevel || 'MASTERS'} Focus</p>
        </div>
      </div>

      {/* Main Grid: Top Recommendations & Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Top Recommended Scholarships (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-400" aria-hidden="true" />
              <span>Recommended Scholarships</span>
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRecalculateAll}
                disabled={recalculating}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${recalculating ? 'animate-spin text-brand-400' : ''}`} />
                <span>{recalculating ? 'Recalculating...' : 'Refresh Matches'}</span>
              </button>

              <Link
                to="/scholarships"
                className="text-xs text-brand-400 font-semibold hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {recommendations.slice(0, 4).map((rec: any) => {
              const status = rec.eligibilityStatus || rec.eligibility || 'POTENTIALLY_ELIGIBLE';
              const score = rec.matchScore ?? rec.matchPercentage ?? 0;
              const matches = rec.matchingCriteria || rec.matchReasons || [];
              const issues = [
                ...(rec.missingCriteria || rec.missingReqs || []),
                ...(rec.uncertainCriteria || rec.concerns || []),
              ];

              return (
                <div
                  key={rec.scholarshipId || rec.id}
                  className="p-5 rounded-2xl glass-card border border-dark-border hover:border-brand-500/40 transition group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedScholarship(rec.scholarship || rec);
                          setSelectedMatch(rec);
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-2xs font-bold border transition flex items-center gap-1 hover:brightness-110 ${
                          status === 'ELIGIBLE'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : status === 'POTENTIALLY_ELIGIBLE'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : status === 'NOT_ELIGIBLE'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-slate-700/40 text-slate-300 border-slate-600/40'
                        }`}
                        title="Click to view full AI eligibility explanation"
                      >
                        <Info className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {score}% • {status.replace(/_/g, ' ')}
                        </span>
                      </button>

                      <span className="text-2xs text-indigo-300 font-medium">
                        {rec.scholarship?.hostCountry || rec.hostCountry}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition line-clamp-1">
                      {rec.scholarship?.title || rec.title}
                    </h3>

                    {/* Quick Match / Issue factors */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-400">
                      {matches.length > 0 && (
                        <span className="flex items-center gap-1 text-emerald-300 truncate max-w-xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{matches[0]}</span>
                        </span>
                      )}
                      {issues.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-300/90 truncate max-w-xs">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">{issues[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScholarship(rec.scholarship || rec);
                        setSelectedMatch(rec);
                      }}
                      className="px-3 py-2 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/60 text-slate-300 hover:text-white text-xs font-semibold transition"
                    >
                      Explain Fit
                    </button>

                    <Link
                      to={`/scholarships/${rec.scholarshipId || rec.id}`}
                      className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Deadlines & Quick Assistants */}
        <div className="space-y-6">
          {/* Upcoming Deadlines Widget */}
          <div className="p-6 rounded-3xl glass-card border border-dark-border space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-400" />
                <span>Upcoming Deadlines</span>
              </h3>
              <div className="flex items-center gap-2">
                <Link
                  to="/deadlines"
                  className="text-xs text-brand-300 hover:text-white font-semibold flex items-center gap-1 transition"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {deadlines.length === 0 ? (
              <div className="p-6 rounded-2xl bg-dark-bg/60 border border-dark-border/60 text-center text-xs text-slate-400 space-y-1">
                <Clock className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <p className="text-white font-semibold">No Active Deadlines</p>
                <p className="text-2xs">Save scholarships to monitor upcoming submission dates.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {deadlines.slice(0, 4).map((d, i) => {
                  const isCritical = d.urgency === 'CRITICAL';
                  const isUrgent = d.urgency === 'URGENT';
                  const isExpired = d.daysRemaining < 0;

                  return (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-dark-card/80 border border-dark-border hover:border-brand-500/40 transition text-xs flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/scholarships/${d.scholarship.id}`}
                            className="font-bold text-white hover:text-cyan-300 transition line-clamp-1 text-xs block"
                          >
                            {d.scholarship.title}
                          </Link>
                          <span className="text-2xs text-slate-400">
                            {d.scholarship.hostCountry} • {d.deadlineFormatted}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-2xs font-extrabold shrink-0 border ${
                            isExpired
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : isCritical
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                : isUrgent
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {isExpired ? 'EXPIRED' : `${d.daysRemaining}d left`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-2xs pt-1.5 border-t border-dark-border/40 text-slate-400">
                        <span className="inline-flex items-center gap-1 font-medium text-indigo-300">
                          Status: <strong className="text-white">{d.status}</strong>
                        </span>
                        <Link
                          to={`/scholarships/${d.scholarship.id}`}
                          className="text-brand-400 hover:text-white font-semibold"
                        >
                          Track →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick AI Shortcuts */}
          <div className="p-6 rounded-3xl glass-card border border-dark-border space-y-3">
            <h3 className="font-bold text-sm text-white mb-2">AI Preparation Tools</h3>
            <Link
              to="/cv-assistant"
              className="flex items-center gap-3 p-3 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/40 text-xs transition"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="font-semibold text-white">Upload & Review CV</div>
                <div className="text-2xs text-slate-400">Europass & Academic format checker</div>
              </div>
            </Link>
            <Link
              to="/sop-assistant"
              className="flex items-center gap-3 p-3 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/40 text-xs transition"
            >
              <BookOpenCheck className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="font-semibold text-white">Statement of Purpose Helper</div>
                <div className="text-2xs text-slate-400">Structure feedback & alignment</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {selectedScholarship && (
        <EligibilityExplanationModal
          scholarship={selectedScholarship}
          initialMatch={selectedMatch}
          isOpen={!!selectedScholarship}
          onClose={() => {
            setSelectedScholarship(null);
            setSelectedMatch(null);
          }}
        />
      )}
    </div>
  );
};
