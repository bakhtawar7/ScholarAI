import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import { ArrowRight, Lock, Loader2, AlertCircle, CheckCircle2, Check, X } from 'lucide-react';
import { AuthHeader } from '../components/common/AuthHeader';

/**
 * Password policy, mirrored from the server's Zod schema (authValidator.ts).
 *
 * Shown live so a rejection is not the user's first sight of the rules. The server
 * remains the authority — this is guidance, not enforcement.
 */
const RULES: Array<{ label: string; test: (v: string) => boolean }> = [
  { label: 'At least 10 characters', test: (v) => v.length >= 10 },
  { label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'A number', test: (v) => /[0-9]/.test(v) },
];

/** Step two of password recovery: consume the emailed token and set a new password. */
export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const ruleState = useMemo(() => RULES.map((r) => ({ ...r, met: r.test(password) })), [password]);
  const allRulesMet = ruleState.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const errs: Record<string, string> = {};
    if (!allRulesMet) errs.password = 'Your password does not meet all the requirements yet';
    if (password !== confirm) errs.confirm = 'The two passwords do not match';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      // Brief pause so the confirmation is actually readable before the redirect.
      setTimeout(() => navigate('/auth/login', { replace: true }), 2500);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.isRateLimited
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : err.message
          : 'Could not reset your password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // A link that arrived without a token cannot be recovered from — say so immediately
  // rather than letting the user type a password that is guaranteed to be rejected.
  if (!token) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md glass-panel border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" aria-hidden="true" />
          <h1 className="text-xl font-bold text-white mb-2">This reset link is incomplete</h1>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            The link is missing its token. Email clients sometimes split long links across lines — try copying the whole
            link, or request a fresh one.
          </p>
          <Link
            to="/auth/forgot-password"
            className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-600 text-white font-bold text-xs focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none"
          >
            Request a new link
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8">
        <AuthHeader title="Choose a new password" subtitle={'This also signs you out on every other device'} />

        {done ? (
          <div
            role="status"
            className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>Your password has been reset. Taking you to the sign-in page…</span>
          </div>
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
                <label htmlFor="reset-password" className="block text-slate-300 font-semibold mb-1">
                  New password
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="reset-password"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby="reset-password-rules"
                    placeholder="••••••••••"
                    className={`w-full bg-dark-card border rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 transition ${
                      fieldErrors.password ? 'border-rose-500/60' : 'border-dark-border focus:border-brand-500'
                    }`}
                  />
                </div>

                <ul id="reset-password-rules" className="mt-2 space-y-1">
                  {ruleState.map((r) => (
                    <li
                      key={r.label}
                      className={`flex items-center gap-1.5 ${r.met ? 'text-emerald-400' : 'text-slate-500'}`}
                    >
                      {r.met ? (
                        <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
                      ) : (
                        <X className="w-3 h-3 shrink-0" aria-hidden="true" />
                      )}
                      <span>{r.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label htmlFor="reset-confirm" className="block text-slate-300 font-semibold mb-1">
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="reset-confirm"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.confirm)}
                    aria-describedby={fieldErrors.confirm ? 'reset-confirm-error' : undefined}
                    placeholder="••••••••••"
                    className={`w-full bg-dark-card border rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 transition ${
                      fieldErrors.confirm ? 'border-rose-500/60' : 'border-dark-border focus:border-brand-500'
                    }`}
                  />
                </div>
                {fieldErrors.confirm && (
                  <p id="reset-confirm-error" className="text-rose-400 mt-1">
                    {fieldErrors.confirm}
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
                    Saving…
                  </>
                ) : (
                  <>
                    Set new password
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-dark-border text-center text-xs text-slate-400">
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
