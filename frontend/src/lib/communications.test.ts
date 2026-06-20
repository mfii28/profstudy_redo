import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const docSet = vi.fn();

vi.mock('@/firebase/admin', () => ({
  adminDb: {
    doc: (path: string) => ({
      get: async () => {
        if (path === 'platformContent/communication-templates') {
          return { exists: false, data: () => ({}) };
        }
        return { exists: false, data: () => ({}) };
      },
      set: docSet,
    }),
  },
}));

vi.mock('@/lib/platform-settings-data', () => ({
  getGlobalSettings: async () => ({
    commSmsEnabled: true,
    commOtpSmsEnabled: true,
    commRetryLimit: '0',
  }),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('dispatchCommunication Arkesel SMS', () => {
  beforeEach(() => {
    vi.resetModules();
    docSet.mockClear();
    vi.stubGlobal('fetch', vi.fn());
    process.env.ARKESEL_SMS_API_KEY = 'test-api-key';
    process.env.ARKESEL_SMS_SENDER_ID = 'PROFS';
    delete process.env.ARKESEL_API_KEY;
  });

  afterEach(() => {
    delete process.env.ARKESEL_SMS_API_KEY;
    delete process.env.ARKESEL_SMS_SENDER_ID;
    vi.unstubAllGlobals();
  });

  it('sends SMS through Arkesel v2 with a non-empty rendered message', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: [{ recipient: '233501028466', id: 'sms-1' }] }), {
        status: 200,
      })
    );
    const { dispatchCommunication } = await import('@/lib/communications');

    const result = await dispatchCommunication({
      eventKey: 'broadcast',
      userId: 'user-1',
      channels: ['sms'],
      phoneNumber: '0501028466',
      message: 'Arkesel SMS integration test',
      forceSend: true,
    });

    expect(result.results).toEqual([{ channel: 'sms', status: 'sent' }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));

    expect(url).toBe('https://sms.arkesel.com/api/v2/sms/send');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      'api-key': 'test-api-key',
    });
    expect(body).toEqual({
      sender: 'PROFS',
      message: 'Arkesel SMS integration test',
      recipients: ['233501028466'],
    });
  });

  it('falls back to legacy send-sms when v2 fails', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'error', message: 'v2 unavailable' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'ok', message: 'Successfully Sent' }), { status: 200 })
      );
    const { dispatchCommunication } = await import('@/lib/communications');

    const result = await dispatchCommunication({
      eventKey: 'broadcast',
      userId: 'user-1',
      channels: ['sms'],
      phoneNumber: '0501028466',
      message: 'Arkesel SMS integration test',
      forceSend: true,
    });

    expect(result.results).toEqual([{ channel: 'sms', status: 'sent' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const legacyUrl = String(fetchMock.mock.calls[1]![0]);
    expect(legacyUrl).toContain('https://sms.arkesel.com/sms/api?');
    expect(legacyUrl).toContain('action=send-sms');
    expect(legacyUrl).toContain('api_key=test-api-key');
    expect(legacyUrl).toContain('from=PROFS');
    expect(legacyUrl).toContain('sms=Arkesel');
  });

  it('rejects sender IDs that are 11 characters or longer', async () => {
    process.env.ARKESEL_SMS_SENDER_ID = 'TOOLONGSEND';
    const { dispatchCommunication } = await import('@/lib/communications');

    const result = await dispatchCommunication({
      eventKey: 'broadcast',
      userId: 'user-1',
      channels: ['sms'],
      phoneNumber: '0501028466',
      message: 'Sender ID validation test',
      forceSend: true,
    });

    expect(result.results).toEqual([
      {
        channel: 'sms',
        status: 'failed',
        error: 'SMS sender ID must be less than 11 characters (current length: 11).',
      },
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('treats an Arkesel error payload as a failed send even when HTTP is ok', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'error', message: 'Invalid sender ID' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'error', message: 'Invalid sender ID' }), { status: 200 }));
    const { dispatchCommunication } = await import('@/lib/communications');

    const result = await dispatchCommunication({
      eventKey: 'broadcast',
      userId: 'user-1',
      channels: ['sms'],
      phoneNumber: '0501028466',
      message: 'Arkesel SMS integration test',
      forceSend: true,
    });

    expect(result.results).toEqual([{ channel: 'sms', status: 'failed', error: 'Invalid sender ID' }]);
  });
});

describe('resolveAvailableOtpChannels', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = 're_test';
    process.env.ARKESEL_SMS_API_KEY = 'test-api-key';
    process.env.ARKESEL_SMS_SENDER_ID = 'PROFS';
    delete process.env.ARKESEL_WHATSAPP_API_KEY;
    delete process.env.ARKESEL_WHATSAPP_SENDER;
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.ARKESEL_SMS_API_KEY;
    delete process.env.ARKESEL_SMS_SENDER_ID;
    vi.unstubAllGlobals();
  });

  it('enables email, sms, and whatsapp when each is configured', async () => {
    process.env.ARKESEL_WHATSAPP_API_KEY = 'wa-key';
    process.env.ARKESEL_WHATSAPP_SENDER = '15551234567';
    vi.doMock('@/lib/platform-settings-data', () => ({
      getGlobalSettings: async () => ({
        commSmsEnabled: true,
        commOtpSmsEnabled: true,
        commWhatsappEnabled: true,
        commOtpWhatsappEnabled: true,
      }),
    }));

    const { resolveAvailableOtpChannels } = await import('@/lib/communications');
    const availability = await resolveAvailableOtpChannels({
      email: 'user@example.com',
      phoneNumber: '0501028466',
    });

    expect(availability.email).toBe(true);
    expect(availability.sms).toBe(true);
    expect(availability.whatsapp).toBe(true);
    expect(availability.dispatchChannels).toEqual(['sms', 'whatsapp']);
  });
});

describe('template preview and test sends', () => {
  beforeEach(() => {
    vi.resetModules();
    docSet.mockClear();
    vi.stubGlobal('fetch', vi.fn());
    process.env.ARKESEL_SMS_API_KEY = 'test-api-key';
    process.env.ARKESEL_SMS_SENDER_ID = 'PROFS';
    delete process.env.ARKESEL_API_KEY;
  });

  afterEach(() => {
    delete process.env.ARKESEL_SMS_API_KEY;
    delete process.env.ARKESEL_SMS_SENDER_ID;
    vi.unstubAllGlobals();
  });

  it('previewChannelMessage renders OTP and broadcast placeholders', async () => {
    const { previewChannelMessage } = await import('@/lib/communications');

    const otp = await previewChannelMessage('otp', 'sms', {
      user_name: 'Ada',
      otp_code: '112233',
      expires_minutes: '5',
    });
    expect(otp.enabled).toBe(true);
    expect(otp.message).toContain('112233');
    expect(otp.message).toContain('Ada');

    const broadcast = await previewChannelMessage('broadcast', 'sms', {
      message: 'Hello class',
    });
    expect(broadcast.message).toBe('Hello class');
  });

  it('sendTemplateChannelTest sends rendered template via mocked fetch', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success' }), { status: 200 })
    );
    const { sendTemplateChannelTest } = await import('@/lib/communications');

    const result = await sendTemplateChannelTest('otp', 'sms', '0501028466', {
      user_name: 'Kofi',
      otp_code: '999888',
      expires_minutes: '10',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body.message).toContain('999888');
    expect(body.message).toContain('Kofi');
  });

  it('sendAllSmsTemplateTests skips disabled templates', async () => {
    vi.resetModules();
    vi.doMock('@/firebase/admin', () => ({
      adminDb: {
        doc: (path: string) => ({
          get: async () => {
            if (path === 'platformContent/communication-templates') {
              return {
                exists: true,
                data: () => ({
                  otp: {
                    sms: { enabled: false, body: 'Disabled OTP {{otp_code}}' },
                  },
                }),
              };
            }
            return { exists: false, data: () => ({}) };
          },
          set: docSet,
        }),
      },
    }));
    vi.doMock('@/lib/platform-settings-data', () => ({
      getGlobalSettings: async () => ({
        commSmsEnabled: true,
        commOtpSmsEnabled: true,
        commRetryLimit: '0',
      }),
    }));
    vi.doMock('@/lib/logging', () => ({
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    }));

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success' }), { status: 200 })
    );

    const { previewChannelMessage, sendAllSmsTemplateTests } = await import('@/lib/communications');
    const otpPreview = await previewChannelMessage('otp', 'sms', {
      otp_code: '000111',
      user_name: 'Test',
      expires_minutes: '5',
    });
    expect(otpPreview.enabled).toBe(false);

    const { results } = await sendAllSmsTemplateTests('0501028466');
    const otpResult = results.find((r) => r.eventKey === 'otp');
    expect(otpResult?.skipped).toBe(true);
    expect(otpResult?.ok).toBe(false);

    const smsBodies = fetchMock.mock.calls
      .map((call) => {
        const init = call[1] as RequestInit | undefined;
        if (init?.body && typeof init.body === 'string') {
          try {
            return JSON.parse(init.body).message as string;
          } catch {
            return '';
          }
        }
        return String(call[0]);
      })
      .join(' ');
    expect(smsBodies).not.toContain('000111');
  });
});
