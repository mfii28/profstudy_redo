import 'server-only';

import { adminDb, FieldValue } from '@/firebase/admin';

const ENROLLMENT_ROOT = 'courseEnrollments';
const MEMBERS_SUBCOLLECTION = 'members';

export type EnrollmentIndexSource = 'paystack' | 'free-enroll' | 'admin' | 'migration' | 'sync';

function normalizeId(value: string): string {
  return (value || '').trim();
}

function memberRef(courseId: string, userId: string) {
  return adminDb
    .collection(ENROLLMENT_ROOT)
    .doc(normalizeId(courseId))
    .collection(MEMBERS_SUBCOLLECTION)
    .doc(normalizeId(userId));
}

function courseMetaRef(courseId: string) {
  return adminDb.collection(ENROLLMENT_ROOT).doc(normalizeId(courseId));
}

export async function addUserToCourseEnrollmentIndex(
  courseId: string,
  userId: string,
  source: EnrollmentIndexSource,
): Promise<void> {
  const now = new Date().toISOString();
  const cId = normalizeId(courseId);
  const uId = normalizeId(userId);
  if (!cId || !uId) return;

  const ref = memberRef(cId, uId);
  const existing = await ref.get();
  await ref.set(
    {
      userId: uId,
      courseId: cId,
      source,
      enrolledAt: existing.exists ? existing.data()?.enrolledAt || now : now,
      updatedAt: now,
    },
    { merge: true },
  );

  await courseMetaRef(cId).set(
    {
      courseId: cId,
      updatedAt: now,
      ...(existing.exists ? {} : { memberCount: FieldValue.increment(1) }),
    },
    { merge: true },
  );
}

export async function removeUserFromCourseEnrollmentIndex(
  courseId: string,
  userId: string,
): Promise<void> {
  const cId = normalizeId(courseId);
  const uId = normalizeId(userId);
  if (!cId || !uId) return;

  const ref = memberRef(cId, uId);
  const existing = await ref.get();
  if (existing.exists) {
    await ref.delete().catch(() => {});
  }
  await courseMetaRef(cId).set(
    {
      courseId: cId,
      updatedAt: new Date().toISOString(),
      ...(existing.exists ? { memberCount: FieldValue.increment(-1) } : {}),
    },
    { merge: true },
  );
}

export async function isUserInCourseEnrollmentIndex(
  courseId: string,
  userId: string,
): Promise<boolean> {
  const cId = normalizeId(courseId);
  const uId = normalizeId(userId);
  if (!cId || !uId) return false;
  const snap = await memberRef(cId, uId).get();
  return snap.exists;
}

export async function listCourseEnrollmentUserIds(
  courseId: string,
  options?: { limit?: number; startAfterId?: string },
): Promise<{ userIds: string[]; nextCursor: string | null }> {
  const cId = normalizeId(courseId);
  if (!cId) return { userIds: [], nextCursor: null };

  const pageSize = Math.min(Math.max(options?.limit || 500, 1), 1000);
  let query = courseMetaRef(cId)
    .collection(MEMBERS_SUBCOLLECTION)
    .orderBy('__name__')
    .limit(pageSize);

  if (options?.startAfterId) {
    const startDoc = await memberRef(cId, options.startAfterId).get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc);
    }
  }

  const snap = await query.get();
  const userIds = snap.docs.map((doc) => doc.id);
  const nextCursor = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1]?.id || null : null;
  return { userIds, nextCursor };
}

export async function listAllCourseEnrollmentUserIds(
  courseId: string,
  options?: { batchSize?: number; maxUsers?: number },
): Promise<string[]> {
  const maxUsers = Math.max(options?.maxUsers || 50000, 1);
  const batchSize = Math.min(Math.max(options?.batchSize || 500, 1), 1000);
  const all: string[] = [];
  let cursor: string | null = null;

  while (all.length < maxUsers) {
    const { userIds, nextCursor } = await listCourseEnrollmentUserIds(courseId, {
      limit: batchSize,
      startAfterId: cursor || undefined,
    });

    if (userIds.length === 0) break;
    all.push(...userIds);
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return all.slice(0, maxUsers);
}

export async function backfillCourseEnrollmentIndexFromUsers(
  courseId: string,
): Promise<{ scannedUsers: number; added: number }> {
  const cId = normalizeId(courseId);
  if (!cId) return { scannedUsers: 0, added: 0 };

  const PAGE_SIZE = 500;
  let scannedUsers = 0;
  let added = 0;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;

  while (true) {
    let pageQuery = adminDb.collection('users').orderBy('__name__').limit(PAGE_SIZE);
    if (lastDoc) pageQuery = pageQuery.startAfter(lastDoc) as typeof pageQuery;

    const snap = await pageQuery.get();
    if (snap.empty) break;

    const writes: Array<Promise<void>> = [];
    for (const userDoc of snap.docs) {
      scannedUsers++;
      const enrollments: Array<{ courseId: string }> = userDoc.data()?.enrollments || [];
      if (!enrollments.some((e) => e.courseId === cId)) continue;

      added++;
      writes.push(addUserToCourseEnrollmentIndex(cId, userDoc.id, 'migration'));
    }

    if (writes.length > 0) {
      await Promise.all(writes);
    }

    if (snap.docs.length < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  await courseMetaRef(cId).set(
    {
      courseId: cId,
      indexedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { scannedUsers, added };
}
