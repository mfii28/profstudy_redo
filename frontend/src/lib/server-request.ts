import { headers } from 'next/headers';

if (typeof window !== 'undefined') {
  throw new Error('src/lib/server-request.ts must only be imported on the server.');
}

const TRUSTED_HOST_SUFFIXES = [
  'localhost',
  '127.0.0.1',
  'cloudworkstations.dev',
  'replit.dev',
  'profstrainingsolutions.com',
  'mytestingdomain.icu',
];

function parseHostname(value?: string): string | null {
  if (!value) return null;

  try {
    const normalized = value.includes('://') ? value : `https://${value}`;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return normalizeHost(value);
  }
}

function getTrustedHostSuffixes(): string[] {
  const configured = (process.env.TRUSTED_HOST_SUFFIXES || '')
    .split(',')
    .map((item) => normalizeHost(item))
    .filter((item): item is string => Boolean(item));

  const baseUrlHost = parseHostname(process.env.NEXT_PUBLIC_BASE_URL);
  const r2PublicHost = parseHostname(process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN);

  return Array.from(
    new Set([
      ...TRUSTED_HOST_SUFFIXES,
      ...configured,
      ...(baseUrlHost ? [baseUrlHost] : []),
      ...(r2PublicHost ? [r2PublicHost] : []),
    ])
  );
}

function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase().split(':')[0];
}

export function isTrustedHost(host: string | null): boolean {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return false;

  return getTrustedHostSuffixes().some(
    (suffix) => normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)
  );
}

export async function validateTrustedServerContext(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get('x-forwarded-host');
  const host = forwardedHost || requestHeaders.get('host');

  // Development can run behind varying local hostnames/ports.
  if (process.env.NODE_ENV !== 'production') {
    return normalizeHost(host) || 'development';
  }

  if (!isTrustedHost(host)) {
    throw new Error(`Unauthorized host: ${host || 'unknown'}`);
  }

  return normalizeHost(host) || 'unknown';
}