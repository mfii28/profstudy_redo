
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

/**
 * @fileOverview Cloudflare R2 Client Initialization.
 * Profs Training Solutions uses the S3-compatible API for scalable storage.
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.warn('[R2 Storage] Credentials missing from environment variables.');
}

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: ACCESS_KEY_ID || '',
    secretAccessKey: SECRET_ACCESS_KEY || '',
  },
  // R2 does not support AWS SDK v3 automatic CRC32/SHA256 checksums on
  // presigned UploadPart URLs. Setting WHEN_REQUIRED prevents the SDK from
  // automatically injecting x-amz-checksum-* headers into the signature,
  // which would cause R2 to return 403 when the browser omits those headers.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// Ensure R2 bucket has CORS rules that allow direct browser→R2 uploads via
// presigned PUT URLs. Called lazily and cached for the process lifetime.
let corsSyncDone = false;
export async function ensureR2Cors(): Promise<void> {
  if (corsSyncDone) return;
  corsSyncDone = true; // set early to prevent concurrent calls
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket || !ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) return;
  try {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log('[R2 Storage] CORS rules configured on bucket.');
  } catch (err: any) {
    corsSyncDone = false; // allow retry on next request
    console.warn('[R2 Storage] Failed to configure CORS rules:', err?.message);
  }
}
