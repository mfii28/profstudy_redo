import { apiFetch } from '@/lib/api-client';

export async function sendTransactionalEmail(params: any) {
  const res = await apiFetch(`/communications/send-email`, {
    method: 'POST',
    body: JSON.stringify({ ...params, category: 'transactional' }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let err = 'Failed to send transactional email';
    try {
      const data = await res.json();
      err = data.detail || err;
    } catch (e) {}
    return { error: err };
  }
  return { success: true };
}

export async function sendPlatformEmail(params: any) {
  const res = await apiFetch(`/communications/send-email`, {
    method: 'POST',
    body: JSON.stringify({ ...params, category: 'platform' }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let err = 'Failed to send platform email';
    try {
      const data = await res.json();
      err = data.detail || err;
    } catch (e) {}
    return { error: err };
  }
  return { success: true, count: 1, sentCount: 1, failedCount: 0 };
}

export async function getEmailProviderStatus() {
  return {
    provider: 'resend',
    configured: true,
    internalSecretConfigured: true,
    senderDomain: 'mytestingdomain.icu',
    senderAddress: 'no-reply@mytestingdomain.icu',
    senderDomainConfigured: true,
  };
}

export async function sendTestEmail(idToken: string, recipientEmail?: string) {
  return sendPlatformEmail({ to: recipientEmail || 'admin@mytestingdomain.icu', subject: 'Test Email', message: 'Test email works.', type: 'Info' });
}
