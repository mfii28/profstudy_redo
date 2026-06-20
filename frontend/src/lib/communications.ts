import { adminDb } from '@/firebase/admin';
import {
  COMMUNICATION_EVENT_KEYS,
  type CommunicationChannel,
  type CommunicationEventKey,
  getSampleMetadataForEvent,
} from '@/lib/communication-events';
import { getGlobalSettings } from '@/lib/platform-settings-data';
import { logger } from '@/lib/logging';

type Channel = CommunicationChannel;
type EventKey = CommunicationEventKey;

export type { CommunicationChannel, CommunicationEventKey };

type DispatchArgs = {
  eventKey: EventKey;
  userId: string;
  channels?: Channel[];
  fallbackChannels?: Channel[];
  phoneNumber?: string;
  email?: string;
  title?: string;
  message: string;
  metadata?: Record<string, unknown>;
  retryCount?: number;
  forceSend?: boolean;
};

export type DispatchChannelResult = {
  channel: Channel;
  status: 'sent' | 'failed' | 'delegated' | 'skipped' | 'queued_retry';
  reason?: string;
  error?: string;
};

export type DispatchResult = {
  eventId: string;
  results: DispatchChannelResult[];
};

const ARKESEL_SMS_BASE_URL = 'https://sms.arkesel.com/sms/api';
const ARKESEL_SMS_SEND_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const ARKESEL_CONTACTS_BASE_URL = 'https://sms.arkesel.com/contacts/api';
const ARKESEL_WHATSAPP_BASE_URL = 'https://sms.arkesel.com/api/v2';
const TEMPLATE_DOC_PATH = 'platformContent/communication-templates';
/** Arkesel requires sender IDs shorter than 11 characters. */
export const ARKESEL_SMS_SENDER_MAX_LENGTH = 10;

type ArkeselKeySource = 'sms-env' | 'generic-env' | 'whatsapp-env' | 'none';

function normalizeSecretInput(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const eqIndex = trimmed.indexOf('=');
  const extracted = eqIndex > -1 ? trimmed.slice(eqIndex + 1).trim() : trimmed;
  const unquoted =
    (extracted.startsWith('"') && extracted.endsWith('"')) ||
    (extracted.startsWith("'") && extracted.endsWith("'"))
      ? extracted.slice(1, -1).trim()
      : extracted;
  const withoutSpaces = unquoted.replace(/\s+/g, '');
  return withoutSpaces || undefined;
}

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return normalizeSecretInput(trimmed);
}

function resolveArkeselSmsApiKey(): { key?: string; source: ArkeselKeySource } {
  const sms = readEnv('ARKESEL_SMS_API_KEY');
  if (sms) return { key: sms, source: 'sms-env' };
  const generic = readEnv('ARKESEL_API_KEY');
  if (generic) return { key: generic, source: 'generic-env' };
  return { source: 'none' };
}

function resolveArkeselWhatsappApiKey(): { key?: string; source: ArkeselKeySource } {
  const wa = readEnv('ARKESEL_WHATSAPP_API_KEY');
  if (wa) return { key: wa, source: 'whatsapp-env' };
  const generic = readEnv('ARKESEL_API_KEY');
  if (generic) return { key: generic, source: 'generic-env' };
  return { source: 'none' };
}

export function validateArkeselSmsSenderId(senderId: string): { ok: boolean; error?: string } {
  const trimmed = senderId.trim();
  if (!trimmed) {
    return { ok: false, error: 'SMS sender ID is required (set ARKESEL_SMS_SENDER_ID).' };
  }
  if (trimmed.length >= 11) {
    return {
      ok: false,
      error: `SMS sender ID must be less than 11 characters (current length: ${trimmed.length}).`,
    };
  }
  return { ok: true };
}

function resolveArkeselSmsSenderId(): string {
  return readEnv('ARKESEL_SMS_SENDER_ID') || 'PROFS';
}

function resolveArkeselWhatsappSender(): string | undefined {
  return readEnv('ARKESEL_WHATSAPP_SENDER');
}

function getDiagnosticsSenderValues() {
  const smsSender = resolveArkeselSmsSenderId();
  const senderValidation = validateArkeselSmsSenderId(smsSender);
  return {
    smsSender,
    smsSenderValid: senderValidation.ok,
    smsSenderError: senderValidation.error,
    waSender: readEnv('ARKESEL_WHATSAPP_SENDER'),
  };
}

const defaultTemplates: Record<EventKey, Partial<Record<Channel, { enabled: boolean; body: string }>>> = {
  otp: {
    sms: { enabled: true, body: 'Hi {{user_name}}, your OTP is {{otp_code}}. It expires in {{expires_minutes}} minutes.' },
    whatsapp: { enabled: true, body: 'Hello {{user_name}}, your verification code is {{otp_code}}. Expires in {{expires_minutes}} minutes.' },
  },
  welcome: {
    sms: { enabled: true, body: 'Welcome to Profs Training Solutions, {{user_name}}.' },
    whatsapp: { enabled: true, body: 'Welcome {{user_name}}. Your account is ready.' },
  },
  course_purchase: {
    sms: { enabled: true, body: 'Purchase confirmed: {{course_name}}. Ref: {{order_id}}.' },
    whatsapp: { enabled: true, body: 'Purchase confirmed for {{course_name}}. Reference: {{order_id}}.' },
  },
  payment_confirmation: {
    sms: { enabled: true, body: 'Payment successful: {{payment_amount}}. Ref: {{order_id}}.' },
    whatsapp: { enabled: true, body: 'Payment successful: {{payment_amount}}. Ref: {{order_id}}.' },
  },
  payout_request: {
    sms: { enabled: true, body: 'Your payout request of {{payment_amount}} has been received.' },
    whatsapp: { enabled: true, body: 'Your payout request of {{payment_amount}} has been received.' },
  },
  payout_status: {
    sms: { enabled: true, body: 'Payout update: your request is now {{payout_status}}.' },
    whatsapp: { enabled: true, body: 'Payout update: your request is now {{payout_status}}.' },
  },
  subscription_renewal: {
    sms: { enabled: true, body: 'Subscription renewed. Amount: {{payment_amount}}. Next due: {{next_due_date}}.' },
    whatsapp: { enabled: true, body: 'Subscription renewed. Amount: {{payment_amount}}. Next due: {{next_due_date}}.' },
  },
  refund: {
    sms: { enabled: true, body: 'Refund processed: {{payment_amount}} for {{course_name}}.' },
    whatsapp: { enabled: true, body: 'Refund processed: {{payment_amount}} for {{course_name}}.' },
  },
  live_class_scheduled: {
    sms: { enabled: true, body: '{{live_class_title}} is scheduled for {{class_time}}. Link: {{zoom_link}}' },
    whatsapp: { enabled: true, body: '{{live_class_title}} is scheduled for {{class_time}}. Join: {{zoom_link}}' },
  },
  live_class_reminder: {
    sms: { enabled: true, body: 'Reminder: {{live_class_title}} starts in {{reminder_countdown}}. Link: {{zoom_link}}' },
    whatsapp: { enabled: true, body: 'Reminder: {{live_class_title}} starts in {{reminder_countdown}}. Join: {{zoom_link}}' },
  },
  password_reset: {
    sms: { enabled: true, body: 'Password reset requested. Use code {{otp_code}} or your reset link.' },
    whatsapp: { enabled: true, body: 'Password reset requested. Use code {{otp_code}} or your reset link.' },
  },
  broadcast: {
    sms: { enabled: true, body: '{{message}}' },
    whatsapp: { enabled: true, body: '{{message}}' },
  },
  newsletter: {
    sms: { enabled: true, body: '{{message}}' },
    whatsapp: { enabled: true, body: '{{message}}' },
  },
};

function renderTemplate(raw: string, metadata: Record<string, unknown>): string {
  return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = metadata[key];
    return value == null ? '' : String(value);
  });
}

async function resolveChannelMessage(eventKey: EventKey, channel: Channel, fallbackMessage: string, metadata: Record<string, unknown>) {
  const defaults = defaultTemplates[eventKey]?.[channel];
  let templateBody = defaults?.body || fallbackMessage;
  let enabled = defaults?.enabled ?? true;
  try {
    const snap = await adminDb.doc(TEMPLATE_DOC_PATH).get();
    if (snap.exists) {
      const data = snap.data() as any;
      const custom = data?.[eventKey]?.[channel];
      if (typeof custom?.body === 'string' && custom.body.trim()) {
        templateBody = custom.body;
      }
      if (typeof custom?.enabled === 'boolean') {
        enabled = custom.enabled;
      }
    }
  } catch {
    // fall back to defaults
  }
  return { enabled, message: renderTemplate(templateBody, metadata) };
}

function nextBackoffMs(retryCount: number): number {
  const clamped = Math.max(0, Math.min(6, retryCount));
  return 60_000 * Math.pow(2, clamped);
}

function normalizeEmailAddress(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function resolveCommunicationEmailFrom(): string | undefined {
  const direct = readEnv('APP_EMAIL_FROM');
  if (direct) return direct;
  const domain = readEnv('APP_EMAIL_DOMAIN');
  return domain ? `noreply@${domain}` : undefined;
}

async function sendCommunicationEmail(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = readEnv('RESEND_API_KEY');
  const to = normalizeEmailAddress(args.to);
  const from = resolveCommunicationEmailFrom();
  if (!apiKey) return { ok: false, error: 'resend-not-configured' };
  if (!from) return { ok: false, error: 'sender-not-configured' };
  if (!to) return { ok: false, error: 'missing-email' };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: args.subject,
        text: args.text,
        html: `<div style="font-family:sans-serif;line-height:1.5;white-space:pre-wrap">${args.text.replace(/</g, '&lt;')}</div>`,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: body || `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'email-send-failed' };
  }
}

export function logDispatchFailure(context: string, error: unknown, meta?: Record<string, unknown>) {
  logger.warn(`[Communication] ${context}`, {
    error: error instanceof Error ? error.message : String(error),
    ...meta,
  });
}

async function queueRetryJob(args: {
  eventId: string;
  userId: string;
  channel: Channel;
  phoneNumber?: string;
  email?: string;
  message: string;
  metadata: Record<string, unknown>;
  retryCount: number;
}) {
  const id = `commq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sendAt = new Date(Date.now() + nextBackoffMs(args.retryCount)).toISOString();
  await adminDb.doc(`communicationQueue/${id}`).set({
    id,
    type: 'retry',
    eventId: args.eventId,
    userId: args.userId,
    channel: args.channel,
    phoneNumber: args.phoneNumber || null,
    email: args.email || null,
    message: args.message,
    metadata: args.metadata,
    retryCount: args.retryCount,
    sendAt,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  const compact = phone.replace(/[^\d+]/g, '').trim();
  if (!compact) return null;

  if (compact.startsWith('+233')) {
    const rest = compact.slice(4).replace(/\D/g, '');
    if (rest.length === 9) return `+233${rest}`;
    return null;
  }
  if (compact.startsWith('233')) {
    const rest = compact.slice(3).replace(/\D/g, '');
    if (rest.length === 9) return `+233${rest}`;
    return null;
  }
  if (compact.startsWith('0')) {
    const rest = compact.slice(1).replace(/\D/g, '');
    if (rest.length === 9) return `+233${rest}`;
    return null;
  }
  if (/^\d{9}$/.test(compact)) return `+233${compact}`;
  return null;
}

function toArkeselRecipient(phoneE164: string): string {
  return phoneE164.replace(/^\+/, '');
}

function parseProviderPayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function getArkeselError(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'SMS provider returned an unexpected response.';

  const record = payload as Record<string, unknown>;
  for (const key of ['message', 'error', 'errors', 'status']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (value && typeof value === 'object') return JSON.stringify(value);
  }

  return JSON.stringify(payload);
}

function isArkeselV2SendSuccess(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const status = (payload as Record<string, unknown>).status;
  return typeof status === 'string' && status.toLowerCase() === 'success';
}

function isArkeselLegacySendSuccess(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const code = (payload as Record<string, unknown>).code;
  return typeof code === 'string' && code.toLowerCase() === 'ok';
}

async function sendArkeselSmsV2(
  apiKey: string,
  sender: string,
  to: string,
  message: string,
  schedule?: string
): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      sender,
      message,
      recipients: [toArkeselRecipient(to)],
    };
    if (schedule) body.schedule = schedule;

    const res = await fetch(ARKESEL_SMS_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const raw = await res.text();
    const payload = parseProviderPayload(raw);
    if (!res.ok || !isArkeselV2SendSuccess(payload)) {
      return { ok: false, response: payload, error: getArkeselError(payload) };
    }
    return { ok: true, response: payload };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'SMS request failed.' };
  }
}

async function sendArkeselSmsLegacy(
  apiKey: string,
  sender: string,
  to: string,
  message: string,
  schedule?: string
): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  try {
    const params = new URLSearchParams({
      action: 'send-sms',
      api_key: apiKey,
      to: toArkeselRecipient(to),
      from: sender,
      sms: message,
    });
    if (schedule) params.set('schedule', schedule);

    const res = await fetch(`${ARKESEL_SMS_BASE_URL}?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const raw = await res.text();
    const payload = parseProviderPayload(raw);
    if (!res.ok || !isArkeselLegacySendSuccess(payload)) {
      return { ok: false, response: payload, error: getArkeselError(payload) };
    }
    return { ok: true, response: payload };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'SMS request failed.' };
  }
}

export async function sendQuickChannelTest(
  channel: 'sms' | 'whatsapp',
  toPhoneNumber: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizePhone(toPhoneNumber);
  if (!phone) return { ok: false, error: 'Invalid phone number format.' };

  if (channel === 'sms') {
    const sender = resolveArkeselSmsSenderId();
    const senderValidation = validateArkeselSmsSenderId(sender);
    if (!senderValidation.ok) return { ok: false, error: senderValidation.error };
    const result = await sendArkeselSms(phone, message);
    return { ok: result.ok, error: result.error };
  }

  const wa = await sendArkeselWhatsapp(phone, message);
  return { ok: wa.ok, error: wa.error };
}

function buildPreviewMetadata(
  eventKey: CommunicationEventKey,
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  const samples = getSampleMetadataForEvent(eventKey);
  const merged: Record<string, unknown> = { ...samples };
  for (const [key, value] of Object.entries(metadata || {})) {
    if (value != null && String(value).trim() !== '') {
      merged[key] = value;
    }
  }
  return merged;
}

export async function previewChannelMessage(
  eventKey: CommunicationEventKey,
  channel: CommunicationChannel,
  metadata?: Record<string, unknown>,
  fallbackMessage?: string
): Promise<{ enabled: boolean; message: string; eventKey: CommunicationEventKey; channel: CommunicationChannel }> {
  const meta = buildPreviewMetadata(eventKey, metadata);
  const fallback =
    fallbackMessage ||
    (typeof meta.message === 'string' && meta.message) ||
    `Sample message for ${eventKey}`;
  const rendered = await resolveChannelMessage(eventKey, channel, fallback, meta);
  return { enabled: rendered.enabled, message: rendered.message, eventKey, channel };
}

export async function sendTemplateChannelTest(
  eventKey: CommunicationEventKey,
  channel: 'sms' | 'whatsapp',
  toPhoneNumber: string,
  metadata?: Record<string, unknown>,
  fallbackMessage?: string
): Promise<{ ok: boolean; error?: string; messagePreview?: string }> {
  const preview = await previewChannelMessage(eventKey, channel, metadata, fallbackMessage);
  if (!preview.enabled) {
    return { ok: false, error: 'Template is disabled for this event and channel.', messagePreview: preview.message };
  }
  return sendQuickChannelTest(channel, toPhoneNumber, preview.message);
}

export type SmsTemplatePreviewRow = {
  eventKey: CommunicationEventKey;
  enabled: boolean;
  message: string;
};

export async function previewAllSmsTemplates(
  metadataOverrides?: Partial<Record<CommunicationEventKey, Record<string, string>>>
): Promise<SmsTemplatePreviewRow[]> {
  const rows: SmsTemplatePreviewRow[] = [];
  for (const eventKey of COMMUNICATION_EVENT_KEYS) {
    const overrides = metadataOverrides?.[eventKey];
    const preview = await previewChannelMessage(eventKey, 'sms', overrides);
    rows.push({
      eventKey,
      enabled: preview.enabled,
      message: preview.message,
    });
  }
  return rows;
}

export type SmsTemplateTestResult = {
  eventKey: CommunicationEventKey;
  ok: boolean;
  messagePreview: string;
  error?: string;
  skipped?: boolean;
};

const BULK_SMS_TEST_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendAllSmsTemplateTests(
  toPhoneNumber: string,
  metadataOverrides?: Partial<Record<CommunicationEventKey, Record<string, string>>>
): Promise<{ results: SmsTemplateTestResult[] }> {
  const previews = await previewAllSmsTemplates(metadataOverrides);
  const results: SmsTemplateTestResult[] = [];
  let sentCount = 0;

  for (const row of previews) {
    if (!row.enabled) {
      results.push({
        eventKey: row.eventKey,
        ok: false,
        messagePreview: row.message,
        skipped: true,
        error: 'Template disabled',
      });
      continue;
    }

    if (sentCount > 0) {
      await delay(BULK_SMS_TEST_DELAY_MS);
    }

    const overrides = metadataOverrides?.[row.eventKey];
    const send = await sendTemplateChannelTest(row.eventKey, 'sms', toPhoneNumber, overrides);
    results.push({
      eventKey: row.eventKey,
      ok: send.ok,
      messagePreview: row.message,
      error: send.error,
    });
    if (send.ok) sentCount += 1;
  }

  return { results };
}

async function sendArkeselSms(
  to: string,
  message: string,
  schedule?: string
): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  const { key: apiKey } = resolveArkeselSmsApiKey();
  if (!apiKey) return { ok: false, error: 'ARKESEL_SMS_API_KEY is not configured.' };
  const sender = resolveArkeselSmsSenderId();
  const senderValidation = validateArkeselSmsSenderId(sender);
  if (!senderValidation.ok) return { ok: false, error: senderValidation.error };

  const v2 = await sendArkeselSmsV2(apiKey, sender, to, message, schedule);
  if (v2.ok) return v2;

  logger.warn('[Communication] Arkesel v2 SMS failed; trying legacy send-sms', {
    error: v2.error?.slice(0, 200),
  });

  const legacy = await sendArkeselSmsLegacy(apiKey, sender, to, message, schedule);
  if (legacy.ok) return legacy;

  return { ok: false, response: legacy.response ?? v2.response, error: legacy.error || v2.error };
}

export async function getArkeselSmsBalance(): Promise<{ ok: boolean; balance?: string; response?: unknown; error?: string }> {
  const { key: apiKey } = resolveArkeselSmsApiKey();
  if (!apiKey) return { ok: false, error: 'ARKESEL_SMS_API_KEY is not configured.' };
  try {
    const params = new URLSearchParams({
      action: 'check-balance',
      api_key: apiKey,
      response: 'json',
    });
    const res = await fetch(`${ARKESEL_SMS_BASE_URL}?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const raw = await res.text();
    const payload: any = parseProviderPayload(raw);
    if (!res.ok) return { ok: false, error: JSON.stringify(payload) };
    const balance = typeof payload?.balance === 'string' ? payload.balance : undefined;
    return { ok: true, balance, response: payload };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Balance check failed.' };
  }
}

export async function subscribeArkeselContact(args: {
  phoneBook: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  userName?: string;
}): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  const { key: apiKey } = resolveArkeselSmsApiKey();
  if (!apiKey) return { ok: false, error: 'ARKESEL_SMS_API_KEY is not configured.' };
  const normalized = normalizePhone(args.phoneNumber);
  if (!normalized) return { ok: false, error: 'Invalid phone number format.' };
  try {
    const params = new URLSearchParams({
      action: 'subscribe-us',
      api_key: apiKey,
      phone_book: args.phoneBook,
      phone_number: toArkeselRecipient(normalized),
    });
    if (args.firstName) params.set('first_name', args.firstName);
    if (args.lastName) params.set('last_name', args.lastName);
    if (args.email) params.set('email', args.email);
    if (args.company) params.set('company', args.company);
    if (args.userName) params.set('user_name', args.userName);
    const res = await fetch(`${ARKESEL_CONTACTS_BASE_URL}?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const raw = await res.text();
    const payload = parseProviderPayload(raw);
    if (!res.ok) return { ok: false, error: JSON.stringify(payload) };
    return { ok: true, response: payload };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Contact insert failed.' };
  }
}

async function sendArkeselWhatsapp(to: string, message: string): Promise<{ ok: boolean; response?: unknown; error?: string }> {
  const { key: apiKey } = resolveArkeselWhatsappApiKey();
  const sender = resolveArkeselWhatsappSender();
  if (!apiKey || !sender) return { ok: false, error: 'ARKESEL_WHATSAPP_API_KEY or ARKESEL_WHATSAPP_SENDER is not configured.' };
  try {
    const res = await fetch(`${ARKESEL_WHATSAPP_BASE_URL}/whatsapp/message/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ sender, recipient: to, message }),
      cache: 'no-store',
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: JSON.stringify(payload) };
    return { ok: true, response: payload };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'WhatsApp request failed.' };
  }
}

export type OtpDeliveryChannel = 'email' | 'sms' | 'whatsapp';

export type OtpChannelAvailability = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  /** Channels passed to dispatchCommunication (phone-based). */
  dispatchChannels: Array<'sms' | 'whatsapp'>;
};

/** OTP may use email (Resend), SMS, and/or WhatsApp depending on settings and env. */
export async function resolveAvailableOtpChannels(args: {
  email?: string;
  phoneNumber?: string;
}): Promise<OtpChannelAvailability> {
  const settings = await getGlobalSettings().catch(() => null);
  const phone = normalizePhone(args.phoneNumber);
  const smsKey = resolveArkeselSmsApiKey();
  const smsSenderValidation = validateArkeselSmsSenderId(resolveArkeselSmsSenderId());
  const waKey = resolveArkeselWhatsappApiKey();
  const waSender = resolveArkeselWhatsappSender();

  const email = !!(args.email?.trim() && readEnv('RESEND_API_KEY'));
  const sms = !!(
    phone &&
    settings?.commSmsEnabled !== false &&
    settings?.commOtpSmsEnabled !== false &&
    smsKey.key &&
    smsSenderValidation.ok
  );
  const whatsapp = !!(
    phone &&
    settings?.commWhatsappEnabled &&
    settings?.commOtpWhatsappEnabled !== false &&
    waKey.key &&
    waSender
  );

  const dispatchChannels: Array<'sms' | 'whatsapp'> = [];
  if (sms) dispatchChannels.push('sms');
  if (whatsapp) dispatchChannels.push('whatsapp');

  return { email, sms, whatsapp, dispatchChannels };
}

export async function getArkeselEnvDiagnostics() {
  const sms = resolveArkeselSmsApiKey();
  const whatsapp = resolveArkeselWhatsappApiKey();
  const senderValues = getDiagnosticsSenderValues();
  return {
    smsKeySource: sms.source,
    smsConfigured: !!sms.key,
    smsKeyLength: sms.key ? sms.key.length : 0,
    whatsappKeySource: whatsapp.source,
    whatsappConfigured: !!whatsapp.key,
    whatsappKeyLength: whatsapp.key ? whatsapp.key.length : 0,
    smsSenderConfigured: !!senderValues.smsSender,
    smsSenderId: senderValues.smsSender || null,
    smsSenderValid: senderValues.smsSenderValid,
    smsSenderError: senderValues.smsSenderError || null,
    whatsappSenderConfigured: !!senderValues.waSender,
  };
}

async function writeInAppNotification(userId: string, title: string, message: string, category: string) {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await adminDb.doc(`notifications/${id}`).set({
    id,
    userId,
    title,
    description: message,
    time: new Date().toISOString(),
    read: false,
    category,
  });
}

export async function dispatchCommunication(args: DispatchArgs): Promise<DispatchResult> {
  const settings = await getGlobalSettings().catch(() => null);
  const channels = args.channels || ['email', 'inapp', 'sms', 'whatsapp'];
  const fallbackChannels = args.fallbackChannels || ['inapp', 'email'];
  const eventId = `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const phone = normalizePhone(args.phoneNumber);
  const retryCount = Math.max(0, Number(args.retryCount || 0));
  const retryLimit = Math.max(0, Number(settings?.commRetryLimit || '3'));
  const forceSend = args.forceSend === true;
  const results: DispatchChannelResult[] = [];
  const metadata: Record<string, unknown> = {
    ...(args.metadata || {}),
    message: args.message,
    user_name: (args.metadata?.user_name as string) || args.title || 'Member',
  };

  await adminDb.doc(`communicationEvents/${eventId}`).set({
    id: eventId,
    eventKey: args.eventKey,
    userId: args.userId,
    requestedChannels: channels,
    metadata,
    createdAt: now,
  });

  for (const channel of channels) {
    const attemptId = `${eventId}-${channel}`;
    try {
      if (channel === 'sms') {
        if (!forceSend && !settings?.commSmsEnabled) {
          results.push({ channel, status: 'skipped', reason: 'sms-disabled' });
          continue;
        }
        if (!forceSend && args.eventKey === 'otp' && settings?.commOtpSmsEnabled === false) {
          results.push({ channel, status: 'skipped', reason: 'otp-sms-disabled' });
          continue;
        }
        if (!phone) {
          results.push({ channel, status: 'skipped', reason: 'invalid-phone' });
          continue;
        }
        const rendered = await resolveChannelMessage(args.eventKey, channel, args.message, metadata);
        if (!rendered.enabled) {
          results.push({ channel, status: 'skipped', reason: 'template-disabled' });
          continue;
        }
        const sms = await sendArkeselSms(phone, rendered.message, (metadata.schedule as string) || undefined);
        await adminDb.doc(`communicationAttempts/${attemptId}`).set({
          id: attemptId,
          eventId,
          channel,
          status: sms.ok ? 'sent' : 'failed',
          error: sms.error || null,
          providerResponse: sms.response || null,
          createdAt: now,
        });
        if (!sms.ok && retryCount < retryLimit) {
          await queueRetryJob({
            eventId,
            userId: args.userId,
            channel,
            phoneNumber: phone,
            email: args.email,
            message: args.message,
            metadata,
            retryCount: retryCount + 1,
          });
          results.push({ channel, status: 'queued_retry', error: sms.error || undefined });
        } else if (!sms.ok) {
          results.push({ channel, status: 'failed', error: sms.error || undefined });
          for (const fallback of fallbackChannels) {
            if (fallback === channel) continue;
            await dispatchCommunication({
              ...args,
              channels: [fallback],
              retryCount,
              metadata: { ...metadata, fallback_from: channel },
            });
          }
        } else {
          results.push({ channel, status: 'sent' });
        }
      } else if (channel === 'whatsapp') {
        if (!forceSend && !settings?.commWhatsappEnabled) {
          results.push({ channel, status: 'skipped', reason: 'whatsapp-disabled' });
          continue;
        }
        if (!forceSend && args.eventKey === 'otp' && settings?.commOtpWhatsappEnabled === false) {
          results.push({ channel, status: 'skipped', reason: 'otp-whatsapp-disabled' });
          continue;
        }
        if (!phone) {
          results.push({ channel, status: 'skipped', reason: 'invalid-phone' });
          continue;
        }
        const rendered = await resolveChannelMessage(args.eventKey, channel, args.message, metadata);
        if (!rendered.enabled) {
          results.push({ channel, status: 'skipped', reason: 'template-disabled' });
          continue;
        }
        const wa = await sendArkeselWhatsapp(phone, rendered.message);
        await adminDb.doc(`communicationAttempts/${attemptId}`).set({
          id: attemptId,
          eventId,
          channel,
          status: wa.ok ? 'sent' : 'failed',
          error: wa.error || null,
          providerResponse: wa.response || null,
          createdAt: now,
        });
        if (!wa.ok && retryCount < retryLimit) {
          await queueRetryJob({
            eventId,
            userId: args.userId,
            channel,
            phoneNumber: phone,
            email: args.email,
            message: args.message,
            metadata,
            retryCount: retryCount + 1,
          });
          results.push({ channel, status: 'queued_retry', error: wa.error || undefined });
        } else if (!wa.ok) {
          results.push({ channel, status: 'failed', error: wa.error || undefined });
          for (const fallback of fallbackChannels) {
            if (fallback === channel) continue;
            await dispatchCommunication({
              ...args,
              channels: [fallback],
              retryCount,
              metadata: { ...metadata, fallback_from: channel },
            });
          }
        } else {
          results.push({ channel, status: 'sent' });
        }
      } else if (channel === 'inapp') {
        if (!forceSend && !settings?.commInAppEnabled) {
          results.push({ channel, status: 'skipped', reason: 'inapp-disabled' });
          continue;
        }
        const rendered = await resolveChannelMessage(args.eventKey, channel, args.message, metadata);
        if (!rendered.enabled) {
          results.push({ channel, status: 'skipped', reason: 'template-disabled' });
          continue;
        }
        await writeInAppNotification(args.userId, args.title || 'Notification', rendered.message, args.eventKey);
        await adminDb.doc(`communicationAttempts/${attemptId}`).set({
          id: attemptId,
          eventId,
          channel,
          status: 'sent',
          createdAt: now,
        });
        results.push({ channel, status: 'sent' });
      } else if (channel === 'email') {
        if (!forceSend && !settings?.commEmailEnabled) {
          results.push({ channel, status: 'skipped', reason: 'email-disabled' });
          continue;
        }
        const rendered = await resolveChannelMessage(args.eventKey, channel, args.message, metadata);
        if (!rendered.enabled) {
          results.push({ channel, status: 'skipped', reason: 'template-disabled' });
          continue;
        }
        const to = normalizeEmailAddress(args.email);
        if (!to) {
          results.push({ channel, status: 'skipped', reason: 'missing-email' });
          continue;
        }
        const subject = args.title || `${settings?.siteName || 'Profs Training Solutions'} notification`;
        const mail = await sendCommunicationEmail({ to, subject, text: rendered.message });
        await adminDb.doc(`communicationAttempts/${attemptId}`).set({
          id: attemptId,
          eventId,
          channel,
          status: mail.ok ? 'sent' : 'failed',
          error: mail.error || null,
          messagePreview: rendered.message,
          createdAt: now,
        });
        if (!mail.ok && retryCount < retryLimit) {
          await queueRetryJob({
            eventId,
            userId: args.userId,
            channel,
            phoneNumber: phone || undefined,
            email: to,
            message: args.message,
            metadata,
            retryCount: retryCount + 1,
          });
          results.push({ channel, status: 'queued_retry', error: mail.error || undefined });
        } else if (!mail.ok) {
          results.push({ channel, status: 'failed', error: mail.error || undefined });
        } else {
          results.push({ channel, status: 'sent' });
        }
      }
    } catch (error: any) {
      logger.error('[Communication] Dispatch failed', { eventId, channel, error: error?.message });
      await adminDb.doc(`communicationAttempts/${attemptId}`).set({
        id: attemptId,
        eventId,
        channel,
        status: 'failed',
        error: error?.message || 'Unknown communication failure.',
        createdAt: now,
      });
      results.push({ channel, status: 'failed', error: error?.message || 'Unknown communication failure.' });
    }
  }
  return { eventId, results };
}
