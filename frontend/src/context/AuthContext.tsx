import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '../types';
import { api, setUnauthorizedHandler } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** True when the account may reach admin-only routes (catalogue, verification, automation). */
  isAdmin: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(localStorage.getItem('token')));

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.me();
      setUser(data);
    } catch {
      // Expired or revoked token — drop it rather than leaving the app in a
      // half-authenticated state where every request 401s.
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [token, clearSession]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Any 401 from the API layer — including one raised mid-session — ends the session.
  useEffect(() => {
    setUnauthorizedHandler(() => clearSession());
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      loading,
      /**
       * Prefer the server's computed flag. Admin can also be granted through
       * ADMIN_EMAILS, which `role` alone does not reflect — checking only the role hid
       * the admin navigation from operators the API already treated as administrators.
       * The `role` comparison remains as a fallback for a response predating the field.
       */
      isAdmin: user?.isAdmin ?? user?.role === 'ADMIN',
      login,
      logout: clearSession,
      refreshUser,
    }),
    [user, token, loading, login, clearSession, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
