import React from 'react';
import { AlertCircle, Inbox, RefreshCw, Loader2 } from 'lucide-react';

/**
 * Shared loading / empty / error presentational states.
 *
 * Six pages previously swallowed fetch failures into console.error and then rendered
 * their "no results" empty state, which told the user their data did not exist when
 * in fact the request had failed. These components make the three states distinct.
 */

export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = 'Loading…',
  className = '',
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center gap-3 py-20 text-slate-400 ${className}`}
  >
    <Loader2 className="w-6 h-6 animate-spin text-brand-400" aria-hidden="true" />
    <span className="text-xs font-medium text-center max-w-sm">{message}</span>
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = 'Something went wrong', message, onRetry, className = '' }) => (
  <div
    role="alert"
    className={`p-8 text-center glass-card rounded-3xl border border-rose-500/30 space-y-4 max-w-lg mx-auto ${className}`}
  >
    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
      <AlertCircle className="w-6 h-6" aria-hidden="true" />
    </div>
    <div className="space-y-1">
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        {message || 'The request could not be completed. Please try again.'}
      </p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none text-white text-xs font-semibold shadow-md transition"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Try again
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, message, action, className = '' }) => (
  <div
    className={`p-12 text-center glass-card rounded-3xl border border-dark-border text-slate-400 space-y-4 max-w-lg mx-auto ${className}`}
  >
    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mx-auto text-brand-300">
      {icon || <Inbox className="w-6 h-6" aria-hidden="true" />}
    </div>
    <div className="space-y-1">
      <h3 className="text-base font-bold text-white">{title}</h3>
      {message && <p className="text-xs text-slate-400 leading-relaxed">{message}</p>}
    </div>
    {action}
  </div>
);

/** Inline banner for non-blocking errors that sit above already-rendered content. */
export const InlineError: React.FC<{ message: string; onDismiss?: () => void; className?: string }> = ({
  message,
  onDismiss,
  className = '',
}) => (
  <div
    role="alert"
    className={`flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs ${className}`}
  >
    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
    <span className="flex-1 leading-relaxed">{message}</span>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-rose-400 hover:text-rose-200 font-bold px-1 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none rounded"
      >
        ×
      </button>
    )}
  </div>
);

/** Shimmer placeholder used while card grids load. */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-5 rounded-2xl glass-card border border-dark-border animate-pulse ${className}`} aria-hidden="true">
    <div className="h-4 w-2/3 bg-dark-hover rounded mb-3" />
    <div className="h-3 w-1/2 bg-dark-hover rounded mb-4" />
    <div className="space-y-2">
      <div className="h-2.5 w-full bg-dark-hover rounded" />
      <div className="h-2.5 w-5/6 bg-dark-hover rounded" />
      <div className="h-2.5 w-4/6 bg-dark-hover rounded" />
    </div>
  </div>
);
