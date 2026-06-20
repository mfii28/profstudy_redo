
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove, query, where, orderBy, documentId, limit } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Course, CourseBundle, CourseCategory, User } from './db';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { logger } from '@/lib/logging';

function getCourseSubmissionErrors(course: Course): string[] {
  const errors: string[] = [];
  const totalLessons = course.sections?.flatMap(section => section.lessons).length || 0;

  if (!course.title || course.title === 'Untitled Course') {
    errors.push('Add a descriptive course title.');
  }

  if (!course.subtitle || course.subtitle.trim().length === 0) {
    errors.push('Add a course subtitle.');
  }

  if ((course.description?.length || 0) <= 100) {
    errors.push('Course description must be at least 100 characters.');
  }

  if (!course.imageUrl || course.imageUrl.trim().length === 0) {
    errors.push('Add a course thumbnail image.');
  }

  if (!course.instructor?.name || course.instructor.name.trim().length === 0) {
    errors.push('Set an instructor name for the course.');
  }

  if ((course.whatYoullLearn?.length || 0) < 3) {
    errors.push('Provide at least 3 learning objectives.');
  }

  if (totalLessons < 3) {
    errors.push('Add at least 3 lessons in the curriculum.');
  }

  if (course.isFree === false && (course.price || 0) <= 0) {
    errors.push('Set a valid price or mark the course as free.');
  }

  if (!course.program) {
    errors.push('Select a program for this course.');
  }

  if (!course.cat_id) {
    errors.push('Select a category for this course.');
  }

  return errors;
}

/**
 * @fileOverview Isomorphic Data Service for Course Marketplace.
 * PRODUCTION: Proper error logging and input validation.
 */

export const getCourses = async (): Promise<Course[]> => {
    if (!db) {
      logger.warn('[Course Data] Firestore not initialized');
      return [];
    }
    const coursesCollection = collection(db, 'courses');

    try {
        const snapshot = await getDocs(coursesCollection);
        const courses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course));
        logger.info('[Course Data] Courses fetched', { count: courses.length });
        return courses;
    } catch (error: any) {
        if (error?.code === 'permission-denied') {
          try {
            const publishedQuery = query(coursesCollection, where('status', 'in', ['Published', 'published']));
            const snapshot = await getDocs(publishedQuery);
            const courses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course));
            logger.info('[Course Data] Fetched published-only courses after permission fallback', {
              count: courses.length,
            });
            return courses;
          } catch (fallbackError: any) {
            logger.error('[Course Data] Published fallback query failed', {
              errorMessage: fallbackError.message,
              errorCode: fallbackError.code,
            });
          }
        }

        logger.error('[Course Data] Failed to fetch courses', {
          errorMessage: error.message,
          errorCode: error.code,
        });
        return [];
    }
};

export const getPublishedCourses = async (): Promise<Course[]> => {
  if (!db) return [];
  try {
    const coursesCollection = collection(db, 'courses');
    const publishedQuery = query(coursesCollection, where('status', 'in', ['Published', 'published']));
    const snapshot = await getDocs(publishedQuery);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course));
  } catch (error) {
    console.error('[CourseData] Failed to fetch published courses:', error);
    return [];
  }
};

export const getFeaturedCourses = async (limitCount: number = 4): Promise<Course[]> => {
  if (!db) return [];
  try {
    const coursesCollection = collection(db, 'courses');
    const q = query(
      coursesCollection, 
      where('status', 'in', ['Published', 'published']),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course));
  } catch (error) {
    logger.error('[CourseData] Featured courses fetch failed', { error });
    return [];
  }
};

export const getCoursesByIds = async (courseIds: string[]): Promise<Course[]> => {
  if (!db || courseIds.length === 0) return [];

  const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));
  const chunks: string[][] = [];

  for (let index = 0; index < uniqueCourseIds.length; index += 10) {
    chunks.push(uniqueCourseIds.slice(index, index + 10));
  }

  try {
    const snapshots = await Promise.all(
      chunks.map((ids) => {
        const coursesCollection = collection(db, 'courses');
        const scopedQuery = query(coursesCollection, where(documentId(), 'in', ids));
        return getDocs(scopedQuery);
      })
    );

    const courseMap = new Map<string, Course>();

    snapshots.forEach((snapshot) => {
      snapshot.docs.forEach((courseDoc) => {
        courseMap.set(courseDoc.id, { ...courseDoc.data(), id: courseDoc.id } as Course);
      });
    });

    return uniqueCourseIds
      .map((courseId) => courseMap.get(courseId))
      .filter(Boolean) as Course[];
  } catch (error) {
    console.error('[CourseData] Failed to fetch courses by IDs:', error);
    return [];
  }
};

export const getCoursesByTutorId = async (tutorId: string): Promise<Course[]> => {
    if (!db || !tutorId) return [];
    try {
        const coursesCollection = collection(db, 'courses');
        const [ownedSnapshot, assignedSnapshot] = await Promise.all([
          getDocs(query(coursesCollection, where("tutorId", "==", tutorId), orderBy("updatedAt", "desc"))),
          getDocs(query(coursesCollection, where("assignedTutorIds", "array-contains", tutorId), orderBy("updatedAt", "desc"))),
        ]);
        const byId = new Map<string, Course>();
        [...ownedSnapshot.docs, ...assignedSnapshot.docs].forEach((courseDoc) => {
          byId.set(courseDoc.id, { ...courseDoc.data(), id: courseDoc.id } as Course);
        });
        return Array.from(byId.values()).sort(
          (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
    } catch (error: any) {
        if (error.code === 'failed-precondition') {
            const coursesCollection = collection(db, 'courses');
            const [ownedSnapshot, assignedSnapshot] = await Promise.all([
              getDocs(query(coursesCollection, where("tutorId", "==", tutorId))),
              getDocs(query(coursesCollection, where("assignedTutorIds", "array-contains", tutorId))),
            ]);
            const byId = new Map<string, Course>();
            [...ownedSnapshot.docs, ...assignedSnapshot.docs].forEach((courseDoc) => {
              byId.set(courseDoc.id, { ...courseDoc.data(), id: courseDoc.id } as Course);
            });
            return Array.from(byId.values());
        }
        return [];
    }
};

export const getCourseById = async (id: string): Promise<Course | undefined> => {
  if (!db) {
    logger.warn('[Course Data] Firestore not initialized');
    return undefined;
  }

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    logger.warn('[Course Data] Invalid course ID provided');
    return undefined;
  }

  try {
    const docRef = doc(db, 'courses', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      logger.warn('[Course Data] Course not found', { courseId: id });
      return undefined;
    }

    logger.info('[Course Data] Course retrieved', { courseId: id });
    return { ...docSnap.data(), id: docSnap.id } as Course;
  } catch (error: any) {
    logger.error('[Course Data] Failed to fetch course', {
      courseId: id,
      errorMessage: error.message,
      errorCode: error.code,
    });
    return undefined;
  }
};

export const saveCourse = async (courseToSave: Course, tutorId?: string): Promise<void> => {
  if (!db) {
    logger.warn('[Course Data] Cannot save course - Firestore not initialized');
    throw new Error('Firestore not initialized');
  }

  const finalTutorId = tutorId || courseToSave.tutorId;
  
  if (!finalTutorId || typeof finalTutorId !== 'string' || finalTutorId.trim().length === 0) {
    logger.warn('[Course Data] Cannot save course - missing tutor ID');
    throw new Error('Missing tutor ID');
  }

  if (!courseToSave.id || typeof courseToSave.id !== 'string' || courseToSave.id.trim().length === 0) {
    logger.warn('[Course Data] Cannot save course - missing course ID');
    throw new Error('Missing course ID');
  }

  const courseData = {
    ...courseToSave,
    tutorId: finalTutorId,
    createdByTutorId: courseToSave.createdByTutorId || finalTutorId,
    assignedTutorIds: Array.from(new Set([...(courseToSave.assignedTutorIds || []), finalTutorId])),
    updatedAt: new Date().toISOString()
  };

  if (courseData.status === 'Under Review') {
    const submissionErrors = getCourseSubmissionErrors(courseData);
    if (submissionErrors.length > 0) {
      const validationMessage = `Course is not ready for review: ${submissionErrors.join(' ')}`;
      logger.warn('[Course Data] Course submission blocked by validation', {
        courseId: courseData.id,
        tutorId: finalTutorId,
        submissionErrors,
      });
      throw new Error(validationMessage);
    }
  }

  const courseRef = doc(db, 'courses', courseData.id);
  const userRef = doc(db, 'users', finalTutorId);
  const batch = writeBatch(db);

  let previousTutorId = '';
  try {
    const existingCourseSnap = await getDoc(courseRef);
    if (existingCourseSnap.exists()) {
      previousTutorId = String((existingCourseSnap.data() as { tutorId?: unknown }).tutorId || '');
    }
  } catch (lookupError: any) {
    logger.warn('[Course Data] Could not resolve previous tutor before save', {
      courseId: courseData.id,
      errorMessage: lookupError.message,
    });
  }
  
  batch.set(courseRef, courseData, { merge: true });
  batch.set(userRef, {
    tutorDetails: {
      coursesTaught: arrayUnion(courseData.id)
    }
  }, { merge: true });

  if (previousTutorId && previousTutorId !== finalTutorId) {
    const previousTutorRef = doc(db, 'users', previousTutorId);
    batch.set(previousTutorRef, {
      tutorDetails: {
        coursesTaught: arrayRemove(courseData.id)
      }
    }, { merge: true });
  }
  
  try {
    await batch.commit();
    logger.info('[Course Data] Course saved successfully', {
      courseId: courseData.id,
      tutorId: finalTutorId,
    });
  } catch (serverError: any) {
    logger.error('[Course Data] Failed to save course', {
      courseId: courseData.id,
      tutorId: finalTutorId,
      errorMessage: serverError.message,
      errorCode: serverError.code,
    });

    if (serverError.code === 'permission-denied') {
      const permissionError = new FirestorePermissionError({
        path: `courses/${courseData.id} OR users/${finalTutorId}`,
        operation: 'write',
        requestResourceData: courseData,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    }
    throw serverError;
  }
};

export const assignCourseToTutor = async (courseToAssign: Course, tutor: Pick<User, 'id' | 'name' | 'avatar'>): Promise<void> => {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  if (!courseToAssign?.id) {
    throw new Error('Missing course ID');
  }

  if (!tutor?.id) {
    throw new Error('Missing tutor ID');
  }

  const previousTutorId = courseToAssign.tutorId;
  const updatedCourse: Course = {
    ...courseToAssign,
    tutorId: tutor.id,
    instructor: {
      name: tutor.name || courseToAssign.instructor?.name || 'Academic Expert',
      title: courseToAssign.instructor?.title || 'Instructor',
      avatar: tutor.avatar || courseToAssign.instructor?.avatar || '',
      bio: courseToAssign.instructor?.bio || '',
    },
    updatedAt: new Date().toISOString(),
  };

  const courseRef = doc(db, 'courses', updatedCourse.id);
  const newTutorRef = doc(db, 'users', tutor.id);
  const batch = writeBatch(db);

  batch.set(courseRef, updatedCourse, { merge: true });
  batch.set(newTutorRef, {
    tutorDetails: {
      coursesTaught: arrayUnion(updatedCourse.id),
    },
  }, { merge: true });

  if (previousTutorId && previousTutorId !== tutor.id) {
    const previousTutorRef = doc(db, 'users', previousTutorId);
    batch.set(previousTutorRef, {
      tutorDetails: {
        coursesTaught: arrayRemove(updatedCourse.id),
      },
    }, { merge: true });
  }

  await batch.commit();

  logger.info('[Course Data] Course reassigned', {
    courseId: updatedCourse.id,
    fromTutorId: previousTutorId,
    toTutorId: tutor.id,
  });
};

export const deleteCourse = async (id: string, tutorId?: string): Promise<void> => {
  if (!db) {
    throw new Error('Firestore not initialized');
  }
  const courseRef = doc(db, 'courses', id);
  
  try {
    if (tutorId) {
      const userRef = doc(db, 'users', tutorId);
      const batch = writeBatch(db);
      batch.delete(courseRef);
      batch.set(userRef, {
        tutorDetails: {
          coursesTaught: arrayRemove(id)
        }
      }, { merge: true });
      
      await batch.commit();
    } else {
      await deleteDoc(courseRef);
    }
    logger.info('[Course Data] Course deleted successfully', { courseId: id, tutorId });
  } catch (serverError: any) {
    logger.error('[Course Data] Failed to delete course', { courseId: id, errorMessage: serverError.message });
    const permissionError = new FirestorePermissionError({
      path: courseRef.path,
      operation: 'delete',
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  }
};

export const getCategories = async (): Promise<CourseCategory[]> => {
    if (!db) return [];
    try {
        const categoriesCollection = collection(db, 'courseCategories');
        const snapshot = await getDocs(categoriesCollection);
        return snapshot.docs.map(doc => doc.data() as CourseCategory);
    } catch (error) {
        return [];
    }
}

export const saveCategories = async (categories: CourseCategory[]): Promise<void> => {
    if (!db) return;
    const batch = writeBatch(db);
    categories.forEach(category => {
        const docRef = doc(db, 'courseCategories', category.id);
        batch.set(docRef, category);
    });
    batch.commit().catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: 'courseCategories',
            operation: 'write',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}

export const getBundles = async (): Promise<CourseBundle[]> => {
    if (!db) return [];
    try {
        const bundlesCollection = collection(db, 'courseBundles');
        const snapshot = await getDocs(bundlesCollection);
        return snapshot.docs.map(doc => doc.data() as CourseBundle);
    } catch (error) {
        return [];
    }
}

export const saveBundle = async (bundle: CourseBundle): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, 'courseBundles', bundle.id);
    setDoc(docRef, bundle, { merge: true }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: bundle,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}

export const deleteBundle = async (bundleId: string): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, 'courseBundles', bundleId);
    deleteDoc(docRef).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}
