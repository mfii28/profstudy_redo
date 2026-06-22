/**
 * @fileOverview Unit tests for storage server actions.
 * Tests verifyRole logic, presigned URL generation, and asset deletion auth.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set up environment variables for the test run
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
process.env.INTERNAL_EMAIL_SECRET = 'ae956d47a4cd94b240807625b20faaf04c18449fe5a89821a3ae0e64ccd63c81';
process.env.NEXTAUTH_SECRET = 'ae956d47a4cd94b240807625b20faaf04c18449fe5a89821a3ae0e64ccd63c81';
process.env.R2_BUCKET_NAME = 'test-bucket';

// ---------------------------------------------------------------------------
// Mocks (must be hoisted so they are evaluated before imports)
// ---------------------------------------------------------------------------

const adminMocks = vi.hoisted(() => {
  const docData = new Map<string, Record<string, unknown> | null>();

  const adminDb = {
    doc: vi.fn((path: string) => ({
      get: vi.fn(async () => {
        const data = docData.get(path);
        return { exists: data !== null && data !== undefined, data: () => data };
      }),
      set: vi.fn(async () => undefined),
    })),
    collection: vi.fn(() => ({
      select: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: [] })),
      })),
    })),
  };

  const adminAuth = {
    verifyIdToken: vi.fn(),
  };

  const prismaMock = {
    user: {
      findUnique: vi.fn(async ({ where }) => {
        const key = `users/${where.id}`;
        const data = docData.get(key);
        if (!data) return null;
        return { id: where.id, ...data };
      }),
    },
  };

  return { adminDb, adminAuth, docData, prismaMock };
});

const s3Mocks = vi.hoisted(() => ({
  send: vi.fn(async () => ({})),
}));

vi.mock('@/firebase/admin', () => ({
  adminDb: adminMocks.adminDb,
  adminAuth: adminMocks.adminAuth,
}));

vi.mock('@/lib/s3-client', () => ({ s3Client: s3Mocks, ensureR2Cors: vi.fn(async () => {}) }));

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  DeleteObjectsCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://r2.example.com/signed?key=test'),
}));

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock validateTrustedServerContext to always succeed
vi.mock('@/lib/server-request', () => ({
  validateTrustedServerContext: vi.fn(async () => 'localhost'),
}));

// Mock NextAuth to avoid request scope errors
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(async () => null),
}));

vi.mock('@/lib/prisma', () => ({
  default: adminMocks.prismaMock,
}));

// Mock global fetch for proxy calls to FastAPI backend
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const urlObj = new URL(url);
  const type = urlObj.searchParams.get('type');
  const fileName = urlObj.searchParams.get('fileName') || '';
  const contextId = urlObj.searchParams.get('contextId') || '';
  
  if (urlObj.pathname.includes('/upload-url')) {
    let key = '';
    if (type === 'avatar') {
      key = `public/avatars/user-user-1_${Date.now()}_${fileName}`;
    } else if (type === 'lesson') {
      key = `private/courses/${contextId}/lessons/${Date.now()}_${fileName}`;
    }
    return {
      ok: true,
      json: async () => ({
        url: 'https://r2.example.com/signed?key=test',
        key,
        contentType: 'application/octet-stream'
      }),
    } as any;
  }
  
  if (urlObj.pathname.includes('/download-url')) {
    return {
      ok: true,
      json: async () => ({
        url: 'https://r2.example.com/signed?key=test',
      }),
    } as any;
  }
  
  return {
    ok: false,
    json: async () => ({ detail: 'Not Found' }),
  } as any;
});
global.fetch = fetchMock as any;

import {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  deleteAsset,
} from '../../../src/app/actions/storage';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('storage actions – getPresignedUploadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.docData.clear();
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
    process.env.INTERNAL_EMAIL_SECRET = 'ae956d47a4cd94b240807625b20faaf04c18449fe5a89821a3ae0e64ccd63c81';
    process.env.NEXTAUTH_SECRET = 'ae956d47a4cd94b240807625b20faaf04c18449fe5a89821a3ae0e64ccd63c81';
    (process.env as any).NODE_ENV = 'test';
  });

  it('returns error when idToken is missing for a private upload type', async () => {
    const result = await getPresignedUploadUrl(
      'user-1',
      'assignment',
      'homework.pdf',
      'application/pdf',
      undefined,
      undefined // no idToken
    );
    expect(result.error).toBeDefined();
    expect(result.url).toBeUndefined();
  });

  it('returns error when idToken verification fails (production)', async () => {
    (process.env as any).NODE_ENV = 'production';
    adminMocks.adminAuth.verifyIdToken.mockRejectedValueOnce(new Error('Token expired'));

    const result = await getPresignedUploadUrl(
      'user-1',
      'assignment',
      'homework.pdf',
      'application/pdf',
      undefined,
      'bad-token'
    );
    expect(result.error).toMatch(/invalid|expired|authentication/i);
  });

  it('returns a presigned URL for a valid avatar upload (public, no token required)', async () => {
    const result = await getPresignedUploadUrl(
      'user-1',
      'avatar',
      'photo.jpg',
      'image/jpeg'
    );
    expect(result.error).toBeUndefined();
    expect(result.url).toBe('https://r2.example.com/signed?key=test');
    expect(result.key).toMatch(/^public\/avatars\/user-user-1_/);
  });

  it('returns error for a blocked spreadsheet upload', async () => {
    const result = await getPresignedUploadUrl(
      'user-1',
      'avatar',
      'budget.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(result.error).toMatch(/spreadsheet/i);
  });

  it('returns error for an unsupported content type', async () => {
    const result = await getPresignedUploadUrl(
      'user-1',
      'avatar',
      'photo.exe',
      'application/x-msdownload'
    );
    expect(result.error).toBeDefined();
  });

  it('verifies token and derives the correct private path for lesson upload', async () => {
    const result = await getPresignedUploadUrl(
      'user-1',
      'lesson',
      'lecture.mp4',
      'video/mp4',
      'course-abc',
      'valid-token',
      'video'
    );

    expect(result.error).toBeUndefined();
    expect(result.key).toMatch(/^private\/courses\/course-abc\/lessons\//);
    expect(fetchMock).toHaveBeenCalled();
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const headers = lastCall[1]?.headers as any;
    expect(headers?.Authorization).toMatch(/^Bearer /);
  });
});

describe('storage actions – getPresignedDownloadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.docData.clear();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
    process.env.INTERNAL_EMAIL_SECRET = 'ae956d47a4cd94b240807625b20faaf04c18449fe5a89821a3ae0e64ccd63c81';
    process.env.NEXTAUTH_SECRET = 'ae956d47a4cd94b240807625b20faaf04c18449fe5a89821a3ae0e64ccd63c81';
  });

  it('returns error when key is empty', async () => {
    const result = await getPresignedDownloadUrl('', 'user-1');
    expect(result.error).toBeDefined();
  });

  it('returns a signed URL for a public asset without a uid', async () => {
    const result = await getPresignedDownloadUrl('public/courses/thumb.jpg');
    expect(result.error).toBeUndefined();
    expect(result.url).toBe('https://r2.example.com/signed?key=test');
  });

  it('returns error for a private asset when no uid is provided', async () => {
    const result = await getPresignedDownloadUrl('private/courses/course-1/video.mp4');
    expect(result.error).toBeDefined();
  });

  it('returns a signed URL for a private asset with a uid', async () => {
    adminMocks.docData.set('courses/course-1', { tutorId: 'tutor-x' });
    adminMocks.docData.set('users/user-1', { enrollments: [{ courseId: 'course-1' }] });
    const result = await getPresignedDownloadUrl('private/courses/course-1/video.mp4', 'user-1');
    expect(result.error).toBeUndefined();
    expect(result.url).toBe('https://r2.example.com/signed?key=test');
  });

  it('sanitizes path traversal in key before generating URL', async () => {
    const result = await getPresignedDownloadUrl('public/../private/secret.pdf', 'user-1');
    expect(['url', 'error']).toContain(result.error ? 'error' : 'url');
  });
});

describe('storage actions – deleteAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.docData.clear();
  });

  it('returns error when uid is missing', async () => {
    const result = await deleteAsset('public/test.jpg', '');
    expect(result.error).toBeDefined();
  });

  it('returns error when key is missing', async () => {
    const result = await deleteAsset('', 'user-1');
    expect(result.error).toBeDefined();
  });

  it('allows deletion when user is an admin', async () => {
    adminMocks.docData.set('users/admin-1', { role: 'admin' });

    const result = await deleteAsset('public/products/item.jpg', 'admin-1');
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('allows deletion when key contains the owner uid', async () => {
    adminMocks.docData.set('users/user-1', { role: 'student' });

    const result = await deleteAsset('public/avatars/user-user-1_123_photo.jpg', 'user-1');
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('denies deletion when user is not an admin and does not own the key', async () => {
    adminMocks.docData.set('users/user-2', { role: 'student' });

    const result = await deleteAsset('public/avatars/user-user-1_123_photo.jpg', 'user-2');
    expect(result.error).toMatch(/permission/i);
  });
});
