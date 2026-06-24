'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase-server';
import type { Course } from '@/lib/db';

function buildPlaceholderDoc(
  courseId: string,
  courseTitle: string,
  tutorId: string,
  instructorName: string
): Record<string, unknown> {
  const sessionId = `placeholder-${courseId}`;
  const now = new Date();
  const startTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  startTime.setUTCHours(12, 0, 0, 0);

  return {
    id: sessionId,
    title: `Live Session \u2014 ${courseTitle}`,
    courseId,
    meetingLink: 'https://zoom.us',
    instructor: instructorName,
    instructorId: tutorId,
    startTime: startTime.toISOString(),
    durationMinutes: 60,
    status: 'upcoming',
    isPlaceholder: true,
    createdAt: now.toISOString(),
  };
}

async function getInstructorName(tutorId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({ where: { id: tutorId } });
    return user?.name || 'Instructor';
  } catch (err: unknown) {
    console.warn('[getInstructorName] Could not fetch tutor name', tutorId, err instanceof Error ? err.message : String(err));
  }
  return 'Instructor';
}

/**
 * Checks whether a live class already exists for the given course.
 * If not, creates a placeholder one via Prisma.
 */
export async function ensureLiveClassForCourse(
  courseId: string,
  courseTitle: string,
  tutorId: string,
  idToken: string
): Promise<{ created: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) return { created: false, error: 'Unauthorized' };
    const callerId = caller.id;

    const isOwner = callerId === tutorId;
    let callerIsAdmin = false;
    if (!isOwner) {
      const dbUser = await prisma.user.findUnique({ where: { id: callerId } });
      callerIsAdmin = ['admin', 'superadmin', 'subadmin'].includes(dbUser?.role || '');
      if (!callerIsAdmin) {
        return { created: false, error: 'Access denied: must be course tutor or admin.' };
      }
    }

    if (isOwner && !callerIsAdmin) {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (course && course.tutorId !== callerId) {
        return { created: false, error: 'Access denied: course belongs to a different tutor.' };
      }
    }

    const existing = await prisma.liveClass.findFirst({
      where: { courseId }
    });

    if (existing) return { created: false };

    const instructorName = await getInstructorName(tutorId);
    const docData = buildPlaceholderDoc(courseId, courseTitle, tutorId, instructorName);
    
    await prisma.liveClass.create({
      data: {
        id: docData.id as string,
        title: docData.title as string,
        courseId,
        joinUrl: docData.meetingLink as string,
        instructor: instructorName,
        instructorId: tutorId,
        startTime: new Date(docData.startTime as string),
        durationMinutes: docData.durationMinutes as number,
        status: docData.status as string,
      }
    });

    return { created: true };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ensureLiveClassForCourse]', message);
    return { created: false, error: message };
  }
}

/**
 * Admin-only: scans all courses and creates a placeholder live class for any
 * course that has none linked. Returns a summary of what was created vs skipped.
 */
export async function backfillLiveClasses(
  idToken: string
): Promise<{ created: number; skipped: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) return { created: 0, skipped: 0, error: 'Unauthorized' };
    
    const dbUser = await prisma.user.findUnique({ where: { id: caller.id } });
    const isCallerAdmin = ['admin', 'superadmin', 'subadmin'].includes(dbUser?.role || '');
    if (!isCallerAdmin) return { created: 0, skipped: 0, error: 'Unauthorized' };

    const [courses, liveClasses] = await Promise.all([
      prisma.course.findMany(),
      prisma.liveClass.findMany(),
    ]);

    const coveredCourseIds = new Set<string>();
    liveClasses.forEach(lc => {
      if (lc.courseId) coveredCourseIds.add(lc.courseId);
    });

    let created = 0;
    let skipped = 0;

    for (const course of courses) {
      const courseId = course.id;
      if (coveredCourseIds.has(courseId)) {
        skipped++;
        continue;
      }

      const tutorId = course.tutorId;
      const instructorName = await getInstructorName(tutorId);

      const docData = buildPlaceholderDoc(
        courseId,
        course.title || 'Untitled Course',
        tutorId,
        instructorName
      );
      
      await prisma.liveClass.create({
        data: {
          id: docData.id as string,
          title: docData.title as string,
          courseId,
          joinUrl: docData.meetingLink as string,
          instructor: instructorName,
          instructorId: tutorId,
          startTime: new Date(docData.startTime as string),
          durationMinutes: docData.durationMinutes as number,
          status: docData.status as string,
        }
      });
      created++;
    }

    return { created, skipped };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[backfillLiveClasses]', message);
    return { created: 0, skipped: 0, error: message };
  }
}

/**
 * Server-side course creation with automatic live class initialization.
 */
export async function saveNewCourseWithLiveClass(
  course: Course,
  tutorId: string,
  idToken: string
): Promise<{ liveClassCreated: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) return { liveClassCreated: false, error: 'Unauthorized' };
    const callerId = caller.id;

    const isOwner = callerId === tutorId;
    if (!isOwner) {
      const dbUser = await prisma.user.findUnique({ where: { id: callerId } });
      const isCallerAdmin = ['admin', 'superadmin', 'subadmin'].includes(dbUser?.role || '');
      if (!isCallerAdmin) {
        return { liveClassCreated: false, error: 'Access denied: must be course tutor or admin.' };
      }
    }

    const existingCourse = await prisma.course.findUnique({
      where: { id: course.id }
    });
    const isNewCourse = !existingCourse;

    const instructorName = await getInstructorName(tutorId);
    
    // Save course in Prisma
    const courseData: any = {
      title: course.title,
      description: course.description || null,
      price: course.price || null,
      isFree: course.isFree || false,
      status: course.status || 'Draft',
      tutorId,
    };
    
    let tutorDetail = await prisma.tutorDetail.findUnique({ where: { userId: tutorId } });
    if (!tutorDetail) {
      tutorDetail = await prisma.tutorDetail.create({
        data: {
          userId: tutorId,
          verificationStatus: 'approved'
        }
      });
    }

    await prisma.course.upsert({
      where: { id: course.id },
      update: {
        ...courseData,
        tutorId: tutorDetail.id
      },
      create: {
        id: course.id,
        ...courseData,
        tutorId: tutorDetail.id
      }
    });

    if (isNewCourse) {
      const liveDoc = buildPlaceholderDoc(course.id, course.title, tutorId, instructorName);
      await prisma.liveClass.create({
        data: {
          id: liveDoc.id as string,
          title: liveDoc.title as string,
          courseId: course.id,
          joinUrl: liveDoc.meetingLink as string,
          instructor: instructorName,
          instructorId: tutorId,
          startTime: new Date(liveDoc.startTime as string),
          durationMinutes: liveDoc.durationMinutes as number,
          status: liveDoc.status as string,
        }
      });
    }

    return { liveClassCreated: isNewCourse };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[saveNewCourseWithLiveClass]', message);
    return { liveClassCreated: false, error: message };
  }
}

export async function getLiveClassesAction(): Promise<any[]> {
  try {
    const liveClasses = await prisma.liveClass.findMany({
      orderBy: { startTime: 'asc' },
    });
    return liveClasses.map(lc => ({
      id: lc.id,
      title: lc.title,
      courseId: lc.courseId || undefined,
      meetingLink: lc.joinUrl || undefined,
      instructor: lc.instructor || 'Instructor',
      instructorId: lc.instructorId,
      startTime: lc.startTime.toISOString(),
      durationMinutes: lc.durationMinutes || undefined,
      status: lc.status as any,
    }));
  } catch (error) {
    console.error('[LiveClassAction] Fetch error:', error);
    return [];
  }
}

export async function getLiveClassesForStudentAction(enrolledCourseIds: string[]): Promise<any[]> {
  try {
    const liveClasses = await prisma.liveClass.findMany({
      where: {
        courseId: { in: enrolledCourseIds }
      },
      orderBy: { startTime: 'asc' },
    });
    return liveClasses.map(lc => ({
      id: lc.id,
      title: lc.title,
      courseId: lc.courseId || undefined,
      meetingLink: lc.joinUrl || undefined,
      instructor: lc.instructor || 'Instructor',
      instructorId: lc.instructorId,
      startTime: lc.startTime.toISOString(),
      durationMinutes: lc.durationMinutes || undefined,
      status: lc.status as any,
    }));
  } catch (error) {
    console.error('[LiveClassAction] Student fetch error:', error);
    return [];
  }
}

export async function getLiveClassesByTutorIdAction(tutorId: string): Promise<any[]> {
  try {
    const liveClasses = await prisma.liveClass.findMany({
      where: { instructorId: tutorId },
      orderBy: { startTime: 'asc' },
    });
    return liveClasses.map(lc => ({
      id: lc.id,
      title: lc.title,
      courseId: lc.courseId || undefined,
      meetingLink: lc.joinUrl || undefined,
      instructor: lc.instructor || 'Instructor',
      instructorId: lc.instructorId,
      startTime: lc.startTime.toISOString(),
      durationMinutes: lc.durationMinutes || undefined,
      status: lc.status as any,
    }));
  } catch (error) {
    console.error('[LiveClassAction] Tutor fetch error:', error);
    return [];
  }
}

export async function addLiveClassAction(newClass: any): Promise<void> {
  try {
    await prisma.liveClass.upsert({
      where: { id: newClass.id },
      update: {
        title: newClass.title,
        courseId: newClass.courseId || null,
        joinUrl: newClass.meetingLink || null,
        instructor: newClass.instructor,
        instructorId: newClass.instructorId,
        startTime: new Date(newClass.startTime),
        durationMinutes: newClass.durationMinutes || null,
        status: newClass.status || 'upcoming',
      },
      create: {
        id: newClass.id,
        title: newClass.title,
        courseId: newClass.courseId || null,
        joinUrl: newClass.meetingLink || null,
        instructor: newClass.instructor,
        instructorId: newClass.instructorId,
        startTime: new Date(newClass.startTime),
        durationMinutes: newClass.durationMinutes || null,
        status: newClass.status || 'upcoming',
      }
    });
  } catch (error) {
    console.error('[LiveClassAction] Add error:', error);
    throw new Error('Failed to save live class');
  }
}

export async function deleteLiveClassAction(classId: string): Promise<void> {
  try {
    await prisma.liveClass.delete({
      where: { id: classId }
    });
  } catch (error) {
    console.error('[LiveClassAction] Delete error:', error);
    throw new Error('Failed to delete live class');
  }
}
