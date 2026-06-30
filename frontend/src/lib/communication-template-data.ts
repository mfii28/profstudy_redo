'use client';

/**
 * @fileOverview Communication template definitions.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';

export type CommunicationChannel = 'sms' | 'email';
export type CommunicationEventKey = 'otp' | 'welcome' | 'course_purchase' | 'payment_confirmation' | 'payout_request' | 'payout_status' | 'subscription_renewal' | 'refund' | 'live_class_scheduled' | 'live_class_reminder' | 'password_reset' | 'broadcast' | 'newsletter';
export type CommunicationTemplates = Record<string, any>;

export const defaultCommunicationTemplates: CommunicationTemplates = {
  otp: {
    sms: 'Your {{site_name}} verification code is: {{otp_code}}. Expires in {{expiry_minutes}} minutes.',
    email: { subject: 'Your Verification Code', body: '<p>Your code: <strong>{{otp_code}}</strong></p><p>Expires in {{expiry_minutes}} minutes.</p>' },
  },
  welcome: {
    email: { subject: 'Welcome to {{site_name}}', body: '<h1>Welcome, {{user_name}}!</h1><p>Start your learning journey today.</p>' },
  },
  course_purchase: {
    email: { subject: 'Purchase Confirmed — {{course_name}}', body: '<h1>Thank you for your purchase!</h1><p>You are now enrolled in <strong>{{course_name}}</strong>.</p>' },
    sms: 'Purchase confirmed for {{course_name}}. Thank you!',
  },
  payment_confirmation: {
    email: { subject: 'Payment Confirmed — {{amount}}', body: '<h1>Payment Successful</h1><p>Amount: {{amount}}<br/>Ref: {{reference}}</p>' },
    sms: 'Payment of {{amount}} confirmed. Ref: {{reference}}',
  },
  payout_request: {
    email: { subject: 'Payout Request — {{amount}}', body: '<h1>Payout Request</h1><p>Amount: {{amount}}</p>' },
  },
  payout_status: {
    email: { subject: 'Payout {{status}} — {{amount}}', body: '<h1>Payout {{status}}</h1><p>Amount: {{amount}}</p>' },
  },
  subscription_renewal: {
    email: { subject: 'Subscription Renewal — {{plan_name}}', body: '<h1>Subscription Renewal</h1><p>Your {{plan_name}} plan renews on {{renewal_date}}.</p>' },
  },
  refund: {
    email: { subject: 'Refund Processed — {{amount}}', body: '<h1>Refund Processed</h1><p>Amount: {{amount}}<br/>Item: {{item_name}}</p>' },
  },
  live_class_scheduled: {
    email: { subject: 'Live Class Scheduled — {{class_title}}', body: '<h1>Live Class Scheduled</h1><p><strong>{{class_title}}</strong><br/>{{start_time}}</p><p><a href="{{join_link}}">Join Class</a></p>' },
    sms: 'Live class: {{class_title}} at {{start_time}}. Join: {{join_link}}',
  },
  live_class_reminder: {
    email: { subject: 'Reminder: {{class_title}} starts soon', body: '<h1>Class Reminder</h1><p><strong>{{class_title}}</strong> starts at {{start_time}}.</p><p><a href="{{join_link}}">Join Now</a></p>' },
    sms: 'Reminder: {{class_title}} starts at {{start_time}}.',
  },
  password_reset: {
    email: { subject: 'Reset Your Password', body: '<h1>Password Reset</h1><p><a href="{{reset_link}}">Click here to reset your password</a></p><p>Expires in {{expiry_hours}} hour(s).</p>' },
  },
  broadcast: {
    email: { subject: '{{title}}', body: '<h1>{{title}}</h1><p>{{message}}</p>' },
    sms: '{{message}}',
  },
  newsletter: {
    email: { subject: '{{title}}', body: '<h1>{{title}}</h1><p>{{content}}</p><p><a href="{{unsubscribe_link}}">Unsubscribe</a></p>' },
  },
};

export const COMMUNICATION_EVENTS: { key: CommunicationEventKey; label: string; channels: CommunicationChannel[] }[] = [
  { key: 'otp', label: 'OTP Verification', channels: ['email', 'sms'] },
  { key: 'welcome', label: 'Welcome Email', channels: ['email'] },
  { key: 'course_purchase', label: 'Course Purchase Confirmation', channels: ['email'] },
  { key: 'payment_confirmation', label: 'Payment Confirmation', channels: ['email'] },
  { key: 'payout_request', label: 'Payout Request', channels: ['email'] },
  { key: 'payout_status', label: 'Payout Status Update', channels: ['email'] },
  { key: 'subscription_renewal', label: 'Subscription Renewal', channels: ['email'] },
  { key: 'refund', label: 'Refund Notification', channels: ['email'] },
  { key: 'live_class_scheduled', label: 'Live Class Scheduled', channels: ['email'] },
  { key: 'live_class_reminder', label: 'Live Class Reminder', channels: ['email'] },
  { key: 'password_reset', label: 'Password Reset', channels: ['email'] },
  { key: 'broadcast', label: 'Broadcast Message', channels: ['email', 'sms'] },
  { key: 'newsletter', label: 'Newsletter', channels: ['email'] },
];

export const PLACEHOLDERS_BY_EVENT: Record<string, string[]> = {
  otp: ['{{otp_code}}', '{{expiry_minutes}}'],
  welcome: ['{{user_name}}', '{{dashboard_link}}'],
  course_purchase: ['{{user_name}}', '{{course_name}}', '{{course_link}}'],
  payment_confirmation: ['{{user_name}}', '{{amount}}', '{{reference}}', '{{date}}'],
  payout_request: ['{{user_name}}', '{{amount}}', '{{account_details}}'],
  payout_status: ['{{user_name}}', '{{amount}}', '{{status}}', '{{reason}}'],
  subscription_renewal: ['{{user_name}}', '{{plan_name}}', '{{renewal_date}}', '{{amount}}'],
  refund: ['{{user_name}}', '{{amount}}', '{{item_name}}', '{{reason}}'],
  live_class_scheduled: ['{{user_name}}', '{{class_title}}', '{{start_time}}', '{{join_link}}'],
  live_class_reminder: ['{{user_name}}', '{{class_title}}', '{{start_time}}', '{{join_link}}'],
  password_reset: ['{{user_name}}', '{{reset_link}}', '{{expiry_hours}}'],
  broadcast: ['{{user_name}}', '{{message}}'],
  newsletter: ['{{user_name}}', '{{title}}', '{{content}}', '{{unsubscribe_link}}'],
};

export const COMMUNICATION_EVENT_KEYS: CommunicationEventKey[] = [
  'otp', 'welcome', 'course_purchase', 'payment_confirmation', 'payout_request',
  'payout_status', 'subscription_renewal', 'refund', 'live_class_scheduled',
  'live_class_reminder', 'password_reset', 'broadcast', 'newsletter',
];

export const EVENT_INTEGRATION_HINTS: Record<string, string> = {
  otp: 'Triggered automatically during login/signup OTP flow',
  welcome: 'Sent immediately after successful registration',
  course_purchase: 'Sent after successful payment for a course',
  payment_confirmation: 'Sent when a payment is verified via webhook',
  payout_request: 'Triggered when a tutor requests a payout',
  payout_status: 'Sent when an admin updates payout status',
  subscription_renewal: 'Sent before subscription auto-renewal',
  refund: 'Sent when a refund is processed by admin',
  live_class_scheduled: 'Sent when a new live class is created',
  live_class_reminder: 'Sent 1 hour before a scheduled live class',
  password_reset: 'Triggered via forgot-password flow',
  broadcast: 'Manually sent from admin broadcast panel',
  newsletter: 'Sent to opted-in users from admin panel',
};

export const SAMPLE_METADATA_BY_EVENT: Record<string, Record<string, string>> = {
  otp: { otp_code: '123456', expiry_minutes: '10' },
  welcome: { user_name: 'John Doe', dashboard_link: 'https://app.example.com/dashboard' },
  course_purchase: { user_name: 'John Doe', course_name: 'Introduction to Python', course_link: 'https://app.example.com/courses/python-101' },
  payment_confirmation: { user_name: 'John Doe', amount: '₦50,000', reference: 'REF-123456', date: 'Jan 15, 2025' },
  payout_request: { user_name: 'Jane Tutor', amount: '₦150,000', account_details: 'Bank: GTBank, Acc: 0123456789' },
  payout_status: { user_name: 'Jane Tutor', amount: '₦150,000', status: 'approved', reason: '' },
  subscription_renewal: { user_name: 'John Doe', plan_name: 'Premium Monthly', renewal_date: 'Feb 15, 2025', amount: '₦10,000' },
  refund: { user_name: 'John Doe', amount: '₦50,000', item_name: 'Introduction to Python', reason: 'Duplicate payment' },
  live_class_scheduled: { user_name: 'John Doe', class_title: 'Advanced Calculus - Session 3', start_time: 'Feb 20, 2025 at 3:00 PM', join_link: 'https://zoom.us/j/123456789' },
  live_class_reminder: { user_name: 'John Doe', class_title: 'Advanced Calculus - Session 3', start_time: 'Feb 20, 2025 at 3:00 PM', join_link: 'https://zoom.us/j/123456789' },
  password_reset: { user_name: 'John Doe', reset_link: 'https://app.example.com/reset-password?token=abc123', expiry_hours: '1' },
  broadcast: { user_name: 'John Doe', message: 'We are excited to announce our new course catalogue!' },
  newsletter: { user_name: 'John Doe', title: 'Monthly Learning Digest', content: 'Check out our latest courses and features...', unsubscribe_link: 'https://app.example.com/unsubscribe?token=abc123' },
};

export const formatEventLabel = (key: string): string => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const getCommunicationTemplates = async (): Promise<CommunicationTemplates> => {
  try {
    const res = await apiFetch('/admin/communication-templates');
    if (!res.ok) return defaultCommunicationTemplates;
    const data = await res.json();
    return data.templates || defaultCommunicationTemplates;
  } catch (e) {
    console.error('[CommunicationTemplate] getCommunicationTemplates error:', e);
    return defaultCommunicationTemplates;
  }
};

export const saveCommunicationTemplate = async (key: string, template: any): Promise<void> => {
  try {
    await apiFetch(`/admin/communication-templates/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  } catch (e) {
    console.error('[CommunicationTemplate] saveCommunicationTemplate error:', e);
  }
};

