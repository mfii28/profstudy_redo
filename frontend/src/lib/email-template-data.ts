'use client';

/**
 * @fileOverview Email template definitions.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';

export type EmailTemplateKey = string;
export type EmailTemplates = Record<string, any>;

export const defaultEmailTemplates: EmailTemplates = {
  welcome: {
    subject: 'Welcome to {{site_name}} — Start Your Learning Journey',
    body: `<h1>Welcome, {{user_name}}!</h1>
<p>Thank you for joining {{site_name}}. We're excited to have you on board.</p>
<p>Get started by exploring our courses and building your skills.</p>
<p><a href="{{dashboard_link}}">Go to Dashboard</a></p>
<p>Best regards,<br/>The {{site_name}} Team</p>`,
  },
  enrollment: {
    subject: "You're enrolled in {{course_name}}",
    body: `<h1>Enrollment Confirmed</h1>
<p>Congratulations, {{user_name}}!</p>
<p>You have been successfully enrolled in <strong>{{course_name}}</strong>.</p>
<p><a href="{{course_link}}">Start Learning</a></p>
<p>Best regards,<br/>The {{site_name}} Team</p>`,
  },
  payment_confirmation: {
    subject: 'Payment Confirmed — {{amount}}',
    body: `<h1>Payment Successful</h1>
<p>Hi {{user_name}},</p>
<p>Your payment of <strong>{{amount}}</strong> has been confirmed.</p>
<p>Reference: {{reference}}</p>
<p>Date: {{date}}</p>
<p>Thank you for your purchase!</p>`,
  },
  password_reset: {
    subject: 'Reset Your Password',
    body: `<h1>Password Reset</h1>
<p>Hi {{user_name}},</p>
<p>Click the link below to reset your password. This link expires in {{expiry_hours}} hour(s).</p>
<p><a href="{{reset_link}}">Reset Password</a></p>
<p>If you did not request this, please ignore this email.</p>`,
  },
  payout_request: {
    subject: 'Payout Request Submitted — {{amount}}',
    body: `<h1>Payout Request</h1>
<p>Hi {{user_name}},</p>
<p>Your payout request for <strong>{{amount}}</strong> has been submitted and is being processed.</p>
<p>Account: {{account_details}}</p>
<p>You will be notified once the status changes.</p>`,
  },
  payout_status: {
    subject: 'Payout Status Update — {{status}}',
    body: `<h1>Payout {{status}}</h1>
<p>Hi {{user_name}},</p>
<p>Your payout request for <strong>{{amount}}</strong> has been <strong>{{status}}</strong>.</p>
{{#if reason}}<p>Reason: {{reason}}</p>{{/if}}
<p>Best regards,<br/>The {{site_name}} Team</p>`,
  },
};

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

