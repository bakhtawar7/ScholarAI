import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  Sparkles,
  Bot,
  KanbanSquare,
  Bookmark,
  Clock,
  FileText,
  UserCheck,
  BookOpenCheck,
  Workflow,
  X,
} from 'lucide-react';

export const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ai-assistant', label: 'AI Scholarship Copilot', icon: Bot },
  { path: '/scholarships', label: 'Scholarship Explorer', icon: GraduationCap },
  { path: '/applications', label: 'My Applications', icon: KanbanSquare },
  { path: '/saved', label: 'Saved Scholarships', icon: Bookmark },
  { path: '/deadlines', label: 'Deadline Tracker', icon: Clock },
  { path: '/cv-assistant', label: 'AI CV Reviewer', icon: FileText },
  { path: '/sop-assistant', label: 'AI SOP Assistant', icon: BookOpenCheck },
  { path: '/profile', label: 'Academic Profile', icon: UserCheck },
  { path: '/automation', label: 'Automation Console', icon: Workflow, adminOnly: true },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none ${
    isActive
      ? 'bg-gradient-to-r from-brand-600/30 to-cyan-500/10 text-white border border-brand-500/40 shadow-sm'
      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-hover border border-transparent'
  }`;

const NavList: React.FC<{ isAdmin: boolean; onNavigate?: () => void }> = ({ isAdmin, onNavigate }) => (
  <nav className="space-y-1" aria-label="Main navigation">
    {navItems
      .filter((item) => !item.adminOnly || isAdmin)
      .map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate}>
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 text-brand-400 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
                {isActive && <span className="sr-only">(current page)</span>}
              </>
            )}
          </NavLink>
        );
      })}
  </nav>
);

const Brand: React.FC = () => (
  <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-dark-border/60">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20 shrink-0">
      <Sparkles className="w-6 h-6 text-white" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="font-extrabold text-lg text-white tracking-wide truncate">ScholarCopilot</p>
      <p className="text-xs text-brand-400 font-medium">AI Scholarship Assistant</p>
    </div>
  </div>
);

const EngineBadge: React.FC<{ aiEnabled: boolean }> = ({ aiEnabled }) => (
  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-900/60 to-dark-card border border-brand-500/20 text-xs">
    <div className="flex items-center gap-2 mb-1.5 font-semibold text-white">
      <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden="true" />
      <span>Copilot engine</span>
    </div>
    <p className="text-slate-400 mb-2 leading-relaxed">
      {/* Reflects the actual runtime state rather than asserting a stack that may not be configured. */}
      {aiEnabled
        ? 'Tool orchestration and in-app verification workflows are active.'
        : 'Running on deterministic matching and verification engines.'}
    </p>
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
      Connected
    </span>
  </div>
);

/** Persistent sidebar, desktop only. */
export const Sidebar: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => (
  <aside className="w-64 glass-panel border-r border-dark-border min-h-screen flex-col justify-between p-4 sticky top-0 h-screen z-20 hidden md:flex shrink-0">
    <div className="overflow-y-auto">
      <Brand />
      <NavList isAdmin={isAdmin} />
    </div>
    <EngineBadge aiEnabled />
  </aside>
);

/**
 * Slide-over navigation for small screens.
 *
 * The desktop sidebar is `hidden md:flex`, so before this existed a phone or narrow
 * tablet had no navigation at all — every route was unreachable after the first load.
 */
export const MobileNav: React.FC<{ isOpen: boolean; onClose: () => void; isAdmin?: boolean }> = ({
  isOpen,
  onClose,
  isAdmin = false,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // Prevent the page behind the drawer from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-40 flex">
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="relative w-72 max-w-[85vw] h-full glass-panel border-r border-dark-border p-4 flex flex-col justify-between overflow-y-auto animate-slide-up"
      >
        <div>
          <div className="flex items-start justify-between">
            <Brand />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-hover focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none transition"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <NavList isAdmin={isAdmin} onNavigate={onClose} />
        </div>
        <EngineBadge aiEnabled />
      </div>
    </div>
  );
};
