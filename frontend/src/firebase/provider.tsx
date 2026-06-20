'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  isLoading: boolean; // Alias for isUserLoading used in layouts
  userError: Error | null; // Error from auth listener
  logout: () => Promise<void>; // Global logout function
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  isLoading: boolean;
  userError: Error | null;
  logout: () => Promise<void>;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { // If no Auth service instance, cannot determine user state
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    setUserAuthState({ user: null, isUserLoading: true, userError: null }); // Reset on auth instance change

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: User | null) => { // Auth state determined
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
        // Sync __session cookie for server-side middleware auth gate
        if (firebaseUser) {
          const setSessionCookie = async () => {
            const token = await firebaseUser.getIdToken();
            const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
            document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax; ${secure}`;
          };
          await setSessionCookie();

          // Proactively refresh the token ~5 minutes before the 1-hour expiry so the
          // middleware cookie never goes stale during an active session.
          const REFRESH_INTERVAL_MS = 55 * 60 * 1000; // 55 minutes
          const refreshTimer = setInterval(async () => {
            try {
              await setSessionCookie(); // getIdToken() auto-refreshes when near expiry
            } catch {
              clearInterval(refreshTimer);
            }
          }, REFRESH_INTERVAL_MS);

          // Expose the timer id on the closure so the outer cleanup can clear it.
          return () => clearInterval(refreshTimer);
        } else {
          document.cookie = '__session=; path=/; max-age=0;';
        }
      },
      (error: Error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [auth]); // Depends on the auth instance

  const logout = React.useCallback(async () => {
    if (auth) {
      document.cookie = '__session=; path=/; max-age=0;';
      await auth.signOut();
    }
  }, [auth]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      isLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
      logout,
    };
  }, [firebaseApp, firestore, auth, userAuthState, logout]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Returns the context state which may have null services during SSR.
 */
export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    // During SSR, we might be outside the provider temporarily or during initial build phases.
    // Return a safe empty state to prevent hard crashes.
    return {
      areServicesAvailable: false,
      firebaseApp: null,
      firestore: null,
      auth: null,
      user: null,
      isUserLoading: true,
      isLoading: true,
      userError: null,
      logout: async () => {},
    };
  }

  return context;
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth | null => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore | null => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp | null => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => {
  const { user, isUserLoading, isLoading, userError, logout } = useFirebase();
  return { user, isUserLoading, isLoading, userError, logout };
};
