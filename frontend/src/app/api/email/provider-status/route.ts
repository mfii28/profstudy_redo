import { NextResponse } from 'next/server';

const DEFAULT_EMAIL_DOMAIN = 'mytestingdomain.icu';

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const angleBracket = trimmed.match(/<([^>]+)>/);
  const raw = angleBracket ? angleBracket[1] : trimmed;
  const lower = raw.trim().toLowerCase();
  return lower.includes('@') ? lower : null;
}

export async function GET() {
  const resendConfigured =
    typeof process.env.RESEND_API_KEY === 'string' &&
    process.env.RESEND_API_KEY.trim().length > 0;
  const internalSecretConfigured =
    typeof process.env.INTERNAL_EMAIL_SECRET === 'string' &&
    process.env.INTERNAL_EMAIL_SECRET.trim().length > 0;
  const rawDomain = (process.env.APP_EMAIL_DOMAIN || DEFAULT_EMAIL_DOMAIN)
    .trim()
    .toLowerCase();
  const allowedDomain = rawDomain.includes('@') ? rawDomain.split('@').pop()! : rawDomain;
  const senderAddress = normalizeEmail(process.env.APP_EMAIL_FROM) || `no-reply@${allowedDomain}`;

  const senderDomainConfigured =
    (typeof process.env.APP_EMAIL_FROM === 'string' && process.env.APP_EMAIL_FROM.trim().length > 0) ||
    (typeof process.env.APP_EMAIL_DOMAIN === 'string' && process.env.APP_EMAIL_DOMAIN.trim().length > 0);

  return NextResponse.json({
    provider: 'resend',
    configured: resendConfigured,
    internalSecretConfigured,
    senderDomain: allowedDomain,
    senderAddress,
    senderDomainConfigured,
  });
}
