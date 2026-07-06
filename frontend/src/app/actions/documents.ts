'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';

export async function generateSignedUrl(idToken: string | undefined, path: string) {
  try {
    if (path.startsWith('http')) return path;
    
    // apiFetchServer will inject the __session cookie natively
    const res = await apiFetchServer(`/api/v1/storage/download-url?key=${encodeURIComponent(path)}`);
    return res.url;
  } catch (error: any) {
    logger.error('[Document Security] Access blocked', { error: error.message });
    return { error: 'Access denied.' };
  }
}

export async function generateSignedDownloadUrl(idToken: string | undefined, path: string, fileName?: string) {
  try {
    if (path.startsWith('http')) return path;
    
    let url = `/api/v1/storage/download-url?key=${encodeURIComponent(path)}&asAttachment=true`;
    if (fileName) {
      url += `&fileName=${encodeURIComponent(fileName)}`;
    }
    
    const res = await apiFetchServer(url);
    return res.url;
  } catch (error: any) {
    logger.error('[Document Security] Download access blocked', { error: error.message });
    return { error: 'Access denied.' };
  }
}
