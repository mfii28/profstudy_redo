import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (typeof window !== 'undefined') {
  throw new Error('src/firebase/admin.ts must only be imported on the server.');
}

/**
 * @fileOverview Firebase Admin SDK singleton for privileged server-side operations.
 * SECURITY: Never import this module from client-side or 'use client' code.
 * Uses FIREBASE_ADMIN_CREDENTIALS env var (base64-encoded or raw JSON service account).
 * Falls back to applicationDefault() for GCP/Firebase App Hosting environments.
 */

function normalizePrivateKey(raw: string): string {
  return raw
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\\\r/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function parseAdminCredentials(): {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  privateKeyId?: string;
  clientId?: string;
} | null {
  const serviceAccountJson = process.env.FIREBASE_ADMIN_CREDENTIALS;

  if (serviceAccountJson) {
    try {
      const normalized = serviceAccountJson.trim();
      const unwrapped =
        normalized.startsWith('"') && normalized.endsWith('"')
          ? normalized.slice(1, -1)
          : normalized;

      let parsed: any;
      if (unwrapped.startsWith('{')) {
        // Some env files store JSON with escaped quotes, e.g. {\"type\":...}
        let jsonCandidate = unwrapped.includes('\\"') ? unwrapped.replace(/\\"/g, '"') : unwrapped;
        // Replace literal control newlines within the private_key field value with escaped newlines so JSON.parse doesn't throw.
        jsonCandidate = jsonCandidate.replace(/"private_key"\s*:\s*"([\s\S]+?)"/g, (match, keyContent) => {
          const sanitizedKey = keyContent.replace(/\n/g, '\\n').replace(/\r/g, '');
          return `"private_key": "${sanitizedKey}"`;
        });
        try {
          parsed = JSON.parse(jsonCandidate);
        } catch {
          // Recover from malformed escape sequences in pasted env JSON values.
          const repairedCandidate = jsonCandidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
          parsed = JSON.parse(repairedCandidate);
        }
      } else {
        parsed = JSON.parse(Buffer.from(unwrapped, 'base64').toString('utf8'));
      }

      // Check if credentials contain placeholder values
      const privateKey = parsed.private_key || '';
      if (privateKey.includes('...') || privateKey === '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n') {
        return null; // Treat as missing/placeholder
      }

      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: normalizePrivateKey(String(parsed.private_key || '')),
        privateKeyId: parsed.private_key_id,
        clientId: parsed.client_id,
      };
    } catch (err) {
      // Last-resort recovery for malformed JSON blobs copied into env files.
      const normalizedBlob = serviceAccountJson.replace(/\\"/g, '"');
      const pickField = (field: string): string | undefined => {
        const match = normalizedBlob.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"`));
        return match?.[1];
      };

      const clientEmailFromBlob = pickField('client_email');
      const privateKeyFromBlob = pickField('private_key');
      if (clientEmailFromBlob && privateKeyFromBlob) {
        return {
          projectId: pickField('project_id') || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: clientEmailFromBlob,
          privateKey: normalizePrivateKey(privateKeyFromBlob),
          privateKeyId: pickField('private_key_id') || process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
          clientId: pickField('client_id') || process.env.FIREBASE_ADMIN_CLIENT_ID,
        };
      }

      const looksLikePlaceholder =
        serviceAccountJson.includes('...') ||
        serviceAccountJson.includes('-----BEGIN PRIVATE KEY-----\\n...');
      if (!looksLikePlaceholder) {
        console.error('[Firebase Admin] Failed to parse FIREBASE_ADMIN_CREDENTIALS:', err);
      }
    }
  }

  // Alternative split env vars for local/dev reliability.
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (clientEmail && privateKeyRaw) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail,
      privateKey: normalizePrivateKey(privateKeyRaw),
      privateKeyId: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
      clientId: process.env.FIREBASE_ADMIN_CLIENT_ID,
    };
  }

  return null;
}

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  try {
    const credentials = parseAdminCredentials();
    if (credentials?.clientEmail && credentials?.privateKey) {
      return initializeApp({
        credential: cert({
          projectId: credentials.projectId || projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
        }),
        projectId,
      });
    }
  } catch (error) {
    // Log error but continue; fall back to projectId-only init
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Firebase Admin] Credential initialization failed, falling back:', error);
    }
  }

  // In local/dev, fail fast with a clear setup message instead of opaque ADC errors.
  if (process.env.NODE_ENV !== 'production') {
    const hasCredentials = !!parseAdminCredentials();
    if (!hasCredentials) {
      throw new Error(
        '[Firebase Admin] Missing credentials. Set FIREBASE_ADMIN_CREDENTIALS (JSON/base64) or FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY in .env.local.'
      );
    }
  }

  // Production hosting may rely on automatic credential resolution (ADC/metadata server).
  return initializeApp({ projectId });
}

let cachedAdminApp: App | null = null;
let initError: Error | null = null;

function getOrInitializeAdminApp(): App {
  if (cachedAdminApp) return cachedAdminApp;
  if (getApps().length > 0) {
    cachedAdminApp = getApps()[0]!;
    return cachedAdminApp;
  }
  
  if (initError) {
    throw initError;
  }
  
  try {
    cachedAdminApp = getAdminApp();
    return cachedAdminApp;
  } catch (error) {
    initError = error as Error;
    throw error;
  }
}

// Eagerly validate Firebase Admin initialization at module load time.
// This ensures configuration errors are caught at startup, not deferred to first use.
function validateAdminInitialization(): void {
  try {
    // Attempt to initialize - this will throw if credentials are invalid/missing
    const app = getOrInitializeAdminApp();
    // Verify we can get services (catches most config issues)
    getFirestore(app);
    getAuth(app);
  } catch (error) {
    // Never throw here: importing this module must not crash the whole app.
    // Routes that need Admin (e.g. public course SSR) can fall back to client fetch
    // when credentials are missing locally. Misconfig still surfaces on first real use.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Firebase Admin] Startup validation failed (dev). Server routes using Admin will error until credentials are set:',
        error
      );
    } else {
      console.warn('[Firebase Admin] Deferred initialization (may use ADC):', error);
    }
  }
}

// Best-effort validation at load; failures are logged only (see catch above).
validateAdminInitialization();

// Export Firebase Admin services
// Note: These use the now-initialized app from validateAdminInitialization()
let _adminDb: ReturnType<typeof getFirestore> | null = null;
let _adminAuth: ReturnType<typeof getAuth> | null = null;

export const adminDb = new Proxy(
  {},
  {
    get(target: any, prop: string | symbol) {
      if (!_adminDb) {
        _adminDb = getFirestore(getOrInitializeAdminApp());
      }
      return (_adminDb as any)[prop];
    },
  }
) as ReturnType<typeof getFirestore>;

export const adminAuth = new Proxy(
  {},
  {
    get(target: any, prop: string | symbol) {
      if (!_adminAuth) {
        _adminAuth = getAuth(getOrInitializeAdminApp());
      }
      return (_adminAuth as any)[prop];
    },
  }
) as ReturnType<typeof getAuth>;

export { FieldValue };
