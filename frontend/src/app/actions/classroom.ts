'use server';

import { adminDb, adminAuth } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Classroom, ClassroomMessage, ClassroomChannel, ClassroomMember, ClassroomMemberRole } from '@/lib/db';
import { requireAdminContextFromIdToken } from '@/lib/trusted-server-context';
import {
  addUserToCourseEnrollmentIndex,
  backfillCourseEnrollmentIndexFromUsers,
  isUserInCourseEnrollmentIndex,
  listAllCourseEnrollmentUserIds,
  removeUserFromCourseEnrollmentIndex,
} from '@/lib/enrollment-index';
import { ensureClassroomAndAddStudent } from '@/lib/classroom-sync';

export { ensureClassroomAndAddStudent };

function mapGlobalRoleToClassroomRole(role: string): ClassroomMemberRole {
  if (['admin', 'superadmin', 'subadmin'].includes(role)) return 'classroom-admin';
  if (['tutor', 'author', 'instructor', 'teacher'].includes(role)) return 'classroom-author';
  return 'classroom-student';
}

function normalizeMemberIds(classroomData: any): string[] {
  const explicitIds = Array.isArray(classroomData?.enrolledStudentIds)
    ? classroomData.enrolledStudentIds.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const memberIds = Array.isArray(classroomData?.members)
    ? classroomData.members.flatMap((member: string | ClassroomMember) => {
        if (typeof member === 'string') return member ? [member] : [];
        if (member && typeof member.userId === 'string' && member.userId.length > 0) return [member.userId];
        return [];
      })
    : [];
  return Array.from(new Set([...explicitIds, ...memberIds]));
}

function normalizeMembers(classroomData: any): ClassroomMember[] {
  const entries = Array.isArray(classroomData?.members) ? classroomData.members : [];
  const normalized: ClassroomMember[] = entries.flatMap((member: string | ClassroomMember) => {
    if (typeof member === 'string') {
      return member
        ? [{ userId: member, classroomRole: 'classroom-student' as const, addedAt: classroomData?.createdAt || new Date().toISOString(), addedBy: classroomData?.createdById || classroomData?.tutorId || 'system' }]
        : [];
    }
    if (member && typeof member.userId === 'string' && member.userId.length > 0) {
      return [{
        userId: member.userId,
        classroomRole: member.classroomRole || 'classroom-student',
        addedAt: member.addedAt || classroomData?.createdAt || new Date().toISOString(),
        addedBy: member.addedBy || classroomData?.createdById || classroomData?.tutorId || 'system',
      }];
    }
    return [];
  });

  const deduped = new Map<string, ClassroomMember>();
  normalized.forEach((member: ClassroomMember) => {
    if (!deduped.has(member.userId)) deduped.set(member.userId, member);
  });
  return Array.from(deduped.values());
}

async function buildMembersFromUserIds(
  userIds: string[],
  addedBy: string,
): Promise<ClassroomMember[]> {
  const members: ClassroomMember[] = [];
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  for (let i = 0; i < uniqueIds.length; i += 200) {
    const chunk = uniqueIds.slice(i, i + 200);
    const refs = chunk.map((memberId) => adminDb.doc(`users/${memberId}`));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() as any;
      members.push({
        userId: snap.id,
        classroomRole: mapGlobalRoleToClassroomRole(data.role || 'student'),
        addedAt: new Date().toISOString(),
        addedBy,
      });
    });
  }

  return members;
}

export async function createClassroom(
  idToken: string,
  courseId: string
): Promise<{ error?: string }> {
  try {
    const adminCtx = await requireAdminContextFromIdToken(idToken, 'courses:approve');
    if (!adminCtx.ok) {
      return { error: adminCtx.error };
    }
    const uid = adminCtx.userId;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    const userData = userDoc.data() as any;

    const classroomRef = adminDb.doc(`classrooms/${courseId}`);
    const existing = await classroomRef.get();
    if (existing.exists) return {};

    const courseDoc = await adminDb.doc(`courses/${courseId}`).get();
    if (!courseDoc.exists) return { error: 'Course not found.' };
    const course = courseDoc.data() as any;

    let enrolledStudentIds = await listAllCourseEnrollmentUserIds(courseId, {
      batchSize: 500,
      maxUsers: 50000,
    });
    if (enrolledStudentIds.length === 0) {
      // One-time fallback for legacy data until all enrollments are indexed.
      await backfillCourseEnrollmentIndexFromUsers(courseId);
      enrolledStudentIds = await listAllCourseEnrollmentUserIds(courseId, {
        batchSize: 500,
        maxUsers: 50000,
      });
    }
    const members = await buildMembersFromUserIds(enrolledStudentIds, uid);

    const classroom: Omit<Classroom, 'id'> = {
      courseId,
      courseTitle: course.title || 'Untitled Course',
      category: course.category || 'General',
      description: `This is the classroom for ${course.title || 'this course'} lectures and discussions.`,
      tutorId: course.tutorId || '',
      createdById: uid,
      createdByName: userData?.name || 'Administrator',
      memberCount: enrolledStudentIds.length,
      members,
      createdAt: new Date().toISOString(),
      enrolledStudentIds,
    };
    await classroomRef.set(classroom);
    return {};
  } catch (err: any) {
    console.error('[createClassroom]', err?.message);
    return { error: err?.message };
  }
}

/**
 * Adds a single student UID to the classroom's enrolledStudentIds array.
 * Called after any enrollment path (paid, free, manual admin) to keep the
 * classroom's member list in sync.  Non-throwing: callers may swallow errors
 * if the classroom doesn't exist yet (e.g. classroom created later).
 */
export async function syncStudentToClassroom(
  courseId: string,
  studentUid: string,
): Promise<void> {
  const classroomRef = adminDb.doc(`classrooms/${courseId}`);
  const snap = await classroomRef.get();
  if (!snap.exists) return;
  await classroomRef.update({
    enrolledStudentIds: FieldValue.arrayUnion(studentUid),
  });
  await addUserToCourseEnrollmentIndex(courseId, studentUid, 'sync');
}

/**
 * Student-callable self-repair: verifies the calling user is enrolled and
 * then ensures their UID is in classrooms/{courseId}.enrolledStudentIds so
 * the Firestore security rule for classroomMessages allows reads.
 *
 * Returns { ok: true } on success, { ok: false, error } if the caller is not
 * enrolled or the repair fails.
 */
export async function repairMyClassroomAccess(
  idToken: string,
  courseId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { ok: false, error: 'User not found.' };
    const userData = userDoc.data() as any;
    const role = userData.role as string;

    const isAdminUser = ['admin', 'superadmin', 'subadmin'].includes(role);
    const enrollments: { courseId: string }[] = userData.enrollments || [];
    const isEnrolled = enrollments.some((e) => e.courseId === courseId);

    let classroomDoc = await adminDb.doc(`classrooms/${courseId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', courseId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }

    const classroomData = classroomDoc?.exists ? (classroomDoc.data() as any) : null;
    const isTutorOfClassroom = role === 'tutor' && classroomData?.tutorId === uid;

    if (!isAdminUser && !isTutorOfClassroom && !isEnrolled) {
      return { ok: false, error: 'Not enrolled in this course.' };
    }

    const targetCourseId = classroomData?.courseId || courseId;

    // Idempotent: adds student to classroom and enrollment index.
    // For admins/tutor-of-class this is safe and ensures doc consistency.
    await ensureClassroomAndAddStudent(targetCourseId, uid);

    const syncedClassroomRef = adminDb.doc(`classrooms/${targetCourseId}`);
    const syncedClassroomSnap = await syncedClassroomRef.get();
    if (!syncedClassroomSnap.exists) {
      return { ok: false, error: 'Classroom sync incomplete. Please retry.' };
    }

    const syncedClassroom = syncedClassroomSnap.data() as any;
    const isMember = normalizeMemberIds(syncedClassroom).includes(uid);

    if (!isAdminUser && !isTutorOfClassroom && !isMember) {
      return { ok: false, error: 'Classroom access is not active yet.' };
    }

    return { ok: true };
  } catch (err: any) {
    console.error('[repairMyClassroomAccess]', err?.message);
    return { ok: false, error: err?.message };
  }
}

/**
 * One-time migration: backfills enrolledStudentIds on all existing classroom
 * documents that were created before this field was introduced.  Safe to run
 * multiple times (FieldValue.arrayUnion is idempotent).
 *
 * Returns counts of classrooms processed and updated for admin visibility.
 * Protected: requires a valid admin idToken.
 */
export async function migrateClassroomEnrolledStudentIds(
  idToken: string,
): Promise<{ processed: number; updated: number; error?: string }> {
  try {
    const adminCtx = await requireAdminContextFromIdToken(idToken);
    if (!adminCtx.ok || adminCtx.role === 'subadmin') {
      return { processed: 0, updated: 0, error: 'Unauthorized.' };
    }

    // Fetch all classrooms
    const classroomsSnap = await adminDb.collection('classrooms').get();
    let processed = 0;
    let updated = 0;

    for (const classroomDoc of classroomsSnap.docs) {
      const data = classroomDoc.data() as any;
      processed++;

      // Skip if already migrated (field exists and is an array)
      if (Array.isArray(data.enrolledStudentIds)) continue;

      const courseId = data.courseId as string;
      if (!courseId) continue;

      let enrolledUids = await listAllCourseEnrollmentUserIds(courseId, {
        batchSize: 500,
        maxUsers: 50000,
      });
      if (enrolledUids.length === 0) {
        await backfillCourseEnrollmentIndexFromUsers(courseId);
        enrolledUids = await listAllCourseEnrollmentUserIds(courseId, {
          batchSize: 500,
          maxUsers: 50000,
        });
      }

      await classroomDoc.ref.update({ enrolledStudentIds: enrolledUids });
      updated++;
    }

    console.info(`[migrateClassroomEnrolledStudentIds] Done. processed=${processed} updated=${updated}`);
    return { processed, updated };
  } catch (err: any) {
    console.error('[migrateClassroomEnrolledStudentIds]', err?.message);
    return { processed: 0, updated: 0, error: err?.message };
  }
}

export async function getClassroomsForUser(
  idToken: string
): Promise<{ classrooms: Classroom[]; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { classrooms: [] };
    const userData = userDoc.data() as any;
    const role = userData.role as string;

    let classroomDocs: FirebaseFirestore.QuerySnapshot;

    if (['admin', 'superadmin', 'subadmin'].includes(role)) {
      classroomDocs = await adminDb.collection('classrooms').get();
    } else if (role === 'tutor') {
      classroomDocs = await adminDb
        .collection('classrooms')
        .where('tutorId', '==', uid)
        .get();
    } else {
      const enrollments: { courseId: string }[] = userData.enrollments || [];
      const courseIds = enrollments.map((e) => e.courseId).filter(Boolean);
      if (courseIds.length === 0) return { classrooms: [] };

      const chunks: string[][] = [];
      for (let i = 0; i < courseIds.length; i += 10) {
        chunks.push(courseIds.slice(i, i + 10));
      }

      const snaps = await Promise.all(
        chunks.map((ids) =>
          adminDb.collection('classrooms').where('courseId', 'in', ids).get()
        )
      );

      const classroomMap = new Map<string, Classroom>();
      snaps.forEach((snap) => {
        snap.docs.forEach((doc) => {
          classroomMap.set(doc.id, { ...(doc.data() as Omit<Classroom, 'id'>), id: doc.id });
        });
      });

      return { classrooms: Array.from(classroomMap.values()) };
    }

    const classrooms = classroomDocs.docs.map((doc) => ({
      ...(doc.data() as Omit<Classroom, 'id'>),
      id: doc.id,
    }));
    return { classrooms };
  } catch (err: any) {
    console.error('[getClassroomsForUser]', err?.message);
    return { classrooms: [], error: err?.message };
  }
}

export async function getClassroomById(
  idToken: string,
  classroomId: string
): Promise<{ classroom: Classroom | null; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { classroom: null, error: 'User not found.' };
    const userData = userDoc.data() as any;
    const role = userData.role as string;

    let classroomDoc = await adminDb.doc(`classrooms/${classroomId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', classroomId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }

    // If there is still no classroom doc, check whether the user is enrolled.
    // If they are, create the classroom on-demand so access is immediate.
    if (!classroomDoc || !classroomDoc.exists) {
      const isAdminUser = ['admin', 'superadmin', 'subadmin'].includes(role);
      const enrollments: { courseId: string }[] = userData.enrollments || [];
      const isEnrolled = enrollments.some((e) => e.courseId === classroomId);

      if (!isAdminUser && !isEnrolled) {
        return { classroom: null, error: 'Classroom not found.' };
      }

      // Create the classroom and add the student — then re-fetch
      await ensureClassroomAndAddStudent(classroomId, uid);

      const retrySnap = await adminDb.doc(`classrooms/${classroomId}`).get();
      if (!retrySnap.exists) {
        return { classroom: null, error: 'Classroom could not be created. Please try again.' };
      }
      classroomDoc = retrySnap;
    }

    const classroomData = classroomDoc.data() as Omit<Classroom, 'id'>;
    const classroom = {
      ...classroomData,
      id: classroomDoc.id,
      enrolledStudentIds: normalizeMemberIds(classroomData),
      members: normalizeMembers(classroomData),
      memberCount: normalizeMemberIds(classroomData).length,
    };

    if (['admin', 'superadmin', 'subadmin'].includes(role)) {
      return { classroom };
    }
    if (role === 'tutor' && classroom.tutorId === uid) {
      return { classroom };
    }
    const enrollments: { courseId: string }[] = userData.enrollments || [];
    const isEnrolled = enrollments.some((e) => e.courseId === classroom.courseId);

    // Student is enrolled but not yet in enrolledStudentIds (sync lag).
    // Await the repair so Firestore rules pass before the client subscribes.
    if (isEnrolled && !classroom.enrolledStudentIds.includes(uid)) {
      await adminDb.doc(`classrooms/${classroomDoc.id}`).update({
        enrolledStudentIds: FieldValue.arrayUnion(uid),
      }).catch(() => undefined);
      classroom.enrolledStudentIds = [...classroom.enrolledStudentIds, uid];
    }

    if (isEnrolled) return { classroom };

    // Student was added directly to the classroom (e.g. by a tutor/admin via classroom
    // management tools) but the user.enrollments array has not been updated yet.
    // Treat enrolledStudentIds membership as ground truth — grant access and backfill
    // the user.enrollments entry so future loads take the fast path.
    const isDirectlyAdded = classroom.enrolledStudentIds.includes(uid);
    if (isDirectlyAdded) {
      await adminDb.doc(`users/${uid}`).update({
        enrollments: FieldValue.arrayUnion({
          courseId: classroom.courseId,
          enrolledDate: new Date().toISOString(),
          completedLessons: [],
        }),
      }).catch(() => undefined);
      return { classroom };
    }

    return { classroom: null, error: 'Access denied.' };
  } catch (err: any) {
    console.error('[getClassroomById]', err?.message);
    return { classroom: null, error: err?.message };
  }
}

export async function sendClassroomMessage(
  idToken: string,
  classroomId: string,
  channel: ClassroomChannel,
  text: string,
  richContent?: string,
  attachmentUrl?: string,
  attachmentName?: string,
  attachmentType?: string,
  pendingReplyId?: string
): Promise<{ error?: string }> {
  try {
    const trimmedText = text.trim();
    const hasRichContent = typeof richContent === 'string' && richContent.trim().length > 0;
    if (!trimmedText && !hasRichContent && !attachmentUrl) return { error: 'Message cannot be empty.' };

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { error: 'User not found.' };
    const userData = userDoc.data() as any;

    let classroomDoc = await adminDb.doc(`classrooms/${classroomId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', classroomId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }
    if (!classroomDoc || !classroomDoc.exists) return { error: 'Classroom not found.' };

    const role = userData.role as string;
    const classroom = classroomDoc.data() as any;

    let hasAccess = false;
    if (['admin', 'superadmin', 'subadmin'].includes(role)) hasAccess = true;
    else if (role === 'tutor' && classroom.tutorId === uid) hasAccess = true;
    else {
      const enrollments: { courseId: string }[] = userData.enrollments || [];
      const enrolledStudentIds: string[] = normalizeMemberIds(classroom);
      hasAccess = enrollments.some((e) => e.courseId === classroom.courseId)
        || enrolledStudentIds.includes(uid);
    }

    if (!hasAccess) return { error: 'Access denied.' };

    const messageRef = adminDb.collection('classroomMessages').doc();
    const message: Omit<ClassroomMessage, 'id'> = {
      // Always store the canonical classroom document ID to match rules lookups.
      classroomId: classroomDoc.id,
      channel,
      userId: uid,
      userName: userData.name || 'User',
      userAvatar: userData.avatar || '',
      userRole: role,
      text: trimmedText,
      timestamp: new Date().toISOString(),
      ...(hasRichContent ? { richContent } : {}),
      ...(attachmentUrl ? { attachmentUrl } : {}),
      ...(attachmentName ? { attachmentName } : {}),
      ...(attachmentType ? { attachmentType } : {}),
      ...(pendingReplyId ? { pendingReplyId } : {}),
    };
    await messageRef.set(message);
    return {};
  } catch (err: any) {
    console.error('[sendClassroomMessage]', err?.message);
    return { error: err?.message };
  }
}

export async function getClassroomMembers(
  idToken: string,
  classroomId: string
): Promise<{ members: { id: string; name: string; role: string; avatar?: string; classroomRole: ClassroomMemberRole; addedAt?: string; addedBy?: string }[]; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { members: [], error: 'User not found.' };

    let classroomDoc = await adminDb.doc(`classrooms/${classroomId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', classroomId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }
    if (!classroomDoc || !classroomDoc.exists) return { members: [], error: 'Classroom not found.' };
    const classroom = classroomDoc.data() as any;
    const role = userDoc.data()?.role as string;

    let hasAccess = false;
    if (['admin', 'superadmin', 'subadmin'].includes(role)) hasAccess = true;
    else if (role === 'tutor' && classroom.tutorId === uid) hasAccess = true;
    else {
      const enrollments: { courseId: string }[] = userDoc.data()?.enrollments || [];
      const enrolledStudentIds: string[] = normalizeMemberIds(classroom);
      hasAccess = enrollments.some((e) => e.courseId === classroom.courseId)
        || enrolledStudentIds.includes(uid);
    }
    if (!hasAccess) return { members: [], error: 'Access denied.' };

    const memberMap = new Map<string, ClassroomMember>();
    normalizeMembers(classroom).forEach((member) => memberMap.set(member.userId, member));

    const memberIds = new Set(normalizeMemberIds(classroom));
    const indexedMemberIds = await listAllCourseEnrollmentUserIds(classroom.courseId, {
      batchSize: 500,
      maxUsers: 50000,
    });
    indexedMemberIds.forEach((memberId) => memberIds.add(memberId));
    if (classroom.tutorId) memberIds.add(classroom.tutorId);

    const memberIdList = Array.from(memberIds);
    const members: { id: string; name: string; role: string; avatar?: string; classroomRole: ClassroomMemberRole; addedAt?: string; addedBy?: string }[] = [];

    for (let i = 0; i < memberIdList.length; i += 30) {
      const chunk = memberIdList.slice(i, i + 30);
      const refs = chunk.map((memberId) => adminDb.doc(`users/${memberId}`));
      const snaps = await adminDb.getAll(...refs);

      snaps.forEach((docSnap) => {
        if (!docSnap.exists) return;
        const data = docSnap.data() as any;
        const memberMeta = memberMap.get(docSnap.id);
        members.push({
          id: docSnap.id,
          name: data.name || 'User',
          role: data.role || 'student',
          avatar: data.avatar,
          classroomRole: memberMeta?.classroomRole || mapGlobalRoleToClassroomRole(data.role || 'student'),
          addedAt: memberMeta?.addedAt,
          addedBy: memberMeta?.addedBy,
        });
      });
    }

    members.sort((a, b) => {
      if (a.id === classroom.tutorId) return -1;
      if (b.id === classroom.tutorId) return 1;
      return a.name.localeCompare(b.name);
    });

    return { members };
  } catch (err: any) {
    console.error('[getClassroomMembers]', err?.message);
    return { members: [], error: err?.message };
  }
}

export async function getClassroomUserProfile(
  idToken: string,
  classroomId: string,
  targetUserId: string,
): Promise<{
  profile?: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
    classroomRole: ClassroomMemberRole;
    status: 'online' | 'away' | 'dnd' | 'offline';
    lastSeen?: string;
    messageCount: number;
  };
  error?: string;
}> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { error: 'User not found.' };

    let classroomDoc = await adminDb.doc(`classrooms/${classroomId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', classroomId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }
    if (!classroomDoc || !classroomDoc.exists) return { error: 'Classroom not found.' };

    const classroom = classroomDoc.data() as any;
    const callerRole = userDoc.data()?.role as string;

    let hasAccess = false;
    if (['admin', 'superadmin', 'subadmin'].includes(callerRole)) hasAccess = true;
    else if (callerRole === 'tutor' && classroom.tutorId === uid) hasAccess = true;
    else {
      const enrollments: { courseId: string }[] = userDoc.data()?.enrollments || [];
      const enrolledStudentIds: string[] = normalizeMemberIds(classroom);
      hasAccess = enrollments.some((e) => e.courseId === classroom.courseId) || enrolledStudentIds.includes(uid);
    }
    if (!hasAccess) return { error: 'Access denied.' };

    const targetDoc = await adminDb.doc(`users/${targetUserId}`).get();
    if (!targetDoc.exists) return { error: 'User not found.' };

    const targetData = targetDoc.data() as any;
    const memberMap = new Map<string, ClassroomMember>();
    normalizeMembers(classroom).forEach((member) => memberMap.set(member.userId, member));
    const memberMeta = memberMap.get(targetUserId);

    const presenceSnap = await adminDb
      .collection('classroomPresence')
      .where('classroomId', '==', classroomDoc.id)
      .where('userId', '==', targetUserId)
      .limit(1)
      .get();

    const presence = presenceSnap.docs[0]?.data() as any;
    const status = (presence?.status || 'offline') as 'online' | 'away' | 'dnd' | 'offline';
    const lastSeen = presence?.lastSeen as string | undefined;

    const messageCountAgg = await adminDb
      .collection('classroomMessages')
      .where('classroomId', '==', classroomDoc.id)
      .where('userId', '==', targetUserId)
      .count()
      .get();

    const messageCount = messageCountAgg.data().count || 0;

    return {
      profile: {
        id: targetDoc.id,
        name: targetData.name || 'User',
        role: targetData.role || 'student',
        avatar: targetData.avatar,
        classroomRole: memberMeta?.classroomRole || mapGlobalRoleToClassroomRole(targetData.role || 'student'),
        status,
        lastSeen,
        messageCount,
      },
    };
  } catch (err: any) {
    console.error('[getClassroomUserProfile]', err?.message);
    return { error: err?.message };
  }
}

type ClassroomStatus = 'active' | 'inactive' | 'maintenance' | 'archived';

type UpsertClassroomInput = {
  classroomId?: string;
  courseId: string;
  courseTitle: string;
  subject?: string;
  category?: string;
  description?: string;
  status?: ClassroomStatus;
  maxCapacity?: number;
  tutorId?: string;
};

async function getCallerContext(idToken: string): Promise<{ uid: string; role: string; userData: any } | null> {
  const decoded = await adminAuth.verifyIdToken(idToken);
  const uid = decoded.uid;
  const userDoc = await adminDb.doc(`users/${uid}`).get();
  if (!userDoc.exists) return null;
  const userData = userDoc.data() as any;
  return { uid, role: userData?.role as string, userData };
}

function canManageClassroom(role: string, callerUid: string, classroomTutorId: string): boolean {
  if (['admin', 'superadmin', 'subadmin'].includes(role)) return true;
  if (role === 'tutor' && classroomTutorId === callerUid) return true;
  return false;
}

type ClassroomAccessDiagnostics = {
  courseId: string;
  targetUserId: string;
  targetEmail?: string;
  classroomDocId: string | null;
  classroomExists: boolean;
  classroomCourseId: string | null;
  classroomHasEnrolledField: boolean;
  userEnrolledInArray: boolean;
  enrollmentIndexHasMember: boolean;
  classroomHasMember: boolean;
  rulesWouldAllowMessageReadByMembership: boolean;
  repairAttempted: boolean;
  repairSucceeded: boolean;
  rootCauseFlags: string[];
  recommendation: string;
};

export async function diagnoseClassroomAccess(
  idToken: string,
  courseId: string,
  userIdentifier: string,
  options?: { attemptRepair?: boolean },
): Promise<{ diagnostics?: ClassroomAccessDiagnostics; error?: string }> {
  try {
    const caller = await getCallerContext(idToken);
    if (!caller) return { error: 'User not found.' };
    if (!['admin', 'superadmin', 'subadmin'].includes(caller.role)) {
      return { error: 'Unauthorized.' };
    }

    const normalizedCourseId = courseId.trim();
    const normalizedIdentifier = userIdentifier.trim().toLowerCase();
    if (!normalizedCourseId) return { error: 'Course ID is required.' };
    if (!normalizedIdentifier) return { error: 'User email or UID is required.' };

    let targetUserDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    if (normalizedIdentifier.includes('@')) {
      const usersSnap = await adminDb
        .collection('users')
        .where('email', '==', normalizedIdentifier)
        .limit(1)
        .get();
      targetUserDoc = usersSnap.empty ? null : usersSnap.docs[0];
    } else {
      const byUid = await adminDb.doc(`users/${normalizedIdentifier}`).get();
      targetUserDoc = byUid.exists ? byUid : null;
    }

    if (!targetUserDoc || !targetUserDoc.exists) {
      return { error: `Target user not found: ${userIdentifier}` };
    }

    const targetUserId = targetUserDoc.id;
    const targetUserData = targetUserDoc.data() as any;
    const targetEmail = typeof targetUserData?.email === 'string' ? targetUserData.email : undefined;

    const enrollments: { courseId: string }[] = Array.isArray(targetUserData?.enrollments)
      ? targetUserData.enrollments
      : [];
    const userEnrolledInArray = enrollments.some((e) => e?.courseId === normalizedCourseId);

    const enrollmentIndexHasMember = await isUserInCourseEnrollmentIndex(normalizedCourseId, targetUserId);

    let classroomDoc = await adminDb.doc(`classrooms/${normalizedCourseId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', normalizedCourseId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }

    const classroomExists = !!classroomDoc && classroomDoc.exists;
    const classroomData = classroomExists ? (classroomDoc.data() as any) : null;
    const classroomDocId = classroomExists ? classroomDoc.id : null;
    const classroomCourseId = classroomExists
      ? (typeof classroomData?.courseId === 'string' ? classroomData.courseId : normalizedCourseId)
      : null;
    const classroomHasEnrolledField = classroomExists
      ? Array.isArray(classroomData?.enrolledStudentIds)
      : false;
    const classroomHasMember = classroomExists
      ? normalizeMemberIds(classroomData).includes(targetUserId)
      : false;

    let repairAttempted = false;
    let repairSucceeded = false;

    if (options?.attemptRepair && classroomCourseId && (userEnrolledInArray || enrollmentIndexHasMember || classroomHasMember)) {
      repairAttempted = true;
      try {
        await ensureClassroomAndAddStudent(classroomCourseId, targetUserId);
        const refreshedClassroom = await adminDb.doc(`classrooms/${classroomCourseId}`).get();
        if (refreshedClassroom.exists) {
          const refreshedData = refreshedClassroom.data() as any;
          repairSucceeded = normalizeMemberIds(refreshedData).includes(targetUserId);
        }
      } catch {
        repairSucceeded = false;
      }
    }

    const rulesWouldAllowMessageReadByMembership = classroomExists
      ? (!classroomHasEnrolledField || classroomHasMember || repairSucceeded)
      : false;

    const rootCauseFlags: string[] = [];
    if (!classroomExists) rootCauseFlags.push('classroom_missing');
    if (!userEnrolledInArray && !enrollmentIndexHasMember) rootCauseFlags.push('no_enrollment_record');
    if (userEnrolledInArray && !enrollmentIndexHasMember) rootCauseFlags.push('enrollment_index_missing');
    if (!userEnrolledInArray && enrollmentIndexHasMember) rootCauseFlags.push('user_enrollments_missing');
    if (classroomExists && classroomHasEnrolledField && !classroomHasMember && !repairSucceeded) {
      rootCauseFlags.push('classroom_membership_missing');
    }

    let recommendation = 'Access path looks healthy.';
    if (rootCauseFlags.includes('classroom_missing')) {
      recommendation = 'Create/sync classroom document for this course before opening message stream.';
    } else if (rootCauseFlags.includes('no_enrollment_record')) {
      recommendation = 'Enroll user in the course first; they should remain blocked until enrollment is active.';
    } else if (rootCauseFlags.includes('classroom_membership_missing')) {
      recommendation = 'Run classroom sync (ensureClassroomAndAddStudent) and retry message subscription.';
    } else if (rootCauseFlags.includes('enrollment_index_missing') || rootCauseFlags.includes('user_enrollments_missing')) {
      recommendation = 'Repair enrollment storage consistency (user.enrollments and courseEnrollments index).';
    }

    return {
      diagnostics: {
        courseId: normalizedCourseId,
        targetUserId,
        targetEmail,
        classroomDocId,
        classroomExists,
        classroomCourseId,
        classroomHasEnrolledField,
        userEnrolledInArray,
        enrollmentIndexHasMember,
        classroomHasMember: classroomHasMember || repairSucceeded,
        rulesWouldAllowMessageReadByMembership,
        repairAttempted,
        repairSucceeded,
        rootCauseFlags,
        recommendation,
      },
    };
  } catch (err: any) {
    console.error('[diagnoseClassroomAccess]', err?.message);
    return { error: err?.message };
  }
}

export async function upsertManagedClassroom(
  idToken: string,
  input: UpsertClassroomInput,
): Promise<{ classroom?: Classroom; error?: string }> {
  try {
    if (!input.courseId?.trim()) return { error: 'Course/Class ID is required.' };
    if (!input.courseTitle?.trim()) return { error: 'Class name is required.' };

    const caller = await getCallerContext(idToken);
    if (!caller) return { error: 'User not found.' };

    const desiredTutorId = input.tutorId || caller.uid;
    const isAdmin = ['admin', 'superadmin', 'subadmin'].includes(caller.role);
    if (!isAdmin && desiredTutorId !== caller.uid) {
      return { error: 'Unauthorized.' };
    }

    const classroomId = input.classroomId || input.courseId;
    const classroomRef = adminDb.doc(`classrooms/${classroomId}`);
    const existingSnap = await classroomRef.get();
    const existing = existingSnap.exists ? (existingSnap.data() as any) : null;

    if (existing && !canManageClassroom(caller.role, caller.uid, existing.tutorId || '')) {
      return { error: 'Unauthorized.' };
    }

    const nowIso = new Date().toISOString();
    const nextStatus: ClassroomStatus = input.status || existing?.status || 'active';
    const maxCapacity = typeof input.maxCapacity === 'number' && input.maxCapacity > 0
      ? Math.floor(input.maxCapacity)
      : (existing?.maxCapacity || 0);
    const normalizedMembers = normalizeMembers(existing);
    const normalizedMemberIds = normalizeMemberIds(existing);

    const classroomPayload: Omit<Classroom, 'id'> = {
      courseId: input.courseId.trim(),
      courseTitle: input.courseTitle.trim(),
      subject: (input.subject || existing?.subject || input.category || 'General').trim(),
      category: (input.category || existing?.category || 'General').trim(),
      description: (input.description || existing?.description || '').trim(),
      tutorId: desiredTutorId,
      createdById: existing?.createdById || caller.uid,
      createdByName: existing?.createdByName || caller.userData?.name || 'Administrator',
      status: nextStatus,
      maxCapacity,
      memberCount: normalizedMemberIds.length,
      members: normalizedMembers,
      updatedAt: nowIso,
      createdAt: existing?.createdAt || nowIso,
      enrolledStudentIds: normalizedMemberIds,
    };

    await classroomRef.set(classroomPayload, { merge: true });
    return { classroom: { ...classroomPayload, id: classroomId } };
  } catch (err: any) {
    console.error('[upsertManagedClassroom]', err?.message);
    return { error: err?.message };
  }
}

export async function deleteManagedClassroom(
  idToken: string,
  classroomId: string,
): Promise<{ error?: string }> {
  try {
    const caller = await getCallerContext(idToken);
    if (!caller) return { error: 'User not found.' };

    const classroomRef = adminDb.doc(`classrooms/${classroomId}`);
    const snap = await classroomRef.get();
    if (!snap.exists) return { error: 'Classroom not found.' };
    const classroom = snap.data() as any;

    if (!canManageClassroom(caller.role, caller.uid, classroom.tutorId || '')) {
      return { error: 'Unauthorized.' };
    }

    await classroomRef.delete();
    return {};
  } catch (err: any) {
    console.error('[deleteManagedClassroom]', err?.message);
    return { error: err?.message };
  }
}

export async function addUsersToClassroom(
  idToken: string,
  classroomId: string,
  userIds: string[],
): Promise<{ added: number; error?: string }> {
  try {
    const caller = await getCallerContext(idToken);
    if (!caller) return { added: 0, error: 'User not found.' };

    const classroomRef = adminDb.doc(`classrooms/${classroomId}`);
    const classroomSnap = await classroomRef.get();
    if (!classroomSnap.exists) return { added: 0, error: 'Classroom not found.' };
    const classroom = classroomSnap.data() as any;

    if (!canManageClassroom(caller.role, caller.uid, classroom.tutorId || '')) {
      return { added: 0, error: 'Unauthorized.' };
    }

    const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
    if (uniqueIds.length === 0) return { added: 0 };

    const currentMembers = normalizeMemberIds(classroom);
    const maxCapacity = Number(classroom.maxCapacity || 0);
    const netNewCandidates = uniqueIds.filter((targetUid) => (
      targetUid !== classroom.tutorId && !currentMembers.includes(targetUid)
    ));
    if (maxCapacity > 0 && currentMembers.length + netNewCandidates.length > maxCapacity) {
      return { added: 0, error: `Capacity reached (${currentMembers.length}/${maxCapacity}).` };
    }

    let added = 0;
    for (const targetUid of uniqueIds) {
      const userRef = adminDb.doc(`users/${targetUid}`);
      const wasAdded = await adminDb.runTransaction(async (tx) => {
        const classroomTxSnap = await tx.get(classroomRef);
        if (!classroomTxSnap.exists) return false;
        const classroomTx = classroomTxSnap.data() as any;
        if (targetUid === classroomTx.tutorId) return false;

        const existingMembers = normalizeMembers(classroomTx);
        const existingMemberIds = new Set(existingMembers.map((member) => member.userId));
        const currentMemberIds = normalizeMemberIds(classroomTx);

        const txMaxCapacity = Number(classroomTx.maxCapacity || 0);
        if (txMaxCapacity > 0 && !existingMemberIds.has(targetUid) && currentMemberIds.length >= txMaxCapacity) {
          return false;
        }

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) return false;

        const userData = userSnap.data() as any;
        const enrollments: { courseId: string; enrolledDate: string; completedLessons: string[] }[] = Array.isArray(userData.enrollments)
          ? userData.enrollments
          : [];
        const alreadyEnrolled = enrollments.some((e) => e.courseId === classroomTx.courseId);
        const isExistingMember = existingMemberIds.has(targetUid);

        if (!alreadyEnrolled) {
          tx.update(userRef, {
            enrollments: [
              ...enrollments,
              {
                courseId: classroomTx.courseId,
                enrolledDate: new Date().toISOString(),
                completedLessons: [],
              },
            ],
          });
        }
        if (!isExistingMember) {
          existingMembers.push({
            userId: targetUid,
            classroomRole: mapGlobalRoleToClassroomRole(userData.role || 'student'),
            addedAt: new Date().toISOString(),
            addedBy: caller.uid,
          });
        }
        tx.update(classroomRef, {
          enrolledStudentIds: FieldValue.arrayUnion(targetUid),
          members: existingMembers,
          memberCount: isExistingMember ? currentMemberIds.length : currentMemberIds.length + 1,
          updatedAt: new Date().toISOString(),
        });
        return !isExistingMember;
      });
      if (wasAdded) {
        added++;
        await addUserToCourseEnrollmentIndex(classroom.courseId, targetUid, 'admin');
      }
    }

    return { added };
  } catch (err: any) {
    console.error('[addUsersToClassroom]', err?.message);
    return { added: 0, error: err?.message };
  }
}

/**
 * Admin-only: grants a student immediate access to a classroom by email.
 * Creates the classroom doc on-demand if it doesn't exist, adds the student
 * to enrolledStudentIds, and ensures the user's enrollment record is present.
 * Intended for support use-cases where a student reports missing access after
 * purchase.
 */
export async function grantStudentClassroomAccess(
  idToken: string,
  courseId: string,
  studentEmail: string,
): Promise<{ error?: string; studentName?: string }> {
  try {
    const caller = await getCallerContext(idToken);
    if (!caller) return { error: 'User not found.' };
    if (!['admin', 'superadmin', 'subadmin'].includes(caller.role)) {
      return { error: 'Unauthorized.' };
    }

    const trimmedEmail = studentEmail.trim().toLowerCase();
    if (!trimmedEmail) return { error: 'Student email is required.' };

    // Find student by email
    const usersSnap = await adminDb
      .collection('users')
      .where('email', '==', trimmedEmail)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return { error: `No account found for email: ${trimmedEmail}` };
    }

    const studentDoc = usersSnap.docs[0];
    const studentUid = studentDoc.id;
    const studentData = studentDoc.data() as any;
    const studentName: string = studentData.name || trimmedEmail;

    // Ensure the user has an enrollment record for this course
    const enrollments: { courseId: string; enrolledDate: string; completedLessons: string[] }[] =
      Array.isArray(studentData.enrollments) ? studentData.enrollments : [];
    const alreadyEnrolled = enrollments.some((e) => e.courseId === courseId);

    if (!alreadyEnrolled) {
      await adminDb.doc(`users/${studentUid}`).update({
        enrollments: FieldValue.arrayUnion({
          courseId,
          enrolledDate: new Date().toISOString(),
          completedLessons: [],
        }),
      });
    }

    // Add to enrollment index and ensure classroom doc has the student
    await addUserToCourseEnrollmentIndex(courseId, studentUid, 'admin');
    await ensureClassroomAndAddStudent(courseId, studentUid);

    console.info('[grantStudentClassroomAccess] Access granted', {
      courseId,
      studentUid,
      studentEmail: trimmedEmail,
      grantedBy: caller.uid,
    });

    return { studentName };
  } catch (err: any) {
    console.error('[grantStudentClassroomAccess]', err?.message);
    return { error: err?.message };
  }
}

export async function removeUserFromClassroom(
  idToken: string,
  classroomId: string,
  userId: string,
): Promise<{ error?: string }> {
  try {
    const caller = await getCallerContext(idToken);
    if (!caller) return { error: 'User not found.' };

    const classroomRef = adminDb.doc(`classrooms/${classroomId}`);
    const classroomSnap = await classroomRef.get();
    if (!classroomSnap.exists) return { error: 'Classroom not found.' };
    const classroom = classroomSnap.data() as any;

    if (!canManageClassroom(caller.role, caller.uid, classroom.tutorId || '')) {
      return { error: 'Unauthorized.' };
    }
    if (!userId || userId === classroom.tutorId) {
      return { error: 'Cannot remove class owner.' };
    }

    const userRef = adminDb.doc(`users/${userId}`);
    await adminDb.runTransaction(async (tx) => {
      const classroomTxSnap = await tx.get(classroomRef);
      if (!classroomTxSnap.exists) return;
      const classroomTx = classroomTxSnap.data() as any;

      const userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        const userData = userSnap.data() as any;
        const enrollments: { courseId: string; enrolledDate: string; completedLessons: string[] }[] = Array.isArray(userData.enrollments)
          ? userData.enrollments
          : [];
        tx.update(userRef, {
          enrollments: enrollments.filter((e) => e.courseId !== classroomTx.courseId),
        });
      }
      const nextMembers = normalizeMembers(classroomTx).filter((member) => member.userId !== userId);
      const nextIds = normalizeMemberIds(classroomTx).filter((id) => id !== userId);
      tx.update(classroomRef, {
        enrolledStudentIds: FieldValue.arrayRemove(userId),
        members: nextMembers,
        memberCount: nextIds.length,
        updatedAt: new Date().toISOString(),
      });
    });

    await removeUserFromCourseEnrollmentIndex(classroom.courseId, userId);

    return {};
  } catch (err: any) {
    console.error('[removeUserFromClassroom]', err?.message);
    return { error: err?.message };
  }
}

export async function deleteClassroomMessage(
  idToken: string,
  messageId: string,
): Promise<{ error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { error: 'User not found.' };
    const role = (userDoc.data() as any)?.role as string;

    const msgRef = adminDb.doc(`classroomMessages/${messageId}`);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) return { error: 'Message not found.' };
    const msgData = msgSnap.data() as any;

    const isAdminRole = ['admin', 'superadmin', 'subadmin'].includes(role);
    const isOwner = msgData.userId === uid;
    if (!isAdminRole && !isOwner) return { error: 'Unauthorized.' };

    // Soft delete — preserves thread context without exposing content.
    await msgRef.update({
      deleted: true,
      text: '',
      attachmentUrl: FieldValue.delete(),
      attachmentName: FieldValue.delete(),
      attachmentType: FieldValue.delete(),
    });
    return {};
  } catch (err: any) {
    console.error('[deleteClassroomMessage]', err?.message);
    return { error: err?.message };
  }
}

export async function editClassroomMessage(
  idToken: string,
  messageId: string,
  newText: string,
): Promise<{ error?: string }> {
  try {
    const trimmed = newText.trim();
    if (!trimmed) return { error: 'Message cannot be empty.' };

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const msgRef = adminDb.doc(`classroomMessages/${messageId}`);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) return { error: 'Message not found.' };
    const msgData = msgSnap.data() as any;

    if (msgData.userId !== uid) return { error: 'You can only edit your own messages.' };
    if (msgData.deleted) return { error: 'Cannot edit a deleted message.' };

    await msgRef.update({ text: trimmed, editedAt: new Date().toISOString() });
    return {};
  } catch (err: any) {
    console.error('[editClassroomMessage]', err?.message);
    return { error: err?.message };
  }
}

export async function reactToClassroomMessage(
  idToken: string,
  messageId: string,
  classroomId: string,
  emoji: string,
): Promise<{ error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { error: 'User not found.' };
    const userData = userDoc.data() as any;
    const role = userData.role as string;

    let classroomDoc = await adminDb.doc(`classrooms/${classroomId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', classroomId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }
    if (!classroomDoc || !classroomDoc.exists) return { error: 'Classroom not found.' };
    const classroom = classroomDoc.data() as any;

    let hasAccess = false;
    if (['admin', 'superadmin', 'subadmin'].includes(role)) hasAccess = true;
    else if (role === 'tutor' && classroom.tutorId === uid) hasAccess = true;
    else {
      const enrollments: { courseId: string }[] = userData.enrollments || [];
      const enrolledStudentIds: string[] = normalizeMemberIds(classroom);
      hasAccess = enrollments.some((e) => e.courseId === classroom.courseId)
        || enrolledStudentIds.includes(uid);
    }
    if (!hasAccess) return { error: 'Access denied.' };

    const msgRef = adminDb.doc(`classroomMessages/${messageId}`);
    await adminDb.runTransaction(async (tx) => {
      const msgSnap = await tx.get(msgRef);
      if (!msgSnap.exists) throw new Error('Message not found.');
      const msgData = msgSnap.data() as any;
      const reactions: Record<string, string[]> = { ...(msgData.reactions || {}) };
      const users = reactions[emoji] || [];
      if (users.includes(uid)) {
        reactions[emoji] = users.filter((id) => id !== uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, uid];
      }
      tx.update(msgRef, { reactions });
    });
    return {};
  } catch (err: any) {
    console.error('[reactToClassroomMessage]', err?.message);
    return { error: err?.message };
  }
}

export async function getOlderClassroomMessages(
  idToken: string,
  classroomId: string,
  channel: ClassroomChannel,
  beforeTimestamp: string,
  pageSize = 50,
): Promise<{ messages: ClassroomMessage[]; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { messages: [], error: 'User not found.' };
    const userData = userDoc.data() as any;
    const role = userData.role as string;

    let classroomDoc = await adminDb.doc(`classrooms/${classroomId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', classroomId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }
    if (!classroomDoc || !classroomDoc.exists) return { messages: [], error: 'Classroom not found.' };
    const classroom = classroomDoc.data() as any;

    let hasAccess = false;
    if (['admin', 'superadmin', 'subadmin'].includes(role)) hasAccess = true;
    else if (role === 'tutor' && classroom.tutorId === uid) hasAccess = true;
    else {
      const enrollments: { courseId: string }[] = userData.enrollments || [];
      const enrolledStudentIds: string[] = normalizeMemberIds(classroom);
      hasAccess = enrollments.some((e) => e.courseId === classroom.courseId)
        || enrolledStudentIds.includes(uid);
    }
    if (!hasAccess) return { messages: [], error: 'Access denied.' };

    const snap = await adminDb
      .collection('classroomMessages')
      .where('classroomId', '==', classroomDoc.id)
      .where('channel', '==', channel)
      .orderBy('timestamp', 'desc')
      .startAfter(beforeTimestamp)
      .limit(pageSize)
      .get();

    // Returned in descending order — reverse so oldest-first for display prepending.
    const messages: ClassroomMessage[] = snap.docs
      .map((doc) => ({ ...(doc.data() as Omit<ClassroomMessage, 'id'>), id: doc.id }))
      .reverse();

    return { messages };
  } catch (err: any) {
    console.error('[getOlderClassroomMessages]', err?.message);
    return { messages: [], error: err?.message };
  }
}

/**
 * Updates user presence in a classroom (heartbeat).
 * Called periodically (e.g., every 30 seconds) to mark user as online.
 */
export async function updateUserPresence(
  idToken: string,
  classroomId: string,
  status: 'online' | 'away' | 'dnd' | 'offline' = 'online',
): Promise<{ error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const presenceRef = adminDb.collection('classroomPresence').doc(`${classroomId}_${uid}`);
    await presenceRef.set({
      userId: uid,
      classroomId,
      status,
      lastSeen: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return {};
  } catch (err: any) {
    console.error('[updateUserPresence]', err?.message);
    return { error: err?.message };
  }
}

/**
 * Creates a reply to a message (thread reply).
 */
export async function createThreadReply(
  idToken: string,
  classroomId: string,
  parentMessageId: string,
  text: string,
  richContent?: string,
  attachmentUrl?: string,
  attachmentName?: string,
  attachmentType?: string,
): Promise<{ error?: string; messageId?: string }> {
  try {
    const trimmedText = text.trim();
    if (!trimmedText && !attachmentUrl) return { error: 'Reply cannot be empty.' };

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { error: 'User not found.' };
    const userData = userDoc.data() as any;

    let classroomDoc = await adminDb.doc(`classrooms/${classroomId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', classroomId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }
    if (!classroomDoc || !classroomDoc.exists) return { error: 'Classroom not found.' };

    const role = userData.role as string;
    const classroom = classroomDoc.data() as any;

    let hasAccess = false;
    if (['admin', 'superadmin', 'subadmin'].includes(role)) hasAccess = true;
    else if (role === 'tutor' && classroom.tutorId === uid) hasAccess = true;
    else {
      const enrollments: { courseId: string }[] = userData.enrollments || [];
      const enrolledStudentIds: string[] = normalizeMemberIds(classroom);
      hasAccess = enrollments.some((e) => e.courseId === classroom.courseId)
        || enrolledStudentIds.includes(uid);
    }

    if (!hasAccess) return { error: 'Access denied.' };

    const messageRef = adminDb.collection('threadMessages').doc();
    const message = {
      classroomId: classroomDoc.id,
      parentMessageId,
      userId: uid,
      userName: userData.name || 'User',
      userAvatar: userData.avatar || '',
      userRole: role,
      text: trimmedText,
      timestamp: new Date().toISOString(),
      ...(richContent ? { richContent } : {}),
      ...(attachmentUrl ? { attachmentUrl } : {}),
      ...(attachmentName ? { attachmentName } : {}),
      ...(attachmentType ? { attachmentType } : {}),
    };
    await messageRef.set(message);

    // Increment thread count on parent message
    await adminDb.doc(`classroomMessages/${parentMessageId}`).update({
      threadCount: FieldValue.increment(1),
    }).catch(() => undefined);

    return { messageId: messageRef.id };
  } catch (err: any) {
    console.error('[createThreadReply]', err?.message);
    return { error: err?.message };
  }
}

/**
 * Fetches all replies to a message (thread).
 */
export async function getThreadMessages(
  idToken: string,
  classroomId: string,
  parentMessageId: string,
): Promise<{ messages: any[]; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { messages: [], error: 'User not found.' };
    const userData = userDoc.data() as any;
    const role = userData.role as string;

    let classroomDoc = await adminDb.doc(`classrooms/${classroomId}`).get();
    if (!classroomDoc.exists) {
      const byCourseId = await adminDb
        .collection('classrooms')
        .where('courseId', '==', classroomId)
        .limit(1)
        .get();
      classroomDoc = byCourseId.docs[0];
    }
    if (!classroomDoc || !classroomDoc.exists) return { messages: [], error: 'Classroom not found.' };
    const classroom = classroomDoc.data() as any;

    let hasAccess = false;
    if (['admin', 'superadmin', 'subadmin'].includes(role)) hasAccess = true;
    else if (role === 'tutor' && classroom.tutorId === uid) hasAccess = true;
    else {
      const enrollments: { courseId: string }[] = userData.enrollments || [];
      const enrolledStudentIds: string[] = normalizeMemberIds(classroom);
      hasAccess = enrollments.some((e) => e.courseId === classroom.courseId)
        || enrolledStudentIds.includes(uid);
    }
    if (!hasAccess) return { messages: [], error: 'Access denied.' };

    const snap = await adminDb
      .collection('threadMessages')
      .where('parentMessageId', '==', parentMessageId)
      .orderBy('timestamp', 'asc')
      .get();

    const messages = snap.docs.map((doc) => ({
      ...(doc.data() as any),
      id: doc.id,
    }));

    return { messages };
  } catch (err: any) {
    console.error('[getThreadMessages]', err?.message);
    return { messages: [], error: err?.message };
  }
}

/**
 * Pins a message in the classroom.
 * Only admins, subadmins, or the tutor of the classroom can pin messages.
 */
export async function pinClassroomMessage(
  idToken: string,
  messageId: string,
): Promise<{ error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { error: 'User not found.' };
    const userData = userDoc.data() as any;
    const role = userData.role as string;

    const msgDoc = await adminDb.doc(`classroomMessages/${messageId}`).get();
    if (!msgDoc.exists) return { error: 'Message not found.' };
    const msgData = msgDoc.data() as any;

    const classroomId = msgData.classroomId as string;
    const classroomRef = adminDb.doc(`classrooms/${classroomId}`);
    const classroomSnap = await classroomRef.get();
    if (!classroomSnap.exists) return { error: 'Classroom not found.' };
    const classroom = classroomSnap.data() as any;

    const canPin =
      ['admin', 'superadmin', 'subadmin'].includes(role) ||
      (role === 'tutor' && classroom.tutorId === uid);
    if (!canPin) return { error: 'Only tutors and admins can pin messages.' };

    const pinnedEntry = {
      messageId,
      text: msgData.text || '',
      userName: msgData.userName || 'User',
      pinnedAt: new Date().toISOString(),
      pinnedBy: uid,
      channel: msgData.channel || 'general',
    };

    const currentPinned: any[] = Array.isArray(classroom.pinnedMessages)
      ? classroom.pinnedMessages
      : [];

    // Avoid duplicate pins
    if (currentPinned.some((p: any) => p.messageId === messageId)) {
      return {};
    }

    // Max 10 pinned messages per classroom
    const updatedPinned = [pinnedEntry, ...currentPinned].slice(0, 10);
    await classroomRef.update({ pinnedMessages: updatedPinned });
    return {};
  } catch (err: any) {
    console.error('[pinClassroomMessage]', err?.message);
    return { error: err?.message };
  }
}

/**
 * Unpins a message from the classroom.
 * Only admins, subadmins, or the tutor of the classroom can unpin messages.
 */
export async function unpinClassroomMessage(
  idToken: string,
  classroomId: string,
  messageId: string,
): Promise<{ error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { error: 'User not found.' };
    const userData = userDoc.data() as any;
    const role = userData.role as string;

    const classroomRef = adminDb.doc(`classrooms/${classroomId}`);
    const classroomSnap = await classroomRef.get();
    if (!classroomSnap.exists) return { error: 'Classroom not found.' };
    const classroom = classroomSnap.data() as any;

    const canUnpin =
      ['admin', 'superadmin', 'subadmin'].includes(role) ||
      (role === 'tutor' && classroom.tutorId === uid);
    if (!canUnpin) return { error: 'Only tutors and admins can unpin messages.' };

    const currentPinned: any[] = Array.isArray(classroom.pinnedMessages)
      ? classroom.pinnedMessages
      : [];
    const updatedPinned = currentPinned.filter((p: any) => p.messageId !== messageId);
    await classroomRef.update({ pinnedMessages: updatedPinned });
    return {};
  } catch (err: any) {
    console.error('[unpinClassroomMessage]', err?.message);
    return { error: err?.message };
  }
}

