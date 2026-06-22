'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';

// Interfaces to mimic Firebase Auth structures
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

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: any | null;
  firestore: any | null;
  auth: any | null;
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

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();

  const isUserLoading = status === 'loading';

  const user = useMemo((): MockUser | null => {
    if (!session?.user) return null;
    const u = session.user as any;
    return {
      uid: u.id || '',
      id: u.id || '',
      email: u.email || '',
      name: u.name || '',
      displayName: u.name || '',
      image: u.image || '',
      photoURL: u.image || '',
      role: u.role || 'student',
      emailVerified: true,
      getIdToken: async () => u.id || '',
      getIdTokenResult: async () => ({
        claims: {
          emailVerified: true,
          role: u.role || 'student',
        },
      }),
    };
  }, [session]);

  const logout = React.useCallback(async () => {
    // Clear session cookies and signOut
    document.cookie = '__session=; path=/; max-age=0;';
    await signOut({ callbackUrl: '/login' });
  }, []);

  const contextValue = useMemo((): FirebaseContextState => {
    return {
      areServicesAvailable: true,
      firebaseApp: {},
      firestore: {},
      auth: {
        signOut: logout,
        currentUser: user,
      },
      user,
      isUserLoading,
      isLoading: isUserLoading,
      userError: null,
      logout,
    };
  }, [user, isUserLoading, logout]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    return {
      areServicesAvailable: true,
      firebaseApp: {},
      firestore: {},
      auth: {},
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
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): any => {
  return {};
};

export const useFirebaseApp = (): any => {
  return {};
};

export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList): T {
  return useMemo(factory, deps);
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, isLoading, userError, logout } = useFirebase();
  return { user, isUserLoading, isLoading, userError, logout };
};
