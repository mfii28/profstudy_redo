'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { auth } from './client';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';

export interface UserHookResult {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<UserHookResult | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = React.useCallback(async () => {
    document.cookie = '__session=; path=/; max-age=0;';
    await signOut(auth);
    setUser(null);
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
        try {
          const sessionToken = await firebaseUser.getIdToken(true);
          document.cookie = `__session=${sessionToken}; path=/; max-age=3600; SameSite=Lax; ${secure}`;
        } catch (e) {
          console.error("Failed to get ID token result", e);
        }
        setUser(firebaseUser);
      } else {
        document.cookie = '__session=; path=/; max-age=0;';
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useUser = (): UserHookResult => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return { user: null, isLoading: false, logout: async () => {} };
  }
  return context;
};
