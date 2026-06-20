'use server';

import { z } from 'zod';
import { logger } from '@/lib/logging';
import { adminAuth } from '@/firebase/admin';
import { getPresignedDownloadUrl } from '@/app/actions/storage';

/**
 * @fileOverview Hardened Document Access Service.
 * SECURITY: Enforces server-side context validation to prevent unauthorized link generation.
 */

const pathSchema = z.string().min(1, 'Path is required').refine(
  (path) => !path.includes('..'), 
  { message: 'Path traversal is not allowed' }
);

export async function generateSignedUrl(idToken: string, path: string) {
  try {
    // SECURITY: Verify user is authenticated
    if (!idToken) {
      return { error: 'Authentication required.' };
    }
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return { error: 'Session expired. Please sign in again.' };
    }

    // SECURITY: Validate input
    const validPath = pathSchema.safeParse(path);
    if (!validPath.success) {
      logger.warn('[Document Action] Invalid path provided', {
        errors: validPath.error.issues,
      });
      return { error: 'Invalid document path.' };
    }
    
    if (path.startsWith('http')) {
      return path;
    }

    const result = await getPresignedDownloadUrl(path, decodedToken.uid, undefined, idToken);
    if (!result.url) {
      return { error: result.error || 'Could not generate document preview URL.' };
    }

    logger.info('[Document Action] Signed URL generated', {
      pathLength: path.length,
    });

    return result.url;

  } catch (authError: any) {
    logger.error('[Document Security] Access blocked', {
      errorMessage: authError.message,
    });
    return { error: 'Access denied.' };
  }
}

export async function generateSignedDownloadUrl(idToken: string, path: string, fileName?: string) {
  try {
    if (!idToken) {
      return { error: 'Authentication required.' };
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return { error: 'Session expired. Please sign in again.' };
    }

    const validPath = pathSchema.safeParse(path);
    if (!validPath.success) {
      logger.warn('[Document Action] Invalid path provided for download', {
        errors: validPath.error.issues,
      });
      return { error: 'Invalid document path.' };
    }

    if (path.startsWith('http')) {
      return path;
    }

    const result = await getPresignedDownloadUrl(path, decodedToken.uid, {
      asAttachment: true,
      fileName,
    }, idToken);

    if (!result.url) {
      return { error: result.error || 'Could not generate document download URL.' };
    }

    logger.info('[Document Action] Signed download URL generated', {
      pathLength: path.length,
    });

    return result.url;
  } catch (authError: any) {
    logger.error('[Document Security] Download access blocked', {
      errorMessage: authError.message,
    });
    return { error: 'Access denied.' };
  }
}
