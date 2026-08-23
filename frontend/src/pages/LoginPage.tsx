import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../services/api';
import { ArrowRight, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { AuthHeader } from '../components/common/AuthHeader';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Password is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await api.login({ email: email.trim().toLowerCase(), password });
      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.isRateLimited
            ? 'Too many sign-in attempts. Please wait a few minutes and try again.'
            : err.message
          : 'Could not sign in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8">
        <AuthHeader title="Welcome back" subtitle={'Sign in to continue'} />

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
            {/* htmlFor/id pairing — previously the labels were not associated with any input,
                so screen readers announced the fields as unlabelled. */}
            <label htmlFor="login-email" className="block text-slate-300 font-semibold mb-1">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" aria-hidden="true" />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                placeholder="you@university.edu"
                className={`w-full bg-dark-card border rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 transition ${
                  fieldErrors.email ? 'border-rose-500/60' : 'border-dark-border focus:border-brand-500'
                }`}
              />
            </div>
            {fieldErrors.email && (
              <p id="login-email-error" className="text-rose-400 mt-1">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label htmlFor="login-password" className="block text-slate-300 font-semibold">
                Password
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-brand-300 hover:underline focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                placeholder="••••••••"
                className={`w-full bg-dark-card border rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 transition ${
                  fieldErrors.password ? 'border-rose-500/60' : 'border-dark-border focus:border-brand-500'
                }`}
              />
            </div>
            {fieldErrors.password && (
              <p id="login-password-error" className="text-rose-400 mt-1">
                {fieldErrors.password}
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
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-dark-border text-center text-xs text-slate-400">
          Don&apos;t have an account?{' '}
          <Link
            to="/auth/register"
            className="text-brand-300 font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
          >
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};
