'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth, onAuthChange, logout as firebaseLogout } from '@/lib/auth/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (authUser) => {
      setUser(authUser);
      setLoading(false);
      setError(null);

      // Manage __session cookie for Next.js middleware and API routes
      if (authUser) {
        const token = await authUser.getIdToken();
        // Set cookie (valid for 1 hour, standard Firebase token length)
        document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax; Secure`;
        console.log('[Auth] __session cookie updated');
      } else {
        // Clear cookie
        document.cookie = '__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure';
        console.log('[Auth] __session cookie cleared');
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await firebaseLogout();
    } catch (err) {
      setError(new Error('Failed to logout'));
      throw err;
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (err) {
      console.error('Failed to get ID token:', err);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
