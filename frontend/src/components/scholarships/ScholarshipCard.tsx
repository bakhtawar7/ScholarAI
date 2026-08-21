import React from 'react';
import { Link } from 'react-router-dom';
import { Scholarship, ScholarshipMatch } from '../../types';
import { EligibilityExplanationModal } from './EligibilityExplanationModal';
import {
  GraduationCap,
  Bookmark,
  CheckCircle2,
  Clock,
  Building,
  Globe,
  DollarSign,
  Home,
  Plane,
  FileText,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface ScholarshipCardProps {
  scholarship: Scholarship;
  onToggleSave: (e: React.MouseEvent, s: Scholarship) => void;
  isSaving?: boolean;
}

export const ScholarshipCard: React.FC<ScholarshipCardProps> = ({
  scholarship: s,
  onToggleSave,
  isSaving = false,
}) => {
  const [modalOpen, setModalOpen] = React.useState(false);
  const match = s.userMatch;
  const matchScore = match?.matchScore ?? match?.matchPercentage;
  const eligibilityStatus = match?.eligibilityStatus ?? match?.eligibility ?? 'POTENTIALLY_ELIGIBLE';

  // Format eligibility badge
  const getEligibilityBadgeStyle = (status: string, scoreVal?: number) => {
    switch (status) {
      case 'ELIGIBLE':
        return {
          label: `${scoreVal || 90}% • Eligible`,
          classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30',
          icon: CheckCircle2,
        };
      case 'POTENTIALLY_ELIGIBLE':
        return {
          label: `${scoreVal || 70}% • Potential`,
          classes: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30',
          icon: AlertTriangle,
        };
      case 'NOT_ELIGIBLE':
        return {
          label: `${scoreVal || 40}% • Ineligible`,
          classes: 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30',
          icon: AlertCircle,
        };
      case 'INSUFFICIENT_INFORMATION':
      default:
        return {
          label: 'Info Needed',
          classes: 'bg-slate-700/40 text-slate-300 border-slate-600/40 hover:bg-slate-700/60',
          icon: Sparkles,
        };
    }
  };

  const matchBadge = matchScore !== undefined && matchScore !== null ? getEligibilityBadgeStyle(eligibilityStatus, matchScore) : null;
  const MatchBadgeIcon = matchBadge?.icon || Sparkles;

  // Deadline calculation
  let daysRemaining: number | null = null;
  let isExpired = false;
  let deadlineDisplay = 'Rolling / Ongoing';

  if (s.deadline) {
    const d = new Date(s.deadline);
    const diff = d.getTime() - new Date().getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    isExpired = daysRemaining < 0;
    deadlineDisplay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Format funding label
  const fundingLabel = s.fundingType.replace(/_/g, ' ');

  // Status color helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'PARTIALLY_VERIFIED':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'NEEDS_REVIEW':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'REJECTED':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-700/30 text-slate-300 border-slate-600/30';
    }
  };

  return (
    <div className="group relative rounded-2xl glass-card border border-dark-border hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 flex flex-col justify-between overflow-hidden bg-gradient-to-b from-dark-card/90 to-dark-bg/95">
      {/* Top Accent Line */}
      <div className={`h-1 w-full transition-all duration-300 ${
        matchScore && matchScore >= 85
          ? 'bg-gradient-to-r from-emerald-500 via-brand-500 to-cyan-500'
          : 'bg-gradient-to-r from-brand-600/50 to-indigo-600/50 group-hover:from-brand-500 group-hover:to-cyan-400'
      }`} />

      <div className="p-5 space-y-4">
        {/* Header Badges & Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Demo Data Tag */}
            {s.isDemo && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm" title="Demonstration & testing record">
                DEMO DATA
              </span>
            )}

            {/* Verification Status Badge */}
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border ${getStatusBadge(s.verificationStatus || 'VERIFIED')}`}>
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{(s.verificationStatus || 'VERIFIED').replace(/_/g, ' ')}</span>
            </span>

            {/* AI Match & Eligibility Badge */}
            {matchBadge && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setModalOpen(true);
                }}
                title="Click to view full AI eligibility breakdown & analysis"
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer shadow-sm ${matchBadge.classes}`}
              >
                <MatchBadgeIcon className="w-3 h-3 shrink-0" />
                <span>{matchBadge.label}</span>
              </button>
            )}

            {/* Application status badge if tracked */}
            {s.applicationStatus && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Status: {s.applicationStatus}
              </span>
            )}
          </div>

          {/* Bookmark Button */}
          <button
            onClick={(e) => onToggleSave(e, s)}
            disabled={isSaving}
            aria-label={s.isSaved ? 'Remove from saved' : 'Save scholarship'}
            title={s.isSaved ? 'Saved to your list' : 'Bookmark this opportunity'}
            className={`p-2 rounded-xl border transition-all duration-200 shrink-0 ${
              s.isSaved
                ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-500/30'
                : 'bg-dark-card/80 border-dark-border text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${s.isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Title & Organization */}
        <div className="space-y-1.5">
          <Link
            to={`/scholarships/${s.id}`}
            className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug"
          >
            {s.title}
          </Link>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-300 font-medium truncate max-w-[240px]">
              <Building className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span className="truncate">{s.university || s.provider}</span>
            </span>

            <span className="flex items-center gap-1 text-slate-400 shrink-0">
              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{s.hostCountry || s.country}</span>
            </span>
          </div>
        </div>

        {/* Financial & Benefits Coverage Badges */}
        <div className="p-3 rounded-xl bg-dark-bg/70 border border-dark-border/60 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
              {fundingLabel}
            </span>
            <span className="font-semibold text-emerald-400 text-[11px] truncate max-w-[170px]" title={s.tuitionCoverage || 'Full Tuition Exemption'}>
              {s.tuitionCoverage || '100% Tuition Waiver'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-dark-border/40 text-[11px] text-slate-300">
            {s.stipendAmount && (
              <span className="px-2 py-0.5 rounded bg-dark-card border border-dark-border flex items-center gap-1 text-emerald-300">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[140px]">{s.stipendAmount}</span>
              </span>
            )}

            {s.accommodationCoverage && (
              <span className="px-2 py-0.5 rounded bg-dark-card border border-dark-border flex items-center gap-1 text-blue-300">
                <Home className="w-3 h-3 text-blue-400" />
                <span>Housing</span>
              </span>
            )}

            {s.travelAllowance && (
              <span className="px-2 py-0.5 rounded bg-dark-card border border-dark-border flex items-center gap-1 text-cyan-300">
                <Plane className="w-3 h-3 text-cyan-400" />
                <span>Airfare</span>
              </span>
            )}
          </div>
        </div>

        {/* Degree Levels & Fields Tags */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {s.degreeLevels?.slice(0, 3).map((deg, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60"
              >
                {deg}
              </span>
            ))}
            {s.fieldsOfStudy?.slice(0, 2).map((field, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-brand-950/60 text-brand-300 border border-brand-800/40 truncate max-w-[130px]"
                title={field}
              >
                {field}
              </span>
            ))}
            {(s.fieldsOfStudy?.length || 0) > 2 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-500">
                +{(s.fieldsOfStudy?.length || 0) - 2} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Details & Action Strip */}
      <div className="px-5 py-3.5 bg-dark-card/90 border-t border-dark-border/60 flex items-center justify-between gap-3 text-xs">
        {/* Deadline Indicator */}
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400 font-medium">Application Deadline</div>
          <div className="flex items-center gap-1.5 font-bold">
            <Clock className={`w-3.5 h-3.5 ${
              isExpired
                ? 'text-rose-500'
                : daysRemaining !== null && daysRemaining <= 14
                ? 'text-rose-400 animate-pulse'
                : daysRemaining !== null && daysRemaining <= 45
                ? 'text-amber-400'
                : 'text-cyan-400'
            }`} />
            <span className={
              isExpired
                ? 'text-rose-400 line-through'
                : daysRemaining !== null && daysRemaining <= 14
                ? 'text-rose-400 font-bold'
                : daysRemaining !== null && daysRemaining <= 45
                ? 'text-amber-300'
                : 'text-slate-200'
            }>
              {deadlineDisplay}
            </span>
            {daysRemaining !== null && !isExpired && (
              <span className="text-[10px] font-normal text-slate-400">
                ({daysRemaining}d left)
              </span>
            )}
          </div>
        </div>

        {/* View Details Link */}
        <Link
          to={`/scholarships/${s.id}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-md shadow-brand-600/20 transition group-hover:translate-x-0.5 duration-200 shrink-0"
        >
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {modalOpen && (
        <EligibilityExplanationModal
          scholarship={s}
          initialMatch={match}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};
