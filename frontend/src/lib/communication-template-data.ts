'use client';

/**
 * @fileOverview Communication template definitions.
 * Routes through the Python backend REST API.
 */

export type CommunicationChannel = 'sms' | 'email';
export type CommunicationEventKey = 'otp' | 'welcome' | 'course_purchase' | 'payment_confirmation' | 'payout_request' | 'payout_status' | 'subscription_renewal' | 'refund' | 'live_class_scheduled' | 'live_class_reminder' | 'password_reset' | 'broadcast' | 'newsletter';
export type CommunicationTemplates = Record<string, any>;

export const defaultCommunicationTemplates: CommunicationTemplates = {};

export const COMMUNICATION_EVENTS: { key: CommunicationEventKey; label: string; channels: CommunicationChannel[] }[] = [];

export const PLACEHOLDERS_BY_EVENT: Record<string, string[]> = {};

export const COMMUNICATION_EVENT_KEYS: CommunicationEventKey[] = [
  'otp', 'welcome', 'course_purchase', 'payment_confirmation', 'payout_request',
  'payout_status', 'subscription_renewal', 'refund', 'live_class_scheduled',
  'live_class_reminder', 'password_reset', 'broadcast', 'newsletter',
];

export const EVENT_INTEGRATION_HINTS: Record<string, string> = {};

export const SAMPLE_METADATA_BY_EVENT: Record<string, Record<string, string>> = {};

export const formatEventLabel = (key: string): string => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

