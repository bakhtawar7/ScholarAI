import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Cpu, FileText } from 'lucide-react';
import { APP_NAME } from '../config/brand';

/**
 * Marketing entry point.
 *
 * Deliberately restrained. The earlier version carried the whole generated-landing-page
 * kit: a pulsing-sparkle "AI-powered …" pill above the headline, a three-stop gradient
 * square holding a Sparkles icon as the logo, gradient-clipped text on the second line of
 * the H1, and a footer crediting the tech stack. Those read as a template rather than a
 * product, so the page now leads with what it does and keeps exactly one accent colour.
 */
export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Top Bar */}
      <header className="px-6 md:px-12 py-5 flex items-center justify-between border-b border-dark-border">
        <div className="flex items-center gap-2.5">
          {/* A flat monogram rather than an icon inside a gradient. */}
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <span className="font-bold text-lg tracking-tight text-white">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/auth/login" className="text-sm font-medium text-slate-300 hover:text-white transition">
            Sign in
          </Link>
          <Link
            to="/auth/register"
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition"
          >
            Create account
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 py-16 md:py-24 space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.15] max-w-3xl">
          Find scholarships you actually qualify for.
        </h1>

        <p className="text-base text-slate-400 max-w-2xl leading-relaxed">
          {APP_NAME} searches official university and government sources, checks each award against your academic
          record, and tells you which requirements you meet — and which you don&apos;t. It tracks your deadlines and
          document checklists from there.
        </p>

        <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
          <Link
            to="/auth/register"
            className="w-full sm:w-auto px-5 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
          >
            <span>Create an account</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            to="/auth/login"
            className="w-full sm:w-auto px-5 py-3 rounded-lg border border-dark-border hover:border-slate-500 text-slate-300 hover:text-white font-medium text-sm text-center transition"
          >
            Sign in
          </Link>
        </div>

        <p className="text-xs text-slate-500 pt-1">
          Eligibility results are advisory estimates. Always confirm requirements on the provider&apos;s official page.
        </p>

        {/* What it does */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-dark-border mt-8">
          <div className="space-y-2.5">
            <Cpu className="w-5 h-5 text-brand-400" aria-hidden="true" />
            <h2 className="font-semibold text-sm text-white">An assistant with database access</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ask it to search, compare awards, save one, or add a deadline, and it performs the action against your own
              records rather than describing how you could.
            </p>
          </div>

          <div className="space-y-2.5">
            <ShieldCheck className="w-5 h-5 text-brand-400" aria-hidden="true" />
            <h2 className="font-semibold text-sm text-white">Eligibility you can audit</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every score shows its working: which criteria matched, which are missing, and which could not be
              determined from the information available.
            </p>
          </div>

          <div className="space-y-2.5">
            <FileText className="w-5 h-5 text-brand-400" aria-hidden="true" />
            <h2 className="font-semibold text-sm text-white">CV and statement review</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload a CV or a statement draft for structural feedback against the requirements of the award you are
              applying for.
            </p>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-slate-500 border-t border-dark-border">
        {APP_NAME} — always verify scholarship details and deadlines with the awarding institution.
      </footer>
    </div>
  );
};
