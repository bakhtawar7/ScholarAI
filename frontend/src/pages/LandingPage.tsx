import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, GraduationCap, ArrowRight, ShieldCheck, Cpu, Clock, Search, FileText } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Top Bar */}
      <header className="px-6 md:px-12 py-5 flex items-center justify-between border-b border-dark-border/60 glass-panel">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">ScholarCopilot</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/auth/login" className="text-xs font-semibold text-slate-300 hover:text-white transition">
            Sign In
          </Link>
          <Link
            to="/auth/register"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-brand-500/25 transition"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-900/60 border border-brand-500/30 text-indigo-300 text-xs font-semibold animate-in fade-in duration-300">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>AI-powered scholarship discovery, matching &amp; verification</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight max-w-4xl mx-auto">
          Discover, Analyze & Secure <br />
          <span className="bg-gradient-to-r from-brand-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
            Fully-Funded International Scholarships
          </span>
        </h1>

        <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          Stop missing deadlines and struggling with complex requirements. AI Scholarship Copilot evaluates your academic profile, predicts your eligibility, reviews your CV & SOP, and manages your application roadmap automatically.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            to="/auth/register"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-brand-500/30 flex items-center justify-center gap-2 transition"
          >
            <span>Start Matching Scholarships</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/auth/login"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-dark-card border border-dark-border hover:bg-dark-hover text-slate-300 hover:text-white font-semibold text-sm transition"
          >
            Sign In with Demo Account
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          <div className="p-6 rounded-3xl glass-card hover:border-brand-500/40 transition">
            <div className="w-10 h-10 rounded-xl bg-brand-900/60 border border-brand-500/30 flex items-center justify-center mb-4">
              <Cpu className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="font-bold text-base text-white mb-2">AI Tool Orchestration</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Our intelligent chatbot doesn't just chat — it queries database records, updates your application tracker, and sets reminders automatically.
            </p>
          </div>

          <div className="p-6 rounded-3xl glass-card hover:border-brand-500/40 transition">
            <div className="w-10 h-10 rounded-xl bg-brand-900/60 border border-brand-500/30 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="font-bold text-base text-white mb-2">Verified Eligibility Scoring</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Get an objective, explainable breakdown comparing your GPA, IELTS, nationality, and degree against official university criteria.
            </p>
          </div>

          <div className="p-6 rounded-3xl glass-card hover:border-brand-500/40 transition">
            <div className="w-10 h-10 rounded-xl bg-brand-900/60 border border-brand-500/30 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-bold text-base text-white mb-2">CV & SOP Document Assistant</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload your resume or statement of purpose draft to receive structured formatting feedback and scholarship-specific suggestions.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-slate-500 border-t border-dark-border">
        AI Scholarship Copilot — Built with React, TypeScript, Express, Prisma and OpenAI.
      </footer>
    </div>
  );
};
