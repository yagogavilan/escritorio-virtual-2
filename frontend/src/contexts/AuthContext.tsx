import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/client';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  login: (email: string) => Promise<void>;
  visitorLogin: (name: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  impersonate: (userId: string) => Promise<void>;
  unimpersonate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authApi.me()
        .then((response) => {
          setUser(response.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string) => {
    const response = await authApi.login(email);
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
  }, []);

  const visitorLogin = useCallback(async (name: string, code: string) => {
    const response = await authApi.visitorLogin(name, code);
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors
    }
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const impersonate = useCallback(async (userId: string) => {
    // Save current master token
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      localStorage.setItem('masterToken', currentToken);
    }

    // Impersonate user
    const response = await authApi.impersonate(userId);
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    setIsImpersonating(true);
  }, []);

  const unimpersonate = useCallback(async () => {
    // Restore master token
    const masterToken = localStorage.getItem('masterToken');
    if (masterToken) {
      localStorage.setItem('token', masterToken);
      localStorage.removeItem('masterToken');

      // Reload master user data
      const response = await authApi.me();
      setUser(response.data);
      setIsImpersonating(false);
    }
  }, []);

  // Check if impersonating on mount
  useEffect(() => {
    const masterToken = localStorage.getItem('masterToken');
    if (masterToken) {
      setIsImpersonating(true);
    }
  }, []);

  // Handle browser close - ensure logout
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear auth tokens on browser close
      // This ensures the user is fully logged out
      // The socket will handle the disconnect event
      localStorage.removeItem('token');
      localStorage.removeItem('masterToken');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isImpersonating,
        login,
        visitorLogin,
        logout,
        updateUser,
        impersonate,
        unimpersonate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
