import React, { useState } from 'react';
import { Scholarship, ScholarshipMatch } from '../../types';
import { EligibilityExplanationModal } from './EligibilityExplanationModal';
import { AlertTriangle, CheckCircle2, ChevronRight, HelpCircle, Info, XCircle } from 'lucide-react';

interface MatchCardProps {
  scholarship: Scholarship;
  match?: ScholarshipMatch | null;
  onMatchUpdated?: (updatedMatch: ScholarshipMatch) => void;
  className?: string;
  showDetailsButton?: boolean;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  scholarship,
  match: propMatch,
  onMatchUpdated,
  className = '',
  showDetailsButton = true,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const match = propMatch || scholarship.userMatch;

  if (!match) return null;

  const score = match.matchScore ?? match.matchPercentage ?? 0;
  const status = match.eligibilityStatus ?? match.eligibility ?? 'POTENTIALLY_ELIGIBLE';

  const matchingCriteria = match.matchingCriteria?.length ? match.matchingCriteria : match.matchReasons || [];
  const missingCriteria = match.missingCriteria?.length ? match.missingCriteria : match.missingReqs || [];
  const uncertainCriteria = match.uncertainCriteria?.length ? match.uncertainCriteria : match.concerns || [];

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'ELIGIBLE':
        return {
          label: 'Eligible Match',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: CheckCircle2,
          scoreColor: 'text-emerald-400',
        };
      case 'POTENTIALLY_ELIGIBLE':
        return {
          label: 'Potentially Eligible',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: AlertTriangle,
          scoreColor: 'text-amber-400',
        };
      case 'NOT_ELIGIBLE':
        return {
          label: 'Not Eligible',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: XCircle,
          scoreColor: 'text-rose-400',
        };
      case 'INSUFFICIENT_INFORMATION':
      default:
        return {
          label: 'Info Incomplete',
          badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
          icon: HelpCircle,
          scoreColor: 'text-slate-400',
        };
    }
  };

  const statusConfig = getStatusBadge(status);
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <div
        className={`p-4 rounded-2xl bg-dark-card/90 border border-brand-500/30 hover:border-brand-500/60 transition shadow-lg space-y-3 ${className}`}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-lg text-2xs font-bold flex items-center gap-1.5 border ${statusConfig.badgeClass}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{statusConfig.label}</span>
            </span>

            <span className="text-2xs text-slate-400 font-mono">AI Assessment</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-base font-black ${statusConfig.scoreColor}`}>{score}%</span>
            <span className="text-2xs text-slate-400 font-medium">Match</span>
          </div>
        </div>

        {/* Quick Highlights Summary */}
        <div className="space-y-1.5 text-xs">
          {matchingCriteria.slice(0, 2).map((item, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-slate-300 text-2xs">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
              <span className="truncate">{item}</span>
            </div>
          ))}

          {uncertainCriteria.slice(0, 1).map((item, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-amber-200/90 text-2xs">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <span className="truncate">{item}</span>
            </div>
          ))}

          {missingCriteria.slice(0, 1).map((item, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-rose-200/90 text-2xs">
              <XCircle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
              <span className="truncate">{item}</span>
            </div>
          ))}
        </div>

        {/* Explain CTA */}
        {showDetailsButton && (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full py-2 px-3 rounded-xl bg-dark-bg border border-dark-border hover:border-brand-500/50 hover:bg-brand-500/10 text-brand-300 font-semibold text-xs transition flex items-center justify-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Explain Match & View Breakdown</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      <EligibilityExplanationModal
        scholarship={scholarship}
        initialMatch={match}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onMatchUpdated={(updated) => {
          if (onMatchUpdated) onMatchUpdated(updated);
        }}
      />
    </>
  );
};
