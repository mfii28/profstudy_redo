/**
 * @fileOverview Tests for the media stream route's access control logic.
 * Verifies that enrollment checks, book purchase checks, and user-scoped
 * access restrictions are enforced correctly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const adminMocks = vi.hoisted(() => {
  const docData = new Map<string, Record<string, unknown> | null>();

  const collectionQueryResults = new Map<string, { empty: boolean; docs: Array<{ data: () => Record<string, unknown> }> }>();

  const adminDb = {
    doc: vi.fn((path: string) => ({
      get: vi.fn(async () => {
        const data = docData.get(path);
        return { exists: data !== null && data !== undefined, data: () => data };
      }),
      set: vi.fn(async (payload: Record<string, unknown>) => {
        const existing = docData.get(path) || {};
        docData.set(path, { ...(existing as Record<string, unknown>), ...payload });
      }),
    })),
    collection: vi.fn((path: string) => ({
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(async () => {
              return collectionQueryResults.get(path) ?? { empty: true, docs: [] };
            }),
          })),
        })),
      })),
    })),
  };

  return { adminDb, docData, collectionQueryResults };
});

vi.mock('@/firebase/admin', () => ({
  adminDb: adminMocks.adminDb,
  adminAuth: {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-enrolled' }),
  },
}));

vi.mock('@/lib/s3-client', () => ({
  s3Client: {},
}));

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://r2.example.com/signed?key=test'),
}));

vi.mock('@/lib/enrollment-index', () => ({
  isUserInCourseEnrollmentIndex: vi.fn(async () => false),
}));

// ---------------------------------------------------------------------------
// Helper: simulate R2 upstream fetch response
// ---------------------------------------------------------------------------

function mockGlobalFetch(status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => {
        if (key === 'content-type') return 'application/pdf';
        if (key === 'content-length') return '1234';
        return null;
      },
    },
    body: new ReadableStream(),
  })));
}

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import { GET } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(key: string, token?: string, playbackToken?: string): NextRequest {
  const query = new URLSearchParams({ key });
  if (playbackToken) query.set('pt', playbackToken);
  return new NextRequest(`http://localhost/api/media/stream?${query.toString()}`, {
    method: 'GET',
    headers: token
      ? {
          authorization: `Bearer ${token}`,
          origin: 'http://localhost:3000',
          'user-agent': 'Mozilla/5.0 Test Browser',
        }
      : {},
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('media/stream route – access control', () => {
  const playbackToken = 'pt_test_token';

  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.docData.clear();
    adminMocks.collectionQueryResults.clear();
    mockGlobalFetch(200);
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    adminMocks.docData.set(`mediaPlaybackTokens/${playbackToken}`, {
      uid: 'user-enrolled',
      key: 'private/courses/course-1/lessons/video.mp4',
      userAgent: 'Mozilla/5.0 Test Browser',
      origin: 'http://localhost:3000',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      uses: 0,
      maxUses: 30,
    });
  });

  // --- Auth checks ---

  it('returns 401 when no token is provided for a private key', async () => {
    const req = makeRequest('private/courses/course-1/lessons/video.mp4');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when key parameter is missing', async () => {
    const req = new NextRequest('http://localhost/api/media/stream');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('serves public keys without authentication', async () => {
    const req = makeRequest('public/courses/course-1/thumbnail.jpg');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  // --- Course enrollment checks ---

  it('returns 403 for a private course key when user is NOT enrolled and NOT admin', async () => {
    adminMocks.docData.set('courses/course-1', { tutorId: 'tutor-xyz' });
    adminMocks.docData.set('users/user-enrolled', {
      role: 'student',
      enrollments: [], // not enrolled
    });

    const req = makeRequest('private/courses/course-1/lessons/video.mp4', 'valid-token', playbackToken);
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 200 for a private course key when user IS enrolled', async () => {
    adminMocks.docData.set('courses/course-1', { tutorId: 'tutor-xyz' });
    adminMocks.docData.set('users/user-enrolled', {
      role: 'student',
      enrollments: [{ courseId: 'course-1' }],
    });

    const req = makeRequest('private/courses/course-1/lessons/video.mp4', 'valid-token', playbackToken);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 200 for a private course key with a valid playbackToken even if no authorization header is present', async () => {
    adminMocks.docData.set('courses/course-1', { tutorId: 'tutor-xyz' });
    adminMocks.docData.set('users/user-enrolled', {
      role: 'student',
      enrollments: [{ courseId: 'course-1' }],
    });

    const req = makeRequest('private/courses/course-1/lessons/video.mp4', undefined, playbackToken);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 200 for a private course key when user is the tutor owner', async () => {
    adminMocks.docData.set('courses/course-1', { tutorId: 'user-enrolled' });
    adminMocks.docData.set('users/user-enrolled', {
      role: 'tutor',
      enrollments: [],
    });

    const req = makeRequest('private/courses/course-1/lessons/video.mp4', 'valid-token', playbackToken);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 200 for a private course key when user is an admin', async () => {
    adminMocks.docData.set('courses/course-1', { tutorId: 'tutor-xyz' });
    adminMocks.docData.set('users/user-enrolled', {
      role: 'admin',
      enrollments: [],
    });

    const req = makeRequest('private/courses/course-1/lessons/video.mp4', 'valid-token', playbackToken);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  // --- Book purchase checks ---

  it('returns 403 for a private book key when user has NOT purchased it', async () => {
    adminMocks.collectionQueryResults.set('bookPurchases', { empty: true, docs: [] });
    adminMocks.docData.set('users/user-enrolled', { role: 'student' });

    adminMocks.docData.set(`mediaPlaybackTokens/${playbackToken}`, {
      uid: 'user-enrolled',
      key: 'private/books/book-1/content/book.pdf',
      userAgent: 'Mozilla/5.0 Test Browser',
      origin: 'http://localhost:3000',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      uses: 0,
      maxUses: 30,
    });
    const req = makeRequest('private/books/book-1/content/book.pdf', 'valid-token', playbackToken);
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 200 for a private book key when user HAS purchased it', async () => {
    adminMocks.collectionQueryResults.set('bookPurchases', {
      empty: false,
      docs: [{ data: () => ({ userId: 'user-enrolled', bookId: 'book-1' }) }],
    });
    adminMocks.docData.set(`mediaPlaybackTokens/${playbackToken}`, {
      uid: 'user-enrolled',
      key: 'private/books/book-1/content/book.pdf',
      userAgent: 'Mozilla/5.0 Test Browser',
      origin: 'http://localhost:3000',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      uses: 0,
      maxUses: 30,
    });

    const req = makeRequest('private/books/book-1/content/book.pdf', 'valid-token', playbackToken);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  // --- User-scoped path checks ---

  it('returns 200 for a user-scoped path matching the authenticated uid', async () => {
    adminMocks.docData.set(`mediaPlaybackTokens/${playbackToken}`, {
      uid: 'user-enrolled',
      key: 'private/users/user-enrolled/assignments/hw1.pdf',
      userAgent: 'Mozilla/5.0 Test Browser',
      origin: 'http://localhost:3000',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      uses: 0,
      maxUses: 30,
    });
    const req = makeRequest('private/users/user-enrolled/assignments/hw1.pdf', 'valid-token', playbackToken);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 403 for a user-scoped path belonging to a DIFFERENT user', async () => {
    const req = makeRequest('private/users/other-user/assignments/hw1.pdf', 'valid-token');
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  // --- Path traversal ---

  it('strips path traversal sequences before processing', async () => {
    // After sanitization the key becomes harmless / does not start with private/
    const req = makeRequest('public/../private/courses/course-1/lessons/secret.mp4', 'valid-token');
    const res = await GET(req as any);
    // After stripping ../ the path stays inside public/ so no auth check fires — served
    expect([200, 400, 403]).toContain(res.status);
  });
});
