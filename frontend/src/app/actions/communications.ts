'use server';

import { adminDb } from '@/firebase/admin';
import {
  dispatchCommunication,
  logDispatchFailure,
  getArkeselEnvDiagnostics,
  getArkeselSmsBalance,
  previewAllSmsTemplates,
  previewChannelMessage,
  sendAllSmsTemplateTests,
  sendQuickChannelTest,
  sendTemplateChannelTest,
} from '@/lib/communications';
import { processDueCommunicationQueue } from '@/lib/communication-queue';
import {
  defaultCommunicationTemplates,
  type CommunicationChannel,
  type CommunicationEventKey,
  type CommunicationTemplates,
} from '@/lib/communication-template-data';
import { getTrustedServerContextFromIdToken, isAdminRole } from '@/lib/trusted-server-context';

const TEMPLATE_DOC_PATH = 'platformContent/communication-templates';

export async function loadCommunicationTemplatesAdmin(params: { idToken: string }) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }
  const snap = await adminDb.doc(TEMPLATE_DOC_PATH).get();
  if (!snap.exists) {
    await adminDb.doc(TEMPLATE_DOC_PATH).set(defaultCommunicationTemplates, { merge: true });
    return { success: true, templates: defaultCommunicationTemplates };
  }
  const stored = snap.data() as Partial<CommunicationTemplates>;
  return {
    success: true,
    templates: { ...defaultCommunicationTemplates, ...stored } as CommunicationTemplates,
  };
}

export async function saveCommunicationTemplateAdmin(params: {
  idToken: string;
  eventKey: CommunicationEventKey;
  channel: CommunicationChannel;
  body: string;
  enabled: boolean;
}) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }
  await adminDb.doc(TEMPLATE_DOC_PATH).set(
    {
      [params.eventKey]: {
        [params.channel]: {
          body: params.body,
          enabled: params.enabled,
        },
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return { success: true };
}

export async function getCommunicationProviderStatus() {
  const balance = await getArkeselSmsBalance().catch(() => ({ ok: false } as const));
  const diagnostics = await getArkeselEnvDiagnostics();
  return {
    smsConfigured: diagnostics.smsConfigured,
    smsKeySource: diagnostics.smsKeySource,
    smsKeyLength: diagnostics.smsKeyLength,
    whatsappConfigured: diagnostics.whatsappConfigured,
    whatsappKeySource: diagnostics.whatsappKeySource,
    whatsappKeyLength: diagnostics.whatsappKeyLength,
    smsSenderConfigured: diagnostics.smsSenderConfigured,
    smsSenderId: diagnostics.smsSenderId,
    smsSenderValid: diagnostics.smsSenderValid,
    smsSenderError: diagnostics.smsSenderError,
    whatsappSenderConfigured: diagnostics.whatsappSenderConfigured,
    genericApiKeyConfigured: !!process.env.ARKESEL_API_KEY?.trim(),
    jobsSecretConfigured: !!process.env.INTERNAL_JOBS_SECRET?.trim(),
    smsBalance: balance.ok ? balance.balance || 'available' : null,
  };
}

export async function previewSmsTemplate(params: {
  idToken: string;
  eventKey: CommunicationEventKey;
  channel?: CommunicationChannel;
  metadata?: Record<string, string>;
  fallbackMessage?: string;
}) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }
  const channel = params.channel || 'sms';
  const preview = await previewChannelMessage(params.eventKey, channel, params.metadata, params.fallbackMessage);
  return { success: true, preview };
}

export async function previewAllSmsTemplatesAction(params: {
  idToken: string;
  metadataOverrides?: Partial<Record<CommunicationEventKey, Record<string, string>>>;
}) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }
  const rows = await previewAllSmsTemplates(params.metadataOverrides);
  return { success: true, rows };
}

export async function sendTemplateTestCommunication(params: {
  idToken: string;
  eventKey: CommunicationEventKey;
  channel: 'sms' | 'whatsapp';
  toPhoneNumber: string;
  metadata?: Record<string, string>;
  fallbackMessage?: string;
}) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }
  const result = await sendTemplateChannelTest(
    params.eventKey,
    params.channel,
    params.toPhoneNumber,
    params.metadata,
    params.fallbackMessage
  );
  if (result.ok) {
    return { success: true, status: 'sent', messagePreview: result.messagePreview };
  }
  return {
    error: result.error || `Test ${params.channel.toUpperCase()} did not send.`,
    status: 'failed',
    messagePreview: result.messagePreview,
  };
}

export async function sendAllSmsTemplateTestsAction(params: {
  idToken: string;
  toPhoneNumber: string;
  metadataOverrides?: Partial<Record<CommunicationEventKey, Record<string, string>>>;
}) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }
  const { results } = await sendAllSmsTemplateTests(params.toPhoneNumber, params.metadataOverrides);
  return { success: true, results };
}

export async function sendTestCommunication(params: {
  idToken: string;
  channel: 'sms' | 'whatsapp';
  toPhoneNumber: string;
}) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }
  const message = `Profs Training Solutions ${params.channel.toUpperCase()} test.`;
  const result = await sendQuickChannelTest(params.channel, params.toPhoneNumber, message);

  if (result.ok) {
    return { success: true, status: 'sent' };
  }

  return {
    error: result.error || `Test ${params.channel.toUpperCase()} did not send.`,
    status: 'failed',
  };
}

export async function processCommunicationQueueNow(params: { idToken: string; limit?: number }) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }
  const result = await processDueCommunicationQueue(Math.max(1, Math.min(500, Number(params.limit || 100))));
  return { success: true, ...result };
}

export async function getCommunicationAttempts(params: {
  idToken: string;
  status?: 'all' | 'sent' | 'failed' | 'delegated' | 'queued_retry';
  search?: string;
  limit?: number;
}) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || !isAdminRole(ctx.role)) {
    return { error: 'Unauthorized.' };
  }

  const max = Math.max(1, Math.min(1000, Number(params.limit || 300)));
  const snap = await adminDb
    .collection('communicationAttempts')
    .orderBy('createdAt', 'desc')
    .limit(max)
    .get();

  const search = String(params.search || '').trim().toLowerCase();
  const statusFilter = params.status || 'all';
  type AttemptRow = {
    id: string;
    status?: string;
    eventId?: string;
    channel?: string;
    error?: string;
    [key: string]: unknown;
  };
  const items = snap.docs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as AttemptRow)
    .filter((item: any) => {
      const status = String(item.status || '');
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!search) return true;
      const haystack = `${item.id} ${item.eventId || ''} ${item.channel || ''} ${item.error || ''}`.toLowerCase();
      return haystack.includes(search);
    });

  return { success: true, items };
}

export async function emitUserCommunicationEvent(params: {
  idToken: string;
  userId: string;
  eventKey:
    | 'payout_request'
    | 'payout_status'
    | 'subscription_renewal'
    | 'refund'
    | 'broadcast'
    | 'newsletter';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success) {
    return { error: 'Unauthorized.' };
  }
  const isSelfPayoutRequest = params.eventKey === 'payout_request' && ctx.userId === params.userId;
  const callerRole = ctx.role;
  if (!isAdminRole(callerRole) && !isSelfPayoutRequest) {
    return { error: 'Unauthorized.' };
  }

  const target = await adminDb.doc(`users/${params.userId}`).get();
  if (!target.exists) return { error: 'User not found.' };
  const user = target.data() as { phone_number?: string; email?: string; name?: string } | undefined;

  try {
    await dispatchCommunication({
      eventKey: params.eventKey,
      userId: params.userId,
      title: params.title,
      message: params.message,
      phoneNumber: user?.phone_number,
      email: user?.email,
      metadata: {
        user_name: user?.name || 'Member',
        ...(params.metadata || {}),
      },
    });
  } catch (error) {
    logDispatchFailure('emit-user-event', error, {
      eventKey: params.eventKey,
      userId: params.userId,
    });
    return { error: 'Failed to send communication.' };
  }

  return { success: true };
}
