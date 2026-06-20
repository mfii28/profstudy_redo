import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Isomorphic Firebase initialization.
 * Safe for use in both browser and server environments.
 * Prevents side-effect crashes during module import by using a lazy initialization pattern.
 */
const getFirebaseInstance = () => {
  // SSR GUARD: Don't crash if environment variables are missing during build time
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    return { app: null, db: null, auth: null };
  }

  try {
    let app: FirebaseApp;

    if (getApps().length > 0) {
      app = getApp();
    } else {
      app = initializeApp(firebaseConfig);
    }

    // initializeFirestore can only be called once per app instance.
    // On hot-reload (fast refresh), the app may already be initialized.
    // We try to initialize with settings; if it fails, fall back to getFirestore.
    let db: Firestore;
    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      db = getFirestore(app);
    }

    return {
      app,
      db,
      auth: getAuth(app),
    };
  } catch (error) {
    if (typeof window !== 'undefined') {
        console.warn('[Firebase] Initialization delayed or failed:', error);
    }
    return { app: null, db: null, auth: null };
  }
};

// Lazy initialization ensures singletons are not populated until needed
const instance = getFirebaseInstance();

export const app = instance.app;
export const db = instance.db as Firestore;
export const auth = instance.auth as Auth;
