'use client';

/**
 * @fileOverview Data service for free resources.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';
import type { FreeResource } from '@/lib/db';

export const getFreeResources = async (): Promise<FreeResource[]> => {
  try {
    const res = await apiFetch('/free-resources');
    if (!res.ok) return [];
    const data = await res.json();
    return data.resources || [];
  } catch {
    return [];
  }
};

export const saveFreeResource = async (resource: Omit<FreeResource, 'id'> & { id?: string }): Promise<void> => {
  await apiFetch('/free-resources', {
    method: 'POST',
    body: JSON.stringify(resource),
  });
};

export const removeFreeResource = async (id: string): Promise<void> => {
  await apiFetch(`/free-resources/${id}`, { method: 'DELETE' });
};

