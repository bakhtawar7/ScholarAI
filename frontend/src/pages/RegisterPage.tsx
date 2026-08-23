import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../services/api';
import { ArrowRight, Lock, Mail, User, Loader2, AlertCircle, Check } from 'lucide-react';
import { AuthHeader } from '../components/common/AuthHeader';

/** Mirrors the backend policy in authValidator.ts so users see failures before submitting. */
const PASSWORD_RULES = [
  { label: 'At least 10 characters', test: (v: string) => v.length >= 10 },
  { label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'A number', test: (v: string) => /[0-9]/.test(v) },
];

export const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const unmetRules = PASSWORD_RULES.filter((r) => !r.test(password));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    else if (fullName.trim().length > 120) errs.fullName = 'Full name is too long';

    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address';

    if (!password) errs.password = 'Password is required';
    else if (unmetRules.length > 0) errs.password = 'Password does not meet all requirements';

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await api.register({
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
      });
      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        // Surface per-field server validation next to the offending input.
        if (err.details?.length) {
          const mapped: Record<string, string> = {};
          err.details.forEach((d) => {
            if (d.field) mapped[d.field] = d.message;
          });
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
        }
        setError(
          err.status === 409
            ? 'An account with this email already exists. Try signing in instead.'
            : err.isRateLimited
              ? 'Too many attempts. Please wait a few minutes and try again.'
              : err.message
        );
      } else {
        setError('Could not create your account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full bg-dark-card border rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 transition ${
      hasError ? 'border-rose-500/60' : 'border-dark-border focus:border-brand-500'
    }`;

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8">
        <AuthHeader title="Create account" subtitle={'Set up your profile to start matching scholarships'} />

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
            <label htmlFor="register-name" className="block text-slate-300 font-semibold mb-1">
              Full name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" aria-hidden="true" />
              <input
                id="register-name"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(fieldErrors.fullName)}
                aria-describedby={fieldErrors.fullName ? 'register-name-error' : undefined}
                placeholder="Alex Vance"
                className={inputClass(Boolean(fieldErrors.fullName))}
              />
            </div>
            {fieldErrors.fullName && (
              <p id="register-name-error" className="text-rose-400 mt-1">
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="register-email" className="block text-slate-300 font-semibold mb-1">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" aria-hidden="true" />
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                placeholder="alex@university.edu"
                className={inputClass(Boolean(fieldErrors.email))}
              />
            </div>
            {fieldErrors.email && (
              <p id="register-email-error" className="text-rose-400 mt-1">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="register-password" className="block text-slate-300 font-semibold mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" aria-hidden="true" />
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby="register-password-rules"
                placeholder="••••••••••"
                className={inputClass(Boolean(fieldErrors.password))}
              />
            </div>

            <ul id="register-password-rules" className="mt-2 space-y-1" aria-live="polite">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-2xs ${met ? 'text-emerald-400' : 'text-slate-500'}`}
                  >
                    {met ? (
                      <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-slate-600 shrink-0" aria-hidden="true" />
                    )}
                    <span>{rule.label}</span>
                    <span className="sr-only">{met ? '(met)' : '(not met)'}</span>
                  </li>
                );
              })}
            </ul>

            {fieldErrors.password && <p className="text-rose-400 mt-1">{fieldErrors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              <>
                Register account
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-dark-border text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link
            to="/auth/login"
            className="text-brand-300 font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
