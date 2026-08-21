import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { NotificationItem } from '../../types';
import { Bell, LogOut, Sparkles, Menu, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC<{ onToggleChat: () => void; onOpenNav: () => void }> = ({
  onToggleChat,
  onOpenNav,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifError, setNotifError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(() => {
    api
      .getNotifications()
      .then((data) => {
        setNotifications(Array.isArray(data) ? data : []);
        setNotifError(false);
      })
      .catch(() => setNotifError(true));
  }, []);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user, loadNotifications]);

  // Close on outside click and on Escape — the dropdown previously stayed open forever.
  useEffect(() => {
    if (!showNotifications) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!dropdownRef.current?.contains(target) && !bellRef.current?.contains(target)) {
        setShowNotifications(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        bellRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleActivate = async (n: NotificationItem) => {
    try {
      if (!n.isRead) {
        await api.markNotificationRead(n.id);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      }
    } catch {
      // Navigation is the primary intent; a failed read-receipt must not block it.
    }
    setShowNotifications(false);
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      setNotifError(true);
    }
  };

  const displayName = user?.profile?.fullName || user?.email || 'Student';

  return (
    <header className="h-16 glass-panel border-b border-dark-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {/* Only entry point to navigation below the md breakpoint. */}
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation menu"
          className="md:hidden p-2 rounded-xl bg-dark-card border border-dark-border text-slate-300 hover:text-white hover:bg-dark-hover focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none transition shrink-0"
        >
          <Menu className="w-4 h-4" aria-hidden="true" />
        </button>
        <h1 className="text-sm font-semibold text-slate-300 truncate">
          <span className="hidden sm:inline">Welcome back, </span>
          <span className="text-white font-bold">{displayName}</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleChat}
          className="flex items-center gap-2 px-3 md:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-xs font-semibold shadow-lg shadow-brand-500/25 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none transition"
        >
          <Sparkles className="w-4 h-4 text-cyan-300" aria-hidden="true" />
          <span className="hidden sm:inline">Ask AI Copilot</span>
          <span className="sr-only sm:hidden">Ask AI Copilot</span>
        </button>

        <div className="relative">
          <button
            ref={bellRef}
            type="button"
            onClick={() => setShowNotifications((v) => !v)}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            aria-expanded={showNotifications}
            aria-haspopup="true"
            className="p-2 rounded-xl bg-dark-card border border-dark-border text-slate-400 hover:text-white hover:bg-dark-hover focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none transition relative"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              ref={dropdownRef}
              role="region"
              aria-label="Notifications"
              className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] glass-panel border border-dark-border rounded-2xl shadow-2xl p-3 z-50 animate-fade-in"
            >
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-dark-border gap-2">
                <span className="text-xs font-bold text-white">Notifications</span>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 text-[10px] text-brand-300 hover:text-brand-200 font-semibold focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none rounded px-1"
                  >
                    <CheckCheck className="w-3 h-3" aria-hidden="true" />
                    Mark all read
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400">All read</span>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {notifError ? (
                  <p role="alert" className="text-xs text-rose-300 text-center py-4">
                    Could not load notifications.{' '}
                    <button type="button" onClick={loadNotifications} className="underline font-semibold">
                      Retry
                    </button>
                  </p>
                ) : notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No notifications yet</p>
                ) : (
                  notifications.map((n) => (
                    // A real button, so it is keyboard-reachable and screen-reader announced.
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleActivate(n)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none ${
                        n.isRead
                          ? 'bg-dark-card/40 opacity-70 hover:opacity-100'
                          : 'bg-brand-900/40 border border-brand-500/30 hover:bg-brand-900/60'
                      }`}
                    >
                      <span className="block font-semibold text-white mb-0.5">{n.title}</span>
                      <span className="block text-slate-300 text-[11px] leading-tight mb-1">{n.message}</span>
                      <span className="block text-[9px] text-brand-300">
                        {new Date(n.createdAt).toLocaleDateString()}
                        {!n.isRead && <span className="sr-only"> (unread)</span>}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
          aria-label="Sign out"
          className="p-2 rounded-xl bg-dark-card border border-dark-border text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none transition"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
