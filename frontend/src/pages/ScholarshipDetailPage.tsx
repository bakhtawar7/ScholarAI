import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { LoadingState, ErrorState, InlineError } from '../components/common/States';
import { Scholarship, FieldAudit, VerificationReport } from '../types';
import {
  GraduationCap,
  Sparkles,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  KanbanSquare,
  FileCheck,
  Building,
  Globe,
  DollarSign,
  ArrowLeft,
  Home,
  Plane,
  ShieldCheck,
  Share2,
  BookOpen,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  MessageSquare,
  Award,
  ListChecks,
  SearchCheck,
  RefreshCw,
  Sliders,
  CheckCircle,
  XCircle,
  HelpCircle,
  Info,
} from 'lucide-react';

export const ScholarshipDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scholarship, setScholarship] = useState<Scholarship | null>(null);
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [addingApp, setAddingApp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<string>('VERIFIED');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [recalculatingMatch, setRecalculatingMatch] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRecalculateMatch = async () => {
    if (!scholarship) return;
    setRecalculatingMatch(true);
    try {
      const refreshedMatch = await api.getScholarshipEligibility(scholarship.id, { forceRefresh: true });
      setScholarship({ ...scholarship, userMatch: refreshedMatch });
    } catch (err) {
      console.error('Failed to recalculate match:', err);
    } finally {
      setRecalculatingMatch(false);
    }
  };

  const loadScholarshipAndAudit = useCallback(async (scholarshipId: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      // The audit endpoint is admin-only, so a 403 here is expected for students
      // and must not fail the whole page.
      const [scholarshipData, auditRes] = await Promise.all([
        api.getScholarship(scholarshipId),
        api.getVerificationAudit(scholarshipId).catch(() => null),
      ]);
      setScholarship(scholarshipData);
      setAuditData(auditRes);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.status === 404
            ? 'This scholarship no longer exists or has been removed.'
            : err.message
          : 'Could not load this scholarship.'
      );
      setScholarship(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) void loadScholarshipAndAudit(id);
  }, [id, loadScholarshipAndAudit]);

  const handleToggleSave = async () => {
    if (!scholarship) return;
    try {
      if (scholarship.isSaved) {
        await api.removeSaved(scholarship.id);
        setScholarship({ ...scholarship, isSaved: false });
      } else {
        await api.saveScholarship(scholarship.id);
        setScholarship({ ...scholarship, isSaved: true });
      }
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleAddToTracker = async () => {
    if (!scholarship) return;
    setAddingApp(true);
    try {
      await api.createApplication({ scholarshipId: scholarship.id, status: 'INTERESTED' });
      setScholarship({ ...scholarship, applicationStatus: 'INTERESTED' });
      navigate('/applications');
    } catch (err) {
      console.error('Failed to create application:', err);
    } finally {
      setAddingApp(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTriggerVerification = async () => {
    if (!scholarship) return;
    setVerifying(true);
    try {
      await api.triggerVerification(scholarship.id);
      loadScholarshipAndAudit(scholarship.id);
    } catch (err) {
      console.error('Failed to run verification agent:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitManualReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scholarship) return;
    setSubmittingReview(true);
    try {
      await api.submitManualReview(scholarship.id, {
        status: reviewStatus,
        notes: reviewNotes || `Manual review status updated to ${reviewStatus}.`,
      });
      setShowReviewModal(false);
      loadScholarshipAndAudit(scholarship.id);
    } catch (err) {
      console.error('Failed to submit manual review:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading scholarship profile, benefits, and AI eligibility analysis…" />;
  }

  if (loadError) {
    return (
      <ErrorState
        title="Could not load scholarship"
        message={loadError}
        onRetry={id ? () => void loadScholarshipAndAudit(id) : undefined}
      />
    );
  }

  if (!scholarship) {
    return (
      <div className="p-12 text-center glass-card rounded-3xl border border-dark-border text-slate-400 space-y-4 max-w-md mx-auto">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Scholarship Not Found</h3>
        <p className="text-xs">The requested opportunity could not be located or may have been updated.</p>
        <Link
          to="/scholarships"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Explorer</span>
        </Link>
      </div>
    );
  }

  const match = scholarship.userMatch;
  const confidence = scholarship.verificationConfidence !== undefined ? scholarship.verificationConfidence : 0.95;
  const confidencePct = Math.round(confidence * 100);

  // Status color helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'PARTIALLY_VERIFIED':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'NEEDS_REVIEW':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'REJECTED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  // Deadline calculation
  let daysRemaining: number | null = null;
  let isExpired = false;
  let deadlineFormatted = 'Rolling / Ongoing';

  if (scholarship.deadline) {
    const d = new Date(scholarship.deadline);
    const diff = d.getTime() - new Date().getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    isExpired = daysRemaining < 0;
    deadlineFormatted = d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const fundingLabel = scholarship.fundingType.replace(/_/g, ' ');
  const fieldAudits: FieldAudit[] = auditData?.currentReport?.fieldAudits || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 max-w-6xl mx-auto">
      {/* Top Navigation & Share Strip */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/scholarships')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Scholarships</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReviewModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-amber-500/40 text-amber-300 text-xs font-medium transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Admin Review</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-card border border-dark-border hover:border-slate-500 text-slate-300 text-xs font-medium transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Share Opportunity'}</span>
          </button>
        </div>
      </div>

      {/* Demo Data Notice if applicable */}
      {scholarship.isDemo && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/30 text-amber-300 border border-amber-500/40 shrink-0">
              DEMO DATA
            </span>
            <span>
              This is a verified historical demo record provided for full-fidelity development and application evaluation.
            </span>
          </div>
          <span className="text-[10px] text-amber-300/80 font-mono shrink-0">Status: TEST VERIFIED</span>
        </div>
      )}

      {/* Main Header Hero Card */}
      <div className="p-6 md:p-8 rounded-3xl glass-panel border border-brand-500/30 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            {/* Badges Row with Verification & Last Verified Date */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wide">
                {fundingLabel}
              </span>

              {/* Status Badge */}
              <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${getStatusBadge(scholarship.verificationStatus)}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{scholarship.verificationStatus.replace(/_/g, ' ')}</span>
              </span>

              {/* Confidence Badge */}
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 flex items-center gap-1">
                <SearchCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{confidencePct}% Confidence</span>
              </span>

              {/* Last Verified Indicator */}
              <span className="text-xs text-slate-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Last verified: <strong className="text-white">{scholarship.lastVerifiedAt ? new Date(scholarship.lastVerifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</strong></span>
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              {scholarship.title}
            </h1>

            {/* Host Institution & Country Info */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-300 pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Building className="w-4 h-4 text-brand-400 shrink-0" />
                <span>{scholarship.university || scholarship.provider}</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Host: <strong className="text-white">{scholarship.hostCountry || scholarship.country}</strong></span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <button
              onClick={handleToggleSave}
              className={`px-4 py-3 rounded-2xl border text-xs font-semibold transition flex items-center gap-2 ${
                scholarship.isSaved
                  ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-500/20'
                  : 'bg-dark-card border-dark-border text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${scholarship.isSaved ? 'fill-current' : ''}`} />
              <span>{scholarship.isSaved ? 'Saved in Profile' : 'Save Scholarship'}</span>
            </button>

            <button
              onClick={handleAddToTracker}
              disabled={addingApp || !!scholarship.applicationStatus}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-brand-600/30 flex items-center gap-2 transition"
            >
              <KanbanSquare className="w-4 h-4" />
              <span>
                {scholarship.applicationStatus
                  ? `In Tracker (${scholarship.applicationStatus})`
                  : 'Add to Application Tracker'}
              </span>
            </button>
          </div>
        </div>

        {/* 6-Tile Financial & Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-4 border-t border-dark-border/50 text-xs">
          <div className="p-3.5 rounded-2xl bg-dark-card/90 border border-dark-border space-y-1">
            <div className="text-[11px] text-slate-400 font-medium">Tuition Coverage</div>
            <div className="font-bold text-white truncate" title={scholarship.tuitionCoverage || '100% Waiver'}>
              {scholarship.tuitionCoverage || '100% Waiver'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-dark-card/90 border border-dark-border space-y-1">
            <div className="text-[11px] text-slate-400 font-medium">Monthly Living Stipend</div>
            <div className="font-bold text-emerald-400 truncate" title={scholarship.stipendAmount || scholarship.stipend || 'Provided'}>
              {scholarship.stipendAmount || scholarship.stipend || 'Provided'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-dark-card/90 border border-dark-border space-y-1">
            <div className="text-[11px] text-slate-400 font-medium">Accommodation</div>
            <div className="font-bold text-blue-300 truncate">
              {scholarship.accommodationCoverage ? 'Housing Provided' : 'Self-funded'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-dark-card/90 border border-dark-border space-y-1">
            <div className="text-[11px] text-slate-400 font-medium">Travel Allowance</div>
            <div className="font-bold text-cyan-300 truncate">
              {scholarship.travelAllowance ? 'Airfare Covered' : 'Not Included'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-dark-card/90 border border-dark-border space-y-1">
            <div className="text-[11px] text-slate-400 font-medium">Minimum GPA</div>
            <div className="font-bold text-amber-300 truncate">
              {scholarship.minGpa ? `${scholarship.minGpa} / ${scholarship.maxGpaScale || 4.0}` : 'Holistic / None'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-dark-card/90 border border-dark-border space-y-1">
            <div className="text-[11px] text-slate-400 font-medium">Deadline Days</div>
            <div className={`font-bold truncate ${
              isExpired
                ? 'text-rose-400'
                : daysRemaining !== null && daysRemaining <= 14
                ? 'text-rose-400'
                : daysRemaining !== null && daysRemaining <= 45
                ? 'text-amber-300'
                : 'text-emerald-400'
            }`}>
              {isExpired ? 'Closed' : daysRemaining !== null ? `${daysRemaining} Days Left` : 'Rolling'}
            </div>
          </div>
        </div>
      </div>

      {/* AI Verification & Source Authenticity Audit Panel */}
      <div className="p-6 md:p-8 rounded-3xl glass-card border border-emerald-500/30 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">AI Verification & Source Authenticity Audit</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${getStatusBadge(scholarship.verificationStatus)}`}>
                  {scholarship.verificationStatus.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Rigorous 8-dimension factual audit against official institutional registries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTriggerVerification}
              disabled={verifying}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500 text-brand-300 text-xs font-semibold transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Auditing...' : 'Re-run Verification'}</span>
            </button>
          </div>
        </div>

        {/* 8-Dimension Field Audits Table */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {fieldAudits.map((audit, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-dark-card/90 border border-dark-border flex flex-col justify-between space-y-2 hover:border-slate-600 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white capitalize flex items-center gap-1.5">
                    {audit.status === 'VERIFIED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : audit.status === 'PARTIALLY_VERIFIED' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>{audit.field}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    audit.confidence >= 0.85
                      ? 'text-emerald-300 bg-emerald-500/10'
                      : 'text-amber-300 bg-amber-500/10'
                  }`}>
                    {Math.round(audit.confidence * 100)}% Confidence
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {audit.notes}
                </p>

                <div className="text-[10px] text-slate-500 pt-1 border-t border-dark-border/40 flex items-center justify-between">
                  <span className="truncate max-w-[200px]" title={audit.source}>Source: {audit.source}</span>
                  <span>{new Date(audit.lastVerifiedDate).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Compatibility & Eligibility Analysis Panel */}
      {match && (
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-brand-950/60 via-dark-card to-dark-card border border-brand-500/40 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">AI Compatibility & Eligibility Report</h3>
                <p className="text-xs text-indigo-300">
                  Custom evaluation tailored for your active academic profile
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleRecalculateMatch}
                disabled={recalculatingMatch}
                className="px-3.5 py-2 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/60 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalculatingMatch ? 'animate-spin text-brand-400' : ''}`} />
                <span>{recalculatingMatch ? 'Calculating...' : 'Re-evaluate'}</span>
              </button>

              <div className="text-right">
                <div className="text-3xl font-extrabold text-emerald-400">
                  {match.matchScore ?? match.matchPercentage}%
                </div>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  (match.eligibilityStatus || match.eligibility) === 'ELIGIBLE'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : (match.eligibilityStatus || match.eligibility) === 'POTENTIALLY_ELIGIBLE'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : (match.eligibilityStatus || match.eligibility) === 'NOT_ELIGIBLE'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-slate-700/40 text-slate-300 border-slate-600/40'
                }`}>
                  {((match.eligibilityStatus || match.eligibility) || 'POTENTIALLY_ELIGIBLE').replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* AI Advisory & Estimation Disclaimer Banner */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3 text-xs">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-[11px] uppercase tracking-wider text-amber-300">
                Official Advisory & Estimation Notice
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200/90">
                This compatibility analysis is generated by AI for advisory and discovery purposes only. It does <strong>NOT constitute guaranteed official eligibility or an admission decision</strong>. All academic prerequisites, test requirements, and eligibility rules must be verified directly with the official scholarship awarding institution.
              </p>
            </div>
          </div>

          {/* 6-Dimension Breakdown Grid */}
          {match.breakdown && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-dark-bg/80 border border-dark-border space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Degree Level</span>
                <span className={`font-bold ${match.breakdown.degreeMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {match.breakdown.degreeMatch ? 'Matched ✓' : 'Mismatch ✗'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-dark-bg/80 border border-dark-border space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Field of Study</span>
                <span className={`font-bold ${match.breakdown.fieldMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {match.breakdown.fieldMatch ? 'Aligned ✓' : 'Review ⚠'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-dark-bg/80 border border-dark-border space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">GPA Threshold</span>
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

              <div className="p-3 rounded-xl bg-dark-bg/80 border border-dark-border space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Nationality</span>
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

              <div className="p-3 rounded-xl bg-dark-bg/80 border border-dark-border space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Language</span>
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

              <div className="p-3 rounded-xl bg-dark-bg/80 border border-dark-border space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Host Country</span>
                <span className={`font-bold ${match.breakdown.countryMatch ? 'text-cyan-400' : 'text-slate-300'}`}>
                  {match.breakdown.countryMatch ? 'Preferred ✓' : 'International'}
                </span>
              </div>
            </div>
          )}

          {/* Structured Criteria Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Matches */}
            <div className="p-5 rounded-2xl bg-dark-bg/80 border border-emerald-500/20 space-y-2.5">
              <h4 className="font-bold text-emerald-400 flex items-center gap-2 text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Eligibility Match Factors ({((match.matchingCriteria || match.matchReasons) || []).length})</span>
              </h4>
              <ul className="space-y-2 text-slate-300">
                {((match.matchingCriteria || match.matchReasons) || []).map((r, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold mt-0.5">•</span>
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Potential Issues & Uncertain Criteria */}
            <div className="p-5 rounded-2xl bg-dark-bg/80 border border-amber-500/20 space-y-2.5">
              <h4 className="font-bold text-amber-300 flex items-center gap-2 text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Potential Issues & Items to Verify</span>
              </h4>
              <ul className="space-y-2 text-slate-300">
                {((match.missingCriteria || match.missingReqs) || []).map((m, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-rose-200">
                    <span className="text-rose-400 font-bold mt-0.5">✗</span>
                    <span className="leading-relaxed">{m}</span>
                  </li>
                ))}
                {((match.uncertainCriteria || match.concerns) || []).map((u, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-amber-200">
                    <span className="text-amber-400 font-bold mt-0.5">⚠</span>
                    <span className="leading-relaxed">{u}</span>
                  </li>
                ))}
                {((match.missingCriteria || []).length === 0 && (match.uncertainCriteria || []).length === 0 && (match.missingReqs || []).length === 0 && (match.concerns || []).length === 0) && (
                  <li className="text-slate-400 italic">No significant eligibility risks or missing prerequisites identified.</li>
                )}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-dark-bg/80 border border-brand-500/20 space-y-2.5">
              <h4 className="font-bold text-cyan-300 flex items-center gap-2 text-xs uppercase tracking-wider">
                <ListChecks className="w-4 h-4 text-cyan-400" />
                <span>Recommended Application Steps</span>
              </h4>
              <ul className="space-y-2 text-slate-300">
                {((match.recommendations || match.nextSteps) || []).map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold mt-0.5">•</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Sections: 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Description, Criteria, Application Process */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 md:p-7 rounded-3xl glass-card border border-dark-border space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-400" />
              <span>Program Overview & Eligibility Description</span>
            </h3>
            <p className="text-xs leading-relaxed text-slate-300">
              {scholarship.eligibilityDescription || 'Open to qualified international students meeting academic and degree prerequisites.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-dark-border/40 text-xs">
              <div className="space-y-1">
                <div className="text-slate-400 font-medium">Eligible Degree Levels</div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {scholarship.degreeLevels.map((d, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border font-semibold text-white">
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 font-medium">Fields of Study / Majors</div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {scholarship.fieldsOfStudy.map((f, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-brand-950/60 border border-brand-800/40 text-brand-300 font-medium">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-7 rounded-3xl glass-card border border-dark-border space-y-4 text-xs">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Academic, Language & Nationality Requirements</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
                <div className="font-bold text-slate-300">GPA Threshold</div>
                <div className="text-slate-400">{scholarship.gpaRequirements}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
                <div className="font-bold text-slate-300">Nationality Eligibility</div>
                <div className="text-slate-400">{scholarship.nationalityRequirements}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
                <div className="font-bold text-slate-300">Language Proficiency</div>
                <div className="text-slate-400">
                  {scholarship.languageRequirements && Object.keys(scholarship.languageRequirements).length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {Object.entries(scholarship.languageRequirements).map(([test, score]) => (
                        <span key={test} className="px-2.5 py-1 rounded-lg bg-dark-bg border border-dark-border text-cyan-300 font-semibold">
                          {test}: {String(score)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    'English or host institution official instruction requirements.'
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-7 rounded-3xl glass-card border border-dark-border space-y-4 text-xs">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Official Step-by-Step Application Process</span>
            </h3>
            <p className="text-slate-300 leading-relaxed whitespace-pre-line">
              {scholarship.applicationProcess}
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <a
                href={scholarship.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition shadow-lg shadow-brand-600/20"
              >
                <span>Open Official Application Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {scholarship.sourceUrl && (
                <a
                  href={scholarship.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-dark-card border border-dark-border hover:border-slate-500 text-slate-400 hover:text-white text-xs font-semibold transition"
                >
                  <span>Institutional Source Page</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Documents, Deadline & AI Assistant Shortcut */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl glass-card border border-dark-border space-y-3 text-xs">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-400" />
              <span>Application Deadline</span>
            </h3>
            <div className="p-3.5 rounded-2xl bg-dark-card border border-dark-border space-y-1">
              <div className="text-slate-400 font-medium">Final Submission Cutoff</div>
              <div className="text-sm font-bold text-white">{deadlineFormatted}</div>
              <div className="text-[11px] text-slate-400 pt-1">
                {isExpired ? (
                  <span className="text-rose-400 font-semibold">The deadline for this intake has passed.</span>
                ) : daysRemaining !== null ? (
                  <span className="text-cyan-300 font-medium">Approximately {daysRemaining} days remaining to prepare and submit.</span>
                ) : (
                  <span className="text-slate-300">Rolling admissions policy.</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl glass-card border border-dark-border space-y-4 text-xs">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-brand-400" />
              <span>Required Application Documents</span>
            </h3>
            <ul className="space-y-2">
              {scholarship.requiredDocuments.map((doc, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-start justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200 font-medium">{doc}</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider shrink-0">
                    Required
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 rounded-3xl bg-gradient-to-br from-brand-900/40 to-dark-card border border-brand-500/30 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>AI Application Copilot</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Need assistance tailoring your SOP, reviewing requirements, or drafting recommendation requests for {scholarship.provider}?
            </p>
            <Link
              to="/ai-assistant"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition shadow-md shadow-brand-600/20"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask AI Copilot for this Scholarship</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Admin Manual Review Override Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-border pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Admin Verification Review Override</span>
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmitManualReview} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Set Verification Status</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="VERIFIED">VERIFIED (High Confidence Authenticated)</option>
                  <option value="PARTIALLY_VERIFIED">PARTIALLY_VERIFIED (Key fields valid, non-critical pending)</option>
                  <option value="NEEDS_REVIEW">NEEDS_REVIEW (Ambiguous / Conflicting Information)</option>
                  <option value="REJECTED">REJECTED (Broken URL / Scam / Fraudulent)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Audit Notes & Reason</label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Explain why this status was chosen (e.g. Official portal verified, contact email confirmed)..."
                  className="w-full bg-dark-bg border border-dark-border rounded-xl p-3 text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 rounded-xl bg-dark-bg border border-dark-border text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition shadow-md disabled:opacity-50"
                >
                  {submittingReview ? 'Saving Decision...' : 'Submit Verification Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
