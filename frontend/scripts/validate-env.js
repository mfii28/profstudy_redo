/**
 * Simple environment validation for CI/CD.
 * Fails the build early if required env vars are missing.
 */

const requiredEnv = [
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_R2_PUBLIC_DOMAIN',
  'R2_ACCOUNT_ID',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'PAYSTACK_SECRET_KEY',
  'RESEND_API_KEY',
  'APP_EMAIL_FROM',
  'APP_EMAIL_DOMAIN',
  'INTERNAL_EMAIL_SECRET',
  'NEXT_PUBLIC_BASE_URL',
  'FIREBASE_ADMIN_CREDENTIALS',
];

const missing = requiredEnv.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach((name) => console.error(` - ${name}`));
  process.exit(1);
}

const hasGoogleKey = !!process.env.GOOGLE_API_KEY || !!process.env.GEMINI_API_KEY;
if (!hasGoogleKey) {
  console.error('Missing required AI environment variable: set GOOGLE_API_KEY or GEMINI_API_KEY.');
  process.exit(1);
}

const appEmailFrom = process.env.APP_EMAIL_FROM;
const appEmailDomain = process.env.APP_EMAIL_DOMAIN;

if (appEmailFrom && appEmailDomain) {
  const normalizedDomain = appEmailDomain.trim().toLowerCase();
  const lowerFrom = appEmailFrom.trim().toLowerCase();
  const domainFromAddress = lowerFrom.includes('@') ? lowerFrom.split('@')[1] : '';

  const isValidDomain = domainFromAddress === normalizedDomain || domainFromAddress.endsWith(`.${normalizedDomain}`);
  if (!isValidDomain) {
    console.error(`APP_EMAIL_FROM (${appEmailFrom}) must use APP_EMAIL_DOMAIN (${appEmailDomain}).`);
    process.exit(1);
  }
}

// Validate FIREBASE_ADMIN_CREDENTIALS can be parsed
const rawCreds = process.env.FIREBASE_ADMIN_CREDENTIALS;
if (rawCreds) {
  try {
    const parsed = rawCreds.startsWith('{')
      ? JSON.parse(rawCreds)
      : JSON.parse(Buffer.from(rawCreds, 'base64').toString('utf8'));
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      console.error('FIREBASE_ADMIN_CREDENTIALS is missing required fields (project_id, private_key, client_email).');
      process.exit(1);
    }
  } catch {
    console.error('FIREBASE_ADMIN_CREDENTIALS is not valid JSON or base64-encoded JSON.');
    process.exit(1);
  }
}

console.log('All required environment variables are present.');

