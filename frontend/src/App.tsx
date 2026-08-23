import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingState } from './components/common/States';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { ScholarshipsPage } from './pages/ScholarshipsPage';
import { ScholarshipDetailPage } from './pages/ScholarshipDetailPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { DeadlinesPage } from './pages/DeadlinesPage';
import { CVAssistantPage } from './pages/CVAssistantPage';
import { SOPAssistantPage } from './pages/SOPAssistantPage';
import { ProfilePage } from './pages/ProfilePage';
import { AutomationPage } from './pages/AutomationPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <LoadingState message="Restoring your session…" />
      </div>
    );
  }

  if (!token) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
};

/** Admin-gated route. The backend enforces this too; this only avoids a dead-end 403 view. */
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <LoadingState message="Checking permissions…" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center glass-card rounded-3xl border border-amber-500/30 max-w-lg mx-auto space-y-3">
        <h2 className="text-base font-bold text-white">Administrator access required</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The automation console is limited to administrator accounts. Add your email to{' '}
          <code className="text-brand-300">ADMIN_EMAILS</code> in the backend environment, then sign in again.
        </p>
        <Link
          to="/dashboard"
          className="inline-block px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};

/** Sends an already-authenticated visitor to the app instead of the marketing page. */
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <LoadingState message="Loading…" />
      </div>
    );
  }
  if (token) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
    <div className="max-w-md w-full glass-card rounded-3xl border border-dark-border p-8 text-center space-y-4">
      <p className="text-5xl font-extrabold text-brand-400">404</p>
      <h1 className="text-lg font-bold text-white">Page not found</h1>
      <p className="text-xs text-slate-400">That page does not exist or may have moved.</p>
      <Link
        to="/dashboard"
        className="inline-block px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition"
      >
        Go to dashboard
      </Link>
    </div>
  </div>
);

export const App: React.FC = () => (
  // Outermost boundary: catches a failure in the router or providers themselves,
  // which would otherwise render a blank screen with no recovery path.
  <ErrorBoundary section="The application">
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route
            index
            element={
              <PublicOnlyRoute>
                <LandingPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/auth/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/auth/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/auth/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          {/* Reached from an emailed link, so it must stay outside PublicOnlyRoute: a user
              with a stale session in another tab still needs to be able to complete a
              reset rather than being bounced to the dashboard. */}
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

          {/* Authenticated application shell.
              Declared as a pathless layout route so it no longer competes with the
              landing page for the "/" path — previously both routes were path="/",
              and which one matched depended on array order. */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ai-assistant" element={<AIAssistantPage />} />
            <Route path="/scholarships" element={<ScholarshipsPage />} />
            <Route path="/scholarships/:id" element={<ScholarshipDetailPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/saved" element={<ScholarshipsPage />} />
            <Route path="/deadlines" element={<DeadlinesPage />} />
            <Route path="/cv-assistant" element={<CVAssistantPage />} />
            <Route path="/sop-assistant" element={<SOPAssistantPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/automation"
              element={
                <AdminRoute>
                  <AutomationPage />
                </AdminRoute>
              }
            />
          </Route>

          {/* Real 404 instead of a silent redirect that hid broken links. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
