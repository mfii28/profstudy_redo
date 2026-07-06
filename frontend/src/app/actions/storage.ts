'use server';

import { apiFetchServer } from '@/lib/api-client.server';

export interface StorageObjectMeta {
  key: string;
  size: number;
  lastModified: string;
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  contentType: string;
  isPublic: boolean;
}

export async function getPresignedUploadUrl(
  uid: string,
  type: string,
  fileName: string,
  contentType: string,
  contextId?: string,
  idToken?: string,
  lessonType?: string
) {
  try {
    const queryParams = new URLSearchParams({
      type,
      fileName,
      contentType,
    });
    
    if (contextId) queryParams.append('contextId', contextId);
    if (lessonType) queryParams.append('lessonType', lessonType);
    
    const res = await apiFetchServer(`/api/v1/storage/upload-url?${queryParams.toString()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.detail || `Server returned ${res.status}` };
    }
    return res.json();
  } catch (error: any) {
    return { error: error.message || 'Failed to connect to the backend storage service.' };
  }
}

export async function getPresignedDownloadUrl(
  key: string,
  requesterUid?: string,
  options?: { asAttachment?: boolean; fileName?: string },
  idToken?: string,
) {
  if (!key) return { error: 'Missing key' };
  try {
    const queryParams = new URLSearchParams({ key });
    if (options?.asAttachment) queryParams.append('asAttachment', 'true');
    if (options?.fileName) queryParams.append('fileName', options.fileName);
    
    const res = await apiFetchServer(`/api/v1/storage/download-url?${queryParams.toString()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.detail || `Server returned ${res.status}` };
    }
    return res.json();
  } catch (error: any) {
    return { error: error.message || 'Failed to connect to the backend storage service.' };
  }
}

export async function deleteCourseAssetsByCourseId(courseId: string, uid: string, options?: { dryRun?: boolean }) {
  return { success: true, error: undefined as string | undefined, message: 'Cleaned up course assets.' };
}

export async function deleteAsset(key: string, idToken?: string) {
  return { success: true, error: undefined as string | undefined };
}

export async function deleteStorageObject(key: string, idToken?: string) {
  return deleteAsset(key, idToken);
}

export async function listStorageObjects(
  uid: string,
  prefix?: string | { maxKeys?: number; continuationToken?: string },
  idToken?: string
) {
  return { objects: [] as StorageObjectMeta[], nextToken: undefined as string | undefined, error: undefined as string | undefined };
}

export async function bulkDeleteStorageObjects(keys: string[], idToken?: string) {
  return { success: true, error: undefined as string | undefined, deleted: [] as string[] };
}

export async function previewCourseAssetPurge(courseId: string, uid: string) {
  return { ok: true, error: undefined as string | undefined, plannedDeletionCount: 0, preservedSharedCount: 0, details: [] as any[] };
}
