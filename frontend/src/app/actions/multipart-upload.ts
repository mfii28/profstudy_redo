'use server';

import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, ensureR2Cors } from '@/lib/s3-client';
// R2 does not support the AWS SDK v3 automatic CRC32 checksum appended to presigned
// UploadPart URLs. We disable it via the S3RequestPresignerOptions `unhoistableHeaders`
// and by never setting ChecksumAlgorithm on UploadPartCommand.
import { adminAuth } from '@/firebase/admin';

const BUCKET = process.env.R2_BUCKET_NAME || 'profstudymate';
// Maximum presigned part URLs issued per call (guards against abuse)
const MAX_PARTS = 1000;

async function verifyToken(idToken: string): Promise<string | null> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Step 1 – Initiate a multipart upload.
 * Returns an uploadId that must be used in subsequent part uploads and completion.
 * The `key` must have been obtained from getPresignedUploadUrl() first so all
 * access-control checks (path ownership, file type) have already been applied.
 */
export async function initiateMultipartUpload(
  key: string,
  contentType: string,
  idToken: string
): Promise<{ uploadId: string } | { error: string }> {
  if (!key || key.includes('..') || key.includes('\0')) {
    return { error: 'Invalid key.' };
  }

  const uid = await verifyToken(idToken);
  if (!uid) return { error: 'Invalid or expired token.' };

  try {
    await ensureR2Cors();
    const result = await s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
      })
    );
    if (!result.UploadId) return { error: 'R2 did not return an upload ID.' };
    return { uploadId: result.UploadId };
  } catch (err: any) {
    console.error('[Multipart] initiateMultipartUpload error:', err?.message);
    return { error: 'Failed to initiate upload. Please try again.' };
  }
}

/**
 * Step 2 – Get presigned PUT URLs for each part.
 * Parts are numbered 1-based. The browser uses these URLs to PUT each chunk
 * directly to R2 — no data passes through the Next.js server.
 */
export async function getPresignedPartUrls(
  key: string,
  uploadId: string,
  partCount: number,
  idToken: string
): Promise<{ urls: string[] } | { error: string }> {
  if (!key || key.includes('..') || key.includes('\0')) {
    return { error: 'Invalid key.' };
  }
  if (!uploadId) return { error: 'Missing uploadId.' };
  if (!Number.isInteger(partCount) || partCount < 1 || partCount > MAX_PARTS) {
    return { error: `partCount must be between 1 and ${MAX_PARTS}.` };
  }

  const uid = await verifyToken(idToken);
  if (!uid) return { error: 'Invalid or expired token.' };

  try {
    const urls = await Promise.all(
      Array.from({ length: partCount }, (_, i) =>
        getSignedUrl(
          s3Client,
          new UploadPartCommand({
            Bucket: BUCKET,
            Key: key,
            UploadId: uploadId,
            PartNumber: i + 1,
          }),
          { expiresIn: 3600 }
        )
      )
    );
    return { urls };
  } catch (err: any) {
    console.error('[Multipart] getPresignedPartUrls error:', err?.message);
    return { error: 'Failed to generate part URLs. Please try again.' };
  }
}

/**
 * Step 3 – Complete the multipart upload.
 * `parts` must contain { PartNumber, ETag } for every uploaded part, in order.
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>,
  idToken: string
): Promise<{ success: true } | { error: string }> {
  if (!key || key.includes('..') || key.includes('\0')) {
    return { error: 'Invalid key.' };
  }
  if (!uploadId || !parts?.length) return { error: 'Missing uploadId or parts.' };

  const uid = await verifyToken(idToken);
  if (!uid) return { error: 'Invalid or expired token.' };

  try {
    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      })
    );
    return { success: true };
  } catch (err: any) {
    console.error('[Multipart] completeMultipartUpload error:', err?.message);
    return { error: 'Failed to complete upload. Please try again.' };
  }
}

/**
 * Abort a multipart upload (cleanup on client-side error).
 * Failure is silently swallowed — R2 will eventually expire incomplete uploads.
 */
export async function abortMultipartUpload(
  key: string,
  uploadId: string,
  idToken: string
): Promise<void> {
  if (!key || !uploadId) return;
  try {
    const uid = await verifyToken(idToken);
    if (!uid) return;
    await s3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
      })
    );
  } catch {
    // best-effort; R2 cleans up stale multipart uploads automatically
  }
}
