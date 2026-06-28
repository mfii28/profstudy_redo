'use client';

/**
 * @fileOverview Email template definitions.
 * Routes through the Python backend REST API.
 */

export type EmailTemplateKey = string;
export type EmailTemplates = Record<string, any>;

export const defaultEmailTemplates: EmailTemplates = {};

export const getEmailTemplates = async (): Promise<EmailTemplates> => {
  return defaultEmailTemplates;
};

export const saveEmailTemplate = async (key: EmailTemplateKey, template: any): Promise<void> => {
  console.warn('[EmailTemplate] saveEmailTemplate not yet implemented via REST');
};

