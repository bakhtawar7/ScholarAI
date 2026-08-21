import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, MobileNav } from './Sidebar';
import { Header } from './Header';
import { FloatingChatbot } from '../chat/FloatingChatbot';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useAuth } from '../../context/AuthContext';

export const Layout: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { isAdmin } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-dark-bg text-slate-100">
      {/* Keyboard users can jump past the nav to content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-brand-600 focus:text-white focus:text-xs focus:font-semibold"
      >
        Skip to main content
      </a>

      <Sidebar isAdmin={isAdmin} />
      <MobileNav isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} isAdmin={isAdmin} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleChat={() => setIsChatOpen((v) => !v)} onOpenNav={() => setIsNavOpen(true)} />
        <main id="main-content" className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {/* Keyed on pathname so navigating away from a crashed page recovers it. */}
          <ErrorBoundary key={location.pathname} section="This page">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <ErrorBoundary section="The chat assistant">
        <FloatingChatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </ErrorBoundary>
    </div>
  );
};
