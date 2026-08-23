import React from 'react';
import { AlertTriangle, Check, HelpCircle, Minus, X } from 'lucide-react';
import { MatchingBreakdown } from '../../types';

/**
 * The six-criterion eligibility breakdown, in one place.
 *
 * This markup existed twice — once in EligibilityExplanationModal and once in
 * ScholarshipDetailPage — as two independent sets of six near-identical tiles with their
 * own colour ternaries. The copies had already drifted (one labelled the host-country row
 * "Preferred", the other "Preferred ✓"), and each rendered status as a text glyph appended
 * to the label: 'Matched ✓', 'Below Cutoff ✗', 'Uncertain ⚠'.
 *
 * Those glyphs are read aloud by screen readers as "check mark" / "ballot X" after the
 * label, render inconsistently across platforms, and repeat what the colour already says.
 * Status is now an icon marked aria-hidden, with the outcome stated in the label text.
 */

/**
 * `unknown` is deliberately distinct from `fail`: "this could not be determined" and "you
 * do not meet this" are different answers, and collapsing them would overstate what the
 * evaluation actually established.
 */
export type CriterionStatus = 'pass' | 'warn' | 'fail' | 'neutral' | 'unknown';

const CRITERION_STYLES: Record<CriterionStatus, { text: string; Icon: React.ElementType }> = {
  pass: { text: 'text-emerald-400', Icon: Check },
  warn: { text: 'text-amber-400', Icon: AlertTriangle },
  fail: { text: 'text-rose-400', Icon: X },
  neutral: { text: 'text-slate-300', Icon: Minus },
  unknown: { text: 'text-slate-400', Icon: HelpCircle },
};

export const CriterionTile: React.FC<{
  label: string;
  status: CriterionStatus;
  value: string;
  /** 'stacked' for the narrow six-across grid, 'inline' for the wider modal grid. */
  layout?: 'inline' | 'stacked';
}> = ({ label, status, value, layout = 'inline' }) => {
  const { text, Icon } = CRITERION_STYLES[status];

  if (layout === 'stacked') {
    return (
      <div className="p-3 rounded-xl bg-dark-card border border-dark-border space-y-1">
        <span className="text-2xs text-slate-400 block font-medium">{label}</span>
        <span className={`font-semibold flex items-center gap-1.5 ${text}`}>
          <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{value}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between gap-2">
      <span className="text-slate-400 truncate">{label}</span>
      <span className={`font-semibold flex items-center gap-1.5 shrink-0 ${text}`}>
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{value}</span>
      </span>
    </div>
  );
};

/** Maps one breakdown to the six tiles, so both call sites read identically. */
function tilesFor(b: MatchingBreakdown): Array<{ label: string; status: CriterionStatus; value: string }> {
  return [
    {
      label: 'Degree Level',
      status: b.degreeMatch ? 'pass' : 'fail',
      value: b.degreeMatch ? 'Matched' : 'Mismatch',
    },
    {
      label: 'Field of Study',
      status: b.fieldMatch ? 'pass' : 'warn',
      value: b.fieldMatch ? 'Aligned' : 'Check wording',
    },
    {
      label: 'GPA Threshold',
      status:
        b.gpaMatch === true
          ? 'pass'
          : b.gpaMatch === 'NOT_REQUIRED'
            ? 'neutral'
            : b.gpaMatch === 'UNCERTAIN'
              ? 'unknown'
              : 'fail',
      value:
        b.gpaMatch === true
          ? 'Satisfied'
          : b.gpaMatch === 'NOT_REQUIRED'
            ? 'None stated'
            : b.gpaMatch === 'UNCERTAIN'
              ? 'Not determined'
              : 'Below cutoff',
    },
    {
      label: 'Nationality',
      status:
        b.nationalityMatch === true || b.nationalityMatch === 'ALL_ELIGIBLE'
          ? 'pass'
          : b.nationalityMatch === 'UNCERTAIN'
            ? 'unknown'
            : 'fail',
      value:
        b.nationalityMatch === 'ALL_ELIGIBLE'
          ? 'Open to all'
          : b.nationalityMatch === true
            ? 'Eligible'
            : b.nationalityMatch === 'UNCERTAIN'
              ? 'Not determined'
              : 'Restricted',
    },
    {
      label: 'Language Test',
      status:
        b.languageMatch === true
          ? 'pass'
          : b.languageMatch === 'NOT_SPECIFIED'
            ? 'neutral'
            : b.languageMatch === 'UNCERTAIN'
              ? 'unknown'
              : 'fail',
      value:
        b.languageMatch === true
          ? 'Met'
          : b.languageMatch === 'NOT_SPECIFIED'
            ? 'None stated'
            : b.languageMatch === 'UNCERTAIN'
              ? 'Not determined'
              : 'Below score',
    },
    {
      label: 'Host Country',
      status: b.countryMatch ? 'pass' : 'neutral',
      value: b.countryMatch ? 'On your list' : 'Not on your list',
    },
  ];
}

export const CriteriaBreakdown: React.FC<{
  breakdown: MatchingBreakdown;
  layout?: 'inline' | 'stacked';
  className?: string;
}> = ({ breakdown, layout = 'inline', className = '' }) => (
  <div
    className={`grid gap-2.5 text-xs ${
      layout === 'stacked' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3'
    } ${className}`}
  >
    {tilesFor(breakdown).map((t) => (
      <CriterionTile key={t.label} label={t.label} status={t.status} value={t.value} layout={layout} />
    ))}
  </div>
);
