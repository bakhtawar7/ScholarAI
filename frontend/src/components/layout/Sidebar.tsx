import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
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
import { APP_NAME, APP_TAGLINE_SHORT } from '../../config/brand';

export const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ai-assistant', label: 'Assistant', icon: Bot },
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
  <div className="flex items-center gap-2.5 px-2 py-3 mb-6 border-b border-dark-border">
    {/* Flat monogram, matching the landing header. */}
    <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
      <span className="text-base font-bold text-white">S</span>
    </div>
    <div className="min-w-0">
      <p className="font-bold text-base text-white tracking-tight truncate">{APP_NAME}</p>
      <p className="text-2xs text-slate-400 truncate">{APP_TAGLINE_SHORT}</p>
    </div>
  </div>
);

const EngineBadge: React.FC<{ aiEnabled: boolean }> = ({ aiEnabled }) => (
  <div className="p-3 rounded-xl bg-dark-card border border-dark-border text-xs">
    <div className="flex items-center gap-2 mb-1.5 font-semibold text-white">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${aiEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`}
        aria-hidden="true"
      />
      <span>{aiEnabled ? 'Live matching active' : 'Offline matching'}</span>
    </div>
    <p className="text-2xs text-slate-400 leading-relaxed">
      {/* Reflects the actual runtime state rather than asserting a stack that may not be configured. */}
      {aiEnabled
        ? 'Tool orchestration and verification workflows are running.'
        : 'Running on deterministic matching and verification engines.'}
    </p>
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
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} aria-hidden="true" />
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
