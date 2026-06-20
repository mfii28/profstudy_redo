/**
 * @fileOverview Optional SMS abstraction (phase 2).
 * Configure Arkesel or Twilio via env and extend `sendOptionalSms` with HTTP calls — no SDK bundled by default.
 */

export type SmsSendParams = {
  toE164: string;
  body: string;
};

export type SmsSendResult = { ok: true } | { ok: false; error: string };

/**
 * Sends an SMS when provider env is wired; otherwise succeeds as no-op so signup flows never break.
 */
export async function sendOptionalSms(params: SmsSendParams): Promise<SmsSendResult> {
  void params;
  if (process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER_ID) {
    return { ok: false, error: 'Arkesel integration not enabled in this build (configure HTTP client).' };
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return { ok: false, error: 'Twilio integration not enabled in this build (add REST client or twilio package).' };
  }
  return { ok: true };
}
