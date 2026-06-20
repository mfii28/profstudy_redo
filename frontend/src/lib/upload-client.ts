import {
  initiateMultipartUpload,
  getPresignedPartUrls,
  completeMultipartUpload,
  abortMultipartUpload,
} from '@/app/actions/multipart-upload';

// Files at or above this size use parallel multipart upload instead of a single PUT.
// R2 minimum part size is 5 MB (except the last part), so 10 MB is a safe chunk size.
const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per chunk
const MAX_CONCURRENT_PARTS = 3; // upload up to 3 chunks in parallel

// Files smaller than this can use the server proxy as a fallback.
const PROXY_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Upload a file to R2.
 * - Files ≥ 10 MB: parallel multipart upload directly to R2 (fastest, progress-aware).
 * - Files < 10 MB: direct presigned PUT to R2; proxy fallback for files < 50 MB.
 */
export async function uploadToR2(
  url: string,
  file: File | Blob,
  contentType: string,
  options?: {
    key?: string;
    idToken?: string;
    onProgress?: (percent: number) => void;
  }
): Promise<void> {
  const onProgress = options?.onProgress;

  // Large files — use parallel multipart upload (requires key + idToken)
  if (file.size >= MULTIPART_THRESHOLD && options?.key && options?.idToken) {
    await multipartUpload(file, contentType, options.key, options.idToken, onProgress);
    return;
  }

  // Small files — direct presigned PUT with optional proxy fallback
  const isLargeFile = file.size > PROXY_MAX_BYTES;

  if (onProgress) {
    await uploadWithXHR(url, file, contentType, onProgress, isLargeFile ? undefined : options);
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    });

    if (response.ok) return;

    const errBody = await response.text().catch(() => '');
    console.error('[Upload] Direct PUT failed', response.status, errBody);

    if (response.status === 413) {
      throw new Error('File is too large for the current upload path.');
    }

    if (!isLargeFile && options?.key && options?.idToken) {
      await proxyUpload(file, contentType, options.key, options.idToken);
      return;
    }

    throw new Error(`Upload failed (${response.status}). Please try again.`);
  } catch (error: any) {
    if (!isLargeFile && options?.key && options?.idToken) {
      await proxyUpload(file, contentType, options.key, options.idToken);
      return;
    }
    throw new Error(error?.message || 'Upload failed. Please try again.');
  }
}

/**
 * Parallel multipart upload. Splits the file into CHUNK_SIZE chunks and uploads
 * up to MAX_CONCURRENT_PARTS at a time, reporting progress as bytes are sent.
 */
async function multipartUpload(
  file: File | Blob,
  contentType: string,
  key: string,
  idToken: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  // 1. Initiate
  const initResult = await initiateMultipartUpload(key, contentType, idToken);
  if ('error' in initResult) throw new Error(initResult.error);
  const { uploadId } = initResult;

  const totalParts = Math.ceil(file.size / CHUNK_SIZE);

  // 2. Get all presigned part URLs up-front
  const urlsResult = await getPresignedPartUrls(key, uploadId, totalParts, idToken);
  if ('error' in urlsResult) {
    await abortMultipartUpload(key, uploadId, idToken);
    throw new Error(urlsResult.error);
  }
  const { urls } = urlsResult;

  const parts: Array<{ PartNumber: number; ETag: string }> = [];
  let bytesUploaded = 0;

  // 3. Upload parts in parallel batches
  try {
    for (let batchStart = 0; batchStart < totalParts; batchStart += MAX_CONCURRENT_PARTS) {
      const batchEnd = Math.min(batchStart + MAX_CONCURRENT_PARTS, totalParts);
      const batchPromises = Array.from({ length: batchEnd - batchStart }, (_, i) => {
        const partIndex = batchStart + i;
        const partNumber = partIndex + 1;
        const start = partIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        return new Promise<{ PartNumber: number; ETag: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
              // Each part reports its own progress; accumulate across all parts
              const partBytes = e.loaded;
              const chunkStart = partIndex * CHUNK_SIZE;
              const tentativeBytesUploaded = Math.min(
                bytesUploaded + partBytes,
                file.size
              );
              onProgress(Math.round((tentativeBytesUploaded / file.size) * 100));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || '';
              bytesUploaded += chunk.size;
              if (onProgress) onProgress(Math.round((bytesUploaded / file.size) * 100));
              resolve({ PartNumber: partNumber, ETag: etag });
            } else {
              reject(new Error(`Part ${partNumber} failed (${xhr.status}).`));
            }
          });

          xhr.addEventListener('error', () =>
            reject(new Error(`Part ${partNumber} network error.`))
          );

          xhr.open('PUT', urls[partIndex]);
          xhr.send(chunk);
        });
      });

      const batchResults = await Promise.all(batchPromises);
      parts.push(...batchResults);
    }
  } catch (err: any) {
    await abortMultipartUpload(key, uploadId, idToken);
    throw new Error(err?.message || 'Upload failed. Please try again.');
  }

  // Sort parts by PartNumber (required by S3/R2)
  parts.sort((a, b) => a.PartNumber - b.PartNumber);

  // 4. Complete
  const completeResult = await completeMultipartUpload(key, uploadId, parts, idToken);
  if ('error' in completeResult) {
    await abortMultipartUpload(key, uploadId, idToken);
    throw new Error(completeResult.error);
  }

  if (onProgress) onProgress(100);
}

async function uploadWithXHR(
  url: string,
  file: File | Blob,
  contentType: string,
  onProgress: (percent: number) => void,
  options?: { key?: string; idToken?: string }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      if (xhr.status === 413) {
        reject(new Error('File is too large for the current upload path.'));
        return;
      }

      if (options?.key && options?.idToken) {
        try {
          await proxyUpload(file, contentType, options.key, options.idToken, onProgress);
          resolve();
        } catch (err) {
          reject(err);
        }
        return;
      }

      reject(new Error(`Upload failed (${xhr.status}). Please try again.`));
    });

    xhr.addEventListener('error', async () => {
      if (options?.key && options?.idToken) {
        try {
          await proxyUpload(file, contentType, options.key, options.idToken, onProgress);
          resolve();
        } catch (err) {
          reject(err);
        }
        return;
      }
      reject(new Error('Upload failed. Please try again.'));
    });

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

async function proxyUpload(
  file: File | Blob,
  contentType: string,
  key: string,
  idToken: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed (${xhr.status}).`));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Upload failed.')));
      xhr.open('PUT', '/api/media/upload');
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('x-upload-key', key);
      xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);
      xhr.send(file);
    });
  }

  const proxyRes = await fetch('/api/media/upload', {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': contentType,
      'x-upload-key': key,
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (proxyRes.ok) return;

  const proxyBody = await proxyRes.text().catch(() => '');
  throw new Error(`Upload failed (${proxyRes.status}). ${proxyBody || 'Please try again.'}`);
}
