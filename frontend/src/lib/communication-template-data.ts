'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { CommunicationChannel, CommunicationEventKey } from '@/lib/communication-events';

export type { CommunicationChannel, CommunicationEventKey } from '@/lib/communication-events';
export {
  COMMUNICATION_EVENT_KEYS,
  EVENT_INTEGRATION_HINTS,
  PLACEHOLDERS_BY_EVENT,
  SAMPLE_METADATA_BY_EVENT,
  formatEventLabel,
  getSampleMetadataForEvent,
} from '@/lib/communication-events';

export type CommunicationTemplate = {
  name: string;
  enabled: boolean;
  body: string;
};

export type CommunicationTemplates = Record<CommunicationEventKey, Record<CommunicationChannel, CommunicationTemplate>>;

const COLLECTION_ID = 'platformContent';
const DOC_ID = 'communication-templates';

const base = (name: string, body: string): CommunicationTemplate => ({ name, enabled: true, body });

export const defaultCommunicationTemplates: CommunicationTemplates = {
  otp: {
    sms: base('OTP SMS', 'Hi {{user_name}}, your OTP is {{otp_code}}. It expires in {{expires_minutes}} minutes.'),
    whatsapp: base('OTP WhatsApp', 'Hello {{user_name}}, your verification code is {{otp_code}}. Expires in {{expires_minutes}} minutes.'),
    email: base('OTP Email', 'Your OTP code is {{otp_code}}.'),
    inapp: base('OTP In-App', 'Use OTP {{otp_code}} to continue.'),
  },
  welcome: {
    sms: base('Welcome SMS', 'Welcome to Profs Training Solutions, {{user_name}}.'),
    whatsapp: base('Welcome WhatsApp', 'Welcome {{user_name}}. Your account is ready.'),
    email: base('Welcome Email', 'Welcome {{user_name}}.'),
    inapp: base('Welcome In-App', 'Welcome to the platform, {{user_name}}.'),
  },
  course_purchase: {
    sms: base('Course Purchase SMS', 'Purchase confirmed: {{course_name}}. Ref: {{order_id}}.'),
    whatsapp: base('Course Purchase WhatsApp', 'Great news {{user_name}}. Your purchase for {{course_name}} is confirmed.'),
    email: base('Course Purchase Email', 'Purchase confirmed for {{course_name}}.'),
    inapp: base('Course Purchase In-App', 'Your purchase for {{course_name}} is confirmed.'),
  },
  payment_confirmation: {
    sms: base('Payment SMS', 'Payment of {{payment_amount}} successful. Ref: {{order_id}}.'),
    whatsapp: base('Payment WhatsApp', 'Payment successful: {{payment_amount}}. Ref: {{order_id}}.'),
    email: base('Payment Email', 'Your payment was successful.'),
    inapp: base('Payment In-App', 'Payment confirmation: {{payment_amount}}.'),
  },
  payout_request: {
    sms: base('Payout Request SMS', 'Your payout request of {{payment_amount}} has been received.'),
    whatsapp: base('Payout Request WhatsApp', 'Your payout request of {{payment_amount}} has been received.'),
    email: base('Payout Request Email', 'We received your payout request.'),
    inapp: base('Payout Request In-App', 'Payout request submitted: {{payment_amount}}.'),
  },
  payout_status: {
    sms: base('Payout Status SMS', 'Payout update: your request is now {{payout_status}}.'),
    whatsapp: base('Payout Status WhatsApp', 'Payout update: your request is now {{payout_status}}.'),
    email: base('Payout Status Email', 'Your payout status was updated.'),
    inapp: base('Payout Status In-App', 'Payout status: {{payout_status}}.'),
  },
  subscription_renewal: {
    sms: base('Subscription Renewal SMS', 'Subscription renewed. Amount: {{payment_amount}}. Next due: {{next_due_date}}.'),
    whatsapp: base('Subscription Renewal WhatsApp', 'Subscription renewed. Amount: {{payment_amount}}. Next due: {{next_due_date}}.'),
    email: base('Subscription Renewal Email', 'Your subscription was renewed.'),
    inapp: base('Subscription Renewal In-App', 'Subscription renewed until {{next_due_date}}.'),
  },
  refund: {
    sms: base('Refund SMS', 'Refund processed: {{payment_amount}} for {{course_name}}.'),
    whatsapp: base('Refund WhatsApp', 'Refund processed: {{payment_amount}} for {{course_name}}.'),
    email: base('Refund Email', 'Your refund has been processed.'),
    inapp: base('Refund In-App', 'Refund of {{payment_amount}} processed.'),
  },
  live_class_scheduled: {
    sms: base('Live Class Scheduled SMS', '{{live_class_title}} is scheduled on {{class_time}}. Link: {{zoom_link}}'),
    whatsapp: base('Live Class Scheduled WhatsApp', '{{live_class_title}} is scheduled. Time: {{class_time}}. Join: {{zoom_link}}'),
    email: base('Live Class Scheduled Email', 'A new live class was scheduled.'),
    inapp: base('Live Class Scheduled In-App', 'New live class scheduled: {{live_class_title}}.'),
  },
  live_class_reminder: {
    sms: base('Live Class Reminder SMS', 'Reminder: {{live_class_title}} starts in {{reminder_countdown}}. Link: {{zoom_link}}'),
    whatsapp: base('Live Class Reminder WhatsApp', 'Reminder: {{live_class_title}} starts in {{reminder_countdown}}. Join: {{zoom_link}}'),
    email: base('Live Class Reminder Email', 'Your live class starts soon.'),
    inapp: base('Live Class Reminder In-App', '{{live_class_title}} starts in {{reminder_countdown}}.'),
  },
  password_reset: {
    sms: base('Password Reset SMS', 'Use this code to reset your password: {{otp_code}}'),
    whatsapp: base('Password Reset WhatsApp', 'Password reset code: {{otp_code}}'),
    email: base('Password Reset Email', 'Password reset request received.'),
    inapp: base('Password Reset In-App', 'Password reset requested.'),
  },
  broadcast: {
    sms: base('Broadcast SMS', '{{message}}'),
    whatsapp: base('Broadcast WhatsApp', '{{message}}'),
    email: base('Broadcast Email', '{{message}}'),
    inapp: base('Broadcast In-App', '{{message}}'),
  },
  newsletter: {
    sms: base('Newsletter SMS', '{{message}}'),
    whatsapp: base('Newsletter WhatsApp', '{{message}}'),
    email: base('Newsletter Email', '{{message}}'),
    inapp: base('Newsletter In-App', '{{message}}'),
  },
};

export async function getCommunicationTemplates(): Promise<CommunicationTemplates> {
  if (!db) return defaultCommunicationTemplates;
  try {
    const ref = doc(db, COLLECTION_ID, DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, defaultCommunicationTemplates, { merge: true });
      return defaultCommunicationTemplates;
    }
    return { ...defaultCommunicationTemplates, ...(snap.data() as Partial<CommunicationTemplates>) };
  } catch {
    return defaultCommunicationTemplates;
  }
}

export async function saveCommunicationTemplate(
  eventKey: CommunicationEventKey,
  channel: CommunicationChannel,
  payload: Pick<CommunicationTemplate, 'body' | 'enabled'>
): Promise<void> {
  if (!db) return;
  const ref = doc(db, COLLECTION_ID, DOC_ID);
  await setDoc(
    ref,
    {
      [eventKey]: {
        [channel]: payload,
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
