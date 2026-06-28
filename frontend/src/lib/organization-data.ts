'use client';

/**
 * @fileOverview Data service for organizations.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';
import type { Organization } from '@/lib/db';

export const getOrganizations = async (): Promise<Organization[]> => {
  try {
    const res = await apiFetch('/admin/organizations');
    if (!res.ok) return [];
    const data = await res.json();
    return data.organizations || [];
  } catch {
    return [];
  }
};

export const saveOrganization = async (org: Organization): Promise<void> => {
  await apiFetch('/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(org),
  });
};

export const updateOrganizationStatus = async (id: string, status: string): Promise<void> => {
  await apiFetch(`/admin/organizations/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};

export const deleteOrganization = async (id: string): Promise<void> => {
  await apiFetch(`/admin/organizations/${id}`, { method: 'DELETE' });
};

