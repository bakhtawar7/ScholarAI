import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { ArrowRight, Mail, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthHeader } from '../components/common/AuthHeader';

/**
 * Step one of password recovery.
 *
 * The success state is shown for any well-formed address, including one with no account.
 * That is deliberate: a "no such user" message here would let anyone test whether an
 * address is registered, and the API is built to answer identically either way.
 */
export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError('Enter a valid email address');
      return;
    }
    setFieldError('');

    setLoading(true);
    try {
      await api.forgotPassword(trimmed.toLowerCase());
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.isRateLimited
            ? 'Too many reset requests. Please wait a few minutes and try again.'
            : err.message
          : 'Could not send the reset link. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8">
        <AuthHeader
          title="Reset your password"
          subtitle={
            submitted ? 'Check your inbox for the next step' : 'Enter your email and we will send you a reset link'
          }
        />

        {submitted ? (
          <>
            <div
              role="status"
              className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs mb-4"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                If an account exists for <strong>{email.trim().toLowerCase()}</strong>, a password reset link is on its
                way. The link expires in one hour.
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Nothing arrived? Check your spam folder, confirm the address is the one you registered with, then request
              another link.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-4 w-full py-2.5 rounded-xl border border-dark-border text-slate-300 text-xs font-semibold hover:border-brand-500/50 hover:text-white transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
            >
              Use a different address
            </button>
          </>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mb-4"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
              <div>
                <label htmlFor="forgot-email" className="block text-slate-300 font-semibold mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="forgot-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? 'forgot-email-error' : undefined}
                    placeholder="you@university.edu"
                    className={`w-full bg-dark-card border rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 transition ${
                      fieldError ? 'border-rose-500/60' : 'border-dark-border focus:border-brand-500'
                    }`}
                  />
                </div>
                {fieldError && (
                  <p id="forgot-email-error" className="text-rose-400 mt-1">
                    {fieldError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Sending link…
                  </>
                ) : (
                  <>
                    Send reset link
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-dark-border text-center text-xs text-slate-400">
          Remembered it?{' '}
          <Link
            to="/auth/login"
            className="text-brand-300 font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
