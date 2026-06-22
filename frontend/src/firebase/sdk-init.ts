'use client';

/** Mock SDK initialization for NextAuth backend. */

export function getSdks(firebaseApp: any) {
  return {
    firebaseApp: null as any,
    auth: null as any,
    firestore: null as any
  };
}

export function initializeFirebase() {
  return {
    firebaseApp: null as any,
    auth: null as any,
    firestore: null as any
  };
}
