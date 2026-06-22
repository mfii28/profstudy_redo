'use client';

import React, { type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { FirebaseProvider } from './provider';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  return (
    <SessionProvider>
      <FirebaseProvider>
        {children}
      </FirebaseProvider>
    </SessionProvider>
  );
}
