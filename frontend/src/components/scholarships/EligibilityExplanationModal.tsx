import React, { useState } from 'react';
import { Scholarship, ScholarshipMatch } from '../../types';
import { api } from '../../services/api';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  X,
  Building,
  Globe,
  GraduationCap,
  Award,
  BookOpen,
  Info,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRight,
  ListChecks,
} from 'lucide-react';

interface EligibilityExplanationModalProps {
  scholarship: Scholarship;
  initialMatch?: ScholarshipMatch | null;
  isOpen: boolean;
  onClose: () => void;
  onMatchUpdated?: (updatedMatch: ScholarshipMatch) => void;
}

export const EligibilityExplanationModal: React.FC<EligibilityExplanationModalProps> = ({
  scholarship,
  initialMatch,
  isOpen,
  onClose,
  onMatchUpdated,
}) => {
  const [match, setMatch] = useState<ScholarshipMatch | null>(
    initialMatch || scholarship.userMatch || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRecalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const refreshed = await api.getScholarshipEligibility(scholarship.id, { forceRefresh: true });
      setMatch(refreshed);
      if (onMatchUpdated) {
        onMatchUpdated(refreshed);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh eligibility analysis.');
    } finally {
      setLoading(false);
    }
  };

  const score = match?.matchScore ?? match?.matchPercentage ?? 0;
  const status = match?.eligibilityStatus ?? match?.eligibility ?? 'POTENTIALLY_ELIGIBLE';

  const matchingCriteria = match?.matchingCriteria?.length ? match.matchingCriteria : (match?.matchReasons || []);
  const missingCriteria = match?.missingCriteria?.length ? match.missingCriteria : (match?.missingReqs || []);
  const uncertainCriteria = match?.uncertainCriteria?.length ? match.uncertainCriteria : (match?.concerns || []);
  const warnings = match?.warnings?.length ? match.warnings : [];
  const recommendations = match?.recommendations?.length ? match.recommendations : (match?.nextSteps || []);

  const getStatusBadgeConfig = (st: string) => {
    switch (st) {
      case 'ELIGIBLE':
        return {
          label: 'Eligible Match',
          desc: 'Your profile satisfies the core degree, academic, field, and nationality criteria.',
          classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: CheckCircle2,
          color: 'text-emerald-400',
        };
      case 'POTENTIALLY_ELIGIBLE':
        return {
          label: 'Potentially Eligible',
          desc: 'Primary major and degree match, but certain requirements (e.g. English test, GPA) require verification.',
          classes: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: AlertTriangle,
          color: 'text-amber-400',
        };
      case 'NOT_ELIGIBLE':
        return {
          label: 'Not Eligible',
          desc: 'One or more required criteria (such as degree level, nationality restriction, or GPA threshold) do not match.',
          classes: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: XCircle,
          color: 'text-rose-400',
        };
      case 'INSUFFICIENT_INFORMATION':
      default:
        return {
          label: 'Information Incomplete',
          desc: 'Key fields in your academic profile (e.g. target degree, major, GPA) are missing.',
          classes: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
          icon: HelpCircle,
          color: 'text-slate-400',
        };
    }
  };

  const statusConfig = getStatusBadgeConfig(status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-dark-bg/95 border border-brand-500/40 rounded-3xl shadow-2xl shadow-brand-500/10 flex flex-col overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div className={`h-1.5 w-full ${
          status === 'ELIGIBLE'
            ? 'bg-gradient-to-r from-emerald-500 via-brand-500 to-cyan-400'
            : status === 'POTENTIALLY_ELIGIBLE'
            ? 'bg-gradient-to-r from-amber-500 via-brand-500 to-indigo-500'
            : 'bg-gradient-to-r from-rose-500 to-slate-600'
        }`} />

        {/* Modal Header */}
        <div className="p-6 border-b border-dark-border/80 flex items-start justify-between gap-4 bg-dark-card/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-extrabold text-white">AI Eligibility & Compatibility Breakdown</h2>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-xl">
              {scholarship.title} • <span className="text-slate-300">{scholarship.university || scholarship.provider}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecalculate}
              disabled={loading}
              title="Recalculate eligibility with latest profile data"
              className="px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/60 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
              <span>{loading ? 'Evaluating...' : 'Re-evaluate'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-dark-card border border-dark-border text-slate-400 hover:text-white hover:border-slate-500 transition"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs custom-scrollbar">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* AI Disclaimer Notice - MANDATORY REQUIREMENT */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3 shadow-inner">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-[11px] uppercase tracking-wider text-amber-300">
                Official Advisory & Estimation Notice
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200/90">
                This compatibility analysis is generated by AI for advisory and discovery planning purposes only. It does <strong>NOT constitute a guaranteed official admission or eligibility determination</strong>. Official requirements and prerequisites must be verified directly with the scholarship provider or university portal.
              </p>
            </div>
          </div>

          {/* Score & Status Hero Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-dark-card via-dark-card/90 to-dark-bg border border-dark-border flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-dark-border flex flex-col items-center justify-center bg-dark-bg/80 shadow-lg">
                  <span className="text-2xl font-black text-white">{score}%</span>
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Match</span>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 border ${statusConfig.classes}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{statusConfig.label}</span>
                  </span>
                  {match?.isCached && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700" title="Retrieved from fast cached database analysis">
                      Cached
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                  {statusConfig.desc}
                </p>
              </div>
            </div>

            {match?.calculatedAt && (
              <div className="text-[10px] text-slate-400 text-right shrink-0">
                <div>Evaluated on:</div>
                <div className="font-semibold text-slate-300">
                  {new Date(match.calculatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 6-Point Criteria Breakdown Tiles */}
          {match?.breakdown && (
            <div className="space-y-2">
              <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                <span>Eligibility Criteria Breakdown</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                  <span className="text-slate-400">Degree Level</span>
                  <span className={`font-bold ${match.breakdown.degreeMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {match.breakdown.degreeMatch ? 'Matched ✓' : 'Mismatch ✗'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                  <span className="text-slate-400">Field of Study</span>
                  <span className={`font-bold ${match.breakdown.fieldMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {match.breakdown.fieldMatch ? 'Aligned ✓' : 'Review ⚠'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                  <span className="text-slate-400">GPA Threshold</span>
                  <span className={`font-bold ${
                    match.breakdown.gpaMatch === true
                      ? 'text-emerald-400'
                      : match.breakdown.gpaMatch === 'NOT_REQUIRED'
                      ? 'text-cyan-400'
                      : match.breakdown.gpaMatch === 'UNCERTAIN'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    {match.breakdown.gpaMatch === true
                      ? 'Satisfied ✓'
                      : match.breakdown.gpaMatch === 'NOT_REQUIRED'
                      ? 'Holistic / None'
                      : match.breakdown.gpaMatch === 'UNCERTAIN'
                      ? 'Uncertain ⚠'
                      : 'Below Cutoff ✗'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                  <span className="text-slate-400">Nationality</span>
                  <span className={`font-bold ${
                    match.breakdown.nationalityMatch === true || match.breakdown.nationalityMatch === 'ALL_ELIGIBLE'
                      ? 'text-emerald-400'
                      : match.breakdown.nationalityMatch === 'UNCERTAIN'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    {match.breakdown.nationalityMatch === 'ALL_ELIGIBLE'
                      ? 'Global / All ✓'
                      : match.breakdown.nationalityMatch === true
                      ? 'Eligible ✓'
                      : match.breakdown.nationalityMatch === 'UNCERTAIN'
                      ? 'Unspecified ⚠'
                      : 'Restricted ✗'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                  <span className="text-slate-400">Language Test</span>
                  <span className={`font-bold ${
                    match.breakdown.languageMatch === true
                      ? 'text-emerald-400'
                      : match.breakdown.languageMatch === 'NOT_SPECIFIED'
                      ? 'text-slate-300'
                      : match.breakdown.languageMatch === 'UNCERTAIN'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    {match.breakdown.languageMatch === true
                      ? 'Met ✓'
                      : match.breakdown.languageMatch === 'NOT_SPECIFIED'
                      ? 'Standard'
                      : match.breakdown.languageMatch === 'UNCERTAIN'
                      ? 'Verify ⚠'
                      : 'Below Score ✗'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between">
                  <span className="text-slate-400">Host Country</span>
                  <span className={`font-bold ${match.breakdown.countryMatch ? 'text-cyan-400' : 'text-slate-300'}`}>
                    {match.breakdown.countryMatch ? 'Preferred ✓' : 'International'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Matches Section */}
          {matchingCriteria.length > 0 && (
            <div className="p-4 rounded-2xl bg-dark-card/90 border border-emerald-500/30 space-y-2.5">
              <h3 className="font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Confirmed Matching Factors ({matchingCriteria.length})</span>
              </h3>
              <ul className="space-y-1.5">
                {matchingCriteria.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing Criteria Section (Hard Issues) */}
          {missingCriteria.length > 0 && (
            <div className="p-4 rounded-2xl bg-dark-card/90 border border-rose-500/30 space-y-2.5">
              <h3 className="font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wider text-[11px]">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Eligibility Disqualifiers / Mismatches ({missingCriteria.length})</span>
              </h3>
              <ul className="space-y-1.5">
                {missingCriteria.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-rose-200">
                    <span className="text-rose-400 font-bold mt-0.5">✗</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Uncertain Criteria (Verification Needed) */}
          {uncertainCriteria.length > 0 && (
            <div className="p-4 rounded-2xl bg-dark-card/90 border border-amber-500/30 space-y-2.5">
              <h3 className="font-bold text-amber-300 flex items-center gap-2 uppercase tracking-wider text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Potential Issues / Verification Needed ({uncertainCriteria.length})</span>
              </h3>
              <ul className="space-y-1.5">
                {uncertainCriteria.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-amber-100">
                    <span className="text-amber-400 font-bold mt-0.5">⚠</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Time Warnings */}
          {warnings.length > 1 && (
            <div className="p-4 rounded-2xl bg-dark-card border border-dark-border space-y-2 text-slate-300">
              <h3 className="font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider text-[11px]">
                <Clock className="w-4 h-4 text-rose-400" />
                <span>Application Deadlines & Timing Alerts</span>
              </h3>
              <ul className="space-y-1">
                {warnings.filter((w) => !w.toLowerCase().includes('ai estimate')).map((warn, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span className="leading-relaxed">{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations Section */}
          {recommendations.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-950/60 to-dark-card border border-brand-500/30 space-y-2.5">
              <h3 className="font-bold text-cyan-300 flex items-center gap-2 uppercase tracking-wider text-[11px]">
                <ListChecks className="w-4 h-4 text-cyan-400" />
                <span>Actionable Recommendations & Next Steps</span>
              </h3>
              <ul className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-dark-border/80 bg-dark-card/80 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400">
            Based on student profile parameters and scholarship requirements.
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-md shadow-brand-600/20 transition"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
