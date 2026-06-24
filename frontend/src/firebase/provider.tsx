'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';

/**
 * Supabase Auth Provider.
 * Replaces Firebase Auth with direct Supabase session management.
 * Exposes a MockUser interface for backward compatibility with existing hooks.
 */
export interface MockUser {
  uid: string;
  id: string;
  email: string | null;
  name: string | null;
  displayName: string | null;
  image?: string | null;
  photoURL?: string | null;
  role?: string;
  emailVerified?: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult: () => Promise<{ claims: Record<string, any> }>;
}

export interface SupabaseContextState {
  supabase: typeof supabase;
  user: MockUser | null;
  isUserLoading: boolean;
  isLoading: boolean;
  userError: Error | null;
  logout: () => Promise<void>;
}

export interface UserHookResult {
  user: MockUser | null;
  isUserLoading: boolean;
  isLoading: boolean;
  userError: Error | null;
  logout: () => Promise<void>;
}

export const SupabaseContext = createContext<SupabaseContextState | undefined>(undefined);

function mapSupabaseUser(supabaseUser: any): MockUser {
  const role = supabaseUser.user_metadata?.role || 'student';
  const name = supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || '';
  return {
    uid: supabaseUser.id,
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: name,
    displayName: name,
    image: supabaseUser.user_metadata?.avatar_url || '',
    photoURL: supabaseUser.user_metadata?.avatar_url || '',
    role: role,
    emailVerified: !!supabaseUser.email_confirmed_at,
    getIdToken: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || '';
    },
    getIdTokenResult: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return {
        token: session?.access_token || '',
        claims: {
          emailVerified: !!supabaseUser.email_confirmed_at,
          role: role,
        },
      };
    },
  };
}

export const SupabaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MockUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  const logout = React.useCallback(async () => {
    document.cookie = '__session=; path=/; max-age=0;';
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(mapSupabaseUser(session.user));
      } else {
        setUser(null);
      }
      setIsUserLoading(false);
    });

    // 2. Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
        const role = session.user.user_metadata?.role || 'student';
        const emailVerified = !!session.user.email_confirmed_at;
        const mockSessionToken = btoa(JSON.stringify({ uid: session.user.id, role: role, emailVerified }));
        document.cookie = `__session=${mockSessionToken}; path=/; max-age=3600; SameSite=Lax; ${secure}`;
        setUser(mapSupabaseUser(session.user));
      } else {
        document.cookie = '__session=; path=/; max-age=0;';
        setUser(null);
      }
      setIsUserLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const contextValue = useMemo((): SupabaseContextState => {
    return {
      supabase,
      user,
      isUserLoading,
      isLoading: isUserLoading,
      userError: null,
      logout,
    };
  }, [user, isUserLoading, logout]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = (): SupabaseContextState => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    return {
      supabase,
      user: null,
      isUserLoading: false,
      isLoading: false,
      userError: null,
      logout: async () => {},
    };
  }
  return context;
};

export const useAuth = (): any => {
  const { supabase } = useSupabase();
  return supabase.auth;
};

/**
 * @deprecated Use `supabase` directly from @/lib/supabase-client instead.
 */
export const useFirestore = (): any => {
  return {};
};

/**
 * @deprecated Supabase is used directly. This returns null.
 */
export const useFirebaseApp = (): any => {
  return null;
};

export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList): T {
  return useMemo(factory, deps);
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, isLoading, userError, logout } = useSupabase();
  return { user, isUserLoading, isLoading, userError, logout };
};
