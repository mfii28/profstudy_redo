'use server';

import { apiFetchServer } from '@/lib/api-client.server';

export async function initiateMultipartUpload(key: string, contentType: string, idToken?: string) {
  try {
    return await apiFetchServer('/api/v1/storage/multipart/initiate', {
      method: 'POST',
      body: JSON.stringify({ key, contentType }),
    });
  } catch (err: any) {
    return { error: 'Failed to initiate upload. Please try again.' };
  }
}

export async function getPresignedPartUrls(key: string, uploadId: string, partCount: number, idToken?: string) {
  try {
    return await apiFetchServer('/api/v1/storage/multipart/urls', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId, partCount }),
    });
  } catch (err: any) {
    return { error: 'Failed to generate part URLs. Please try again.' };
  }
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>,
  idToken?: string
) {
  try {
    await apiFetchServer('/api/v1/storage/multipart/complete', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId, parts }),
    });
    return { success: true };
  } catch (err: any) {
    return { error: 'Failed to complete upload. Please try again.' };
  }
}

export async function abortMultipartUpload(key: string, uploadId: string, idToken?: string) {
  try {
    await apiFetchServer('/api/v1/storage/multipart/abort', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId }),
    });
  } catch (err: any) {
    // silently fail
  }
}
