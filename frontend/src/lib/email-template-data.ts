'use client';

/**
 * @fileOverview Email template definitions.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';

export type EmailTemplateKey = string;
export type EmailTemplates = Record<string, any>;

export const defaultEmailTemplates: EmailTemplates = {};

export const getEmailTemplates = async (): Promise<EmailTemplates> => {
  try {
    const res = await apiFetch('/admin/email-templates');
    if (!res.ok) return defaultEmailTemplates;
    const data = await res.json();
    return data.templates || defaultEmailTemplates;
  } catch (e) {
    console.error('[EmailTemplate] getEmailTemplates error:', e);
    return defaultEmailTemplates;
  }
};

export const saveEmailTemplate = async (key: EmailTemplateKey, template: any): Promise<void> => {
  try {
    await apiFetch(`/admin/email-templates/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  } catch (e) {
    console.error('[EmailTemplate] saveEmailTemplate error:', e);
  }
};

