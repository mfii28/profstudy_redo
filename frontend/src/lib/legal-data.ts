'use client';

/**
 * @fileOverview Data service for legal documents.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';

/** @deprecated Use LegalDocumentEntry */
export type LegalDocument = LegalDocumentEntry;

export interface LegalDocumentEntry {
  title: string;
  content: string;
}

export interface LegalDocuments {
  terms: LegalDocumentEntry;
  privacy: LegalDocumentEntry;
  refund: LegalDocumentEntry;
  lastUpdated: string;
}

export const defaultLegalDocuments: LegalDocuments = {
  terms: { title: 'Terms of Service', content: 'Terms of Service content pending...' },
  privacy: { title: 'Privacy Policy', content: 'Privacy Policy content pending...' },
  refund: { title: 'Refund Policy', content: 'Refund Policy content pending...' },
  lastUpdated: new Date().toISOString(),
};

export const getLegalDocuments = async (): Promise<LegalDocuments> => {
  try {
    const res = await apiFetch('/settings/legal');
    if (res.ok) {
      const data = await res.json();
      return data.documents || defaultLegalDocuments;
    }
  } catch {
    // ignore
  }
  return defaultLegalDocuments;
};

export const saveLegalDocuments = async (documents: LegalDocuments): Promise<void> => {
  await apiFetch('/settings/legal', {
    method: 'PUT',
    body: JSON.stringify({ documents }),
  });
};

