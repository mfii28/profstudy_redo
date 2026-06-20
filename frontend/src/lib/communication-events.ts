/** Shared communication event keys, sample metadata, and admin integration hints. */

export const COMMUNICATION_EVENT_KEYS = [
  'otp',
  'welcome',
  'course_purchase',
  'payment_confirmation',
  'payout_request',
  'payout_status',
  'subscription_renewal',
  'refund',
  'live_class_scheduled',
  'live_class_reminder',
  'password_reset',
  'broadcast',
  'newsletter',
] as const;

export type CommunicationEventKey = (typeof COMMUNICATION_EVENT_KEYS)[number];

export type CommunicationChannel = 'sms' | 'whatsapp' | 'email' | 'inapp';

const BASE_SAMPLES = {
  user_name: 'Kofi Mensah',
  otp_code: '483920',
  expires_minutes: '10',
  payment_amount: 'GHS 150.00',
  course_name: 'Taxation Fundamentals',
  order_id: 'ORD-2026-0042',
  live_class_title: 'Live Revision Session',
  class_time: 'Fri, 7:00 PM',
  reminder_countdown: '15 minutes',
  zoom_link: 'https://zoom.us/j/example',
  payout_status: 'approved',
  next_due_date: '2026-06-01',
  message: 'This is a sample broadcast message from Profs Training Solutions.',
};

export const SAMPLE_METADATA_BY_EVENT: Record<CommunicationEventKey, Record<string, string>> = {
  otp: {
    user_name: BASE_SAMPLES.user_name,
    otp_code: BASE_SAMPLES.otp_code,
    expires_minutes: BASE_SAMPLES.expires_minutes,
  },
  welcome: {
    user_name: BASE_SAMPLES.user_name,
  },
  course_purchase: {
    user_name: BASE_SAMPLES.user_name,
    course_name: BASE_SAMPLES.course_name,
    order_id: BASE_SAMPLES.order_id,
  },
  payment_confirmation: {
    user_name: BASE_SAMPLES.user_name,
    payment_amount: BASE_SAMPLES.payment_amount,
    order_id: BASE_SAMPLES.order_id,
    course_name: BASE_SAMPLES.course_name,
  },
  payout_request: {
    user_name: BASE_SAMPLES.user_name,
    payment_amount: BASE_SAMPLES.payment_amount,
  },
  payout_status: {
    user_name: BASE_SAMPLES.user_name,
    payout_status: BASE_SAMPLES.payout_status,
    payment_amount: BASE_SAMPLES.payment_amount,
  },
  subscription_renewal: {
    user_name: BASE_SAMPLES.user_name,
    payment_amount: BASE_SAMPLES.payment_amount,
    next_due_date: BASE_SAMPLES.next_due_date,
  },
  refund: {
    user_name: BASE_SAMPLES.user_name,
    payment_amount: BASE_SAMPLES.payment_amount,
    course_name: BASE_SAMPLES.course_name,
    order_id: BASE_SAMPLES.order_id,
  },
  live_class_scheduled: {
    user_name: BASE_SAMPLES.user_name,
    live_class_title: BASE_SAMPLES.live_class_title,
    class_time: BASE_SAMPLES.class_time,
    zoom_link: BASE_SAMPLES.zoom_link,
  },
  live_class_reminder: {
    user_name: BASE_SAMPLES.user_name,
    live_class_title: BASE_SAMPLES.live_class_title,
    reminder_countdown: BASE_SAMPLES.reminder_countdown,
    zoom_link: BASE_SAMPLES.zoom_link,
  },
  password_reset: {
    user_name: BASE_SAMPLES.user_name,
    otp_code: BASE_SAMPLES.otp_code,
    message: 'A password reset was requested for your account.',
  },
  broadcast: {
    user_name: BASE_SAMPLES.user_name,
    message: BASE_SAMPLES.message,
  },
  newsletter: {
    user_name: BASE_SAMPLES.user_name,
    message: BASE_SAMPLES.message,
  },
};

export const PLACEHOLDERS_BY_EVENT: Record<CommunicationEventKey, string[]> = {
  otp: ['user_name', 'otp_code', 'expires_minutes'],
  welcome: ['user_name'],
  course_purchase: ['user_name', 'course_name', 'order_id'],
  payment_confirmation: ['user_name', 'payment_amount', 'order_id', 'course_name'],
  payout_request: ['user_name', 'payment_amount'],
  payout_status: ['user_name', 'payout_status', 'payment_amount'],
  subscription_renewal: ['user_name', 'payment_amount', 'next_due_date'],
  refund: ['user_name', 'payment_amount', 'course_name', 'order_id'],
  live_class_scheduled: ['user_name', 'live_class_title', 'class_time', 'zoom_link'],
  live_class_reminder: ['user_name', 'live_class_title', 'reminder_countdown', 'zoom_link'],
  password_reset: ['user_name', 'otp_code', 'message'],
  broadcast: ['user_name', 'message'],
  newsletter: ['user_name', 'message'],
};

export const EVENT_INTEGRATION_HINTS: Record<CommunicationEventKey, string> = {
  otp: 'Login / email verification — email, SMS, or WhatsApp when each is configured',
  welcome: 'New user profile bootstrap',
  course_purchase: 'Checkout fulfillment after payment',
  payment_confirmation: 'Checkout fulfillment after payment',
  payout_request: 'Tutor payout request submitted',
  payout_status: 'Admin updates payout status',
  subscription_renewal: 'Subscription renewal events',
  refund: 'Refund processed',
  live_class_scheduled: 'Zoom live class created',
  live_class_reminder: 'Scheduled live class reminders',
  password_reset: 'Password reset requested',
  broadcast: 'Admin announcements & notifications',
  newsletter: 'Newsletter / bulk messaging',
};

export function getSampleMetadataForEvent(
  eventKey: CommunicationEventKey,
  overrides?: Record<string, string>
): Record<string, string> {
  return { ...SAMPLE_METADATA_BY_EVENT[eventKey], ...(overrides || {}) };
}

export function formatEventLabel(eventKey: CommunicationEventKey): string {
  return eventKey
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
