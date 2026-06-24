import type { User, Note, DiscussionThread, Enrollment, UserAddress, UserPreferences } from './db';
import { apiFetch } from '@/lib/api-client';

// DB is no longer available client-side; all operations route through the REST API.
// These stubs prevent crashes while preserving function signatures for callers.
const db: any = null;

type AuthProfileSeed = {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
};

/**
 * @fileOverview Shared Data Service for User Identities and Personalization.
 * Routes through the Python backend REST API.
 */

export const getUsers = async (page: number = 1, pageSize: number = 1000): Promise<{users: User[], hasMore: boolean}> => {
    try {
        const res = await apiFetch('/users/profile');
        if (!res.ok) return { users: [], hasMore: false };
        const data = await res.json();
        return { users: data.user ? [data.user] : [], hasMore: false };
    } catch (error) {
        console.error("[UserData] Failed to fetch users:", error);
        return { users: [], hasMore: false };
    }
};
    try {
        const usersCollection = collection(db, 'users');
        const q = query(usersCollection, orderBy('id'), limit(pageSize + 1));

        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs.slice(0, pageSize).map(doc => doc.data() as User);
        return {
            users,
            hasMore: querySnapshot.docs.length > pageSize,
        };
    } catch (error) {
        console.error("[UserData] Failed to fetch users:", error);
        return { users: [], hasMore: false };
    }
};

export const getUsersForBulkEmail = async (lastVisible: QueryDocumentSnapshot<DocumentData> | null, batchSize: number): Promise<{ users: User[], nextCursor: QueryDocumentSnapshot<DocumentData> | null }> => {
    if (!db) return { users: [], nextCursor: null };

    try {
        const usersCollection = collection(db, 'users');
        let q;

        if (lastVisible) {
            q = query(usersCollection, orderBy('email'), startAfter(lastVisible), limit(batchSize));
        } else {
            q = query(usersCollection, orderBy('email'), limit(batchSize));
        }

        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => doc.data() as User);
        const nextCursor = snapshot.docs.length === batchSize ? snapshot.docs[snapshot.docs.length - 1] : null;

        return { users, nextCursor };
    } catch (error) {
        console.error("[UserData] Failed to fetch users for bulk email:", error);
        return { users: [], nextCursor: null };
    }
};

export const getStudentsForTutor = async (taughtCourseIds: string[]): Promise<User[]> => {
    if (!db || taughtCourseIds.length === 0) return [];
    try {
        const usersCollection = collection(db, 'users');
        const q = query(usersCollection, where("role", "==", "student"), limit(100));
        const snapshot = await getDocs(q);
        const students = snapshot.docs.map(doc => doc.data() as User);
        
        return students.filter(student => 
            student.enrollments.some(e => taughtCourseIds.includes(e.courseId))
        );
    } catch (error) {
        console.error("[UserData] Failed to fetch tutor-specific students:", error);
        return [];
    }
};

export const getUserById = async (userId: string): Promise<User | undefined> => {
    if (!db) return undefined;
    try {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as User) : undefined;
    } catch (error) {
        console.error(`[UserData] Failed to fetch user ${userId}:`, error);
        return undefined;
    }
}

export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
    if (!db || userIds.length === 0) return [];

    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    const chunks: string[][] = [];

    for (let index = 0; index < uniqueUserIds.length; index += 10) {
        chunks.push(uniqueUserIds.slice(index, index + 10));
    }

    try {
        const snapshots = await Promise.all(
            chunks.map((ids) => {
                const usersCollection = collection(db, 'users');
                const scopedQuery = query(usersCollection, where(documentId(), 'in', ids));
                return getDocs(scopedQuery);
            })
        );

        const userMap = new Map<string, User>();

        snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((userDoc) => {
                userMap.set(userDoc.id, userDoc.data() as User);
            });
        });

        return uniqueUserIds
            .map((userId) => userMap.get(userId))
            .filter(Boolean) as User[];
    } catch (error) {
        console.error('[UserData] Failed to fetch users by IDs:', error);
        return [];
    }
};

export const buildDefaultUserProfile = (authUser: AuthProfileSeed): User => ({
    id: authUser.uid,
    name: authUser.displayName || 'Learner',
    email: authUser.email || '',
    role: 'student',
    status: 'active',
    avatar: authUser.photoURL || '',
    isPremium: false,
    enrollments: [],
    aiUsage: { tokensRemaining: 50, lastResetDate: new Date().toISOString() },
    studyStreak: 0,
    bio: '',
});

export const getOrCreateUserProfile = async (authUser: AuthProfileSeed): Promise<{ profile: User | undefined; isNew: boolean }> => {
    const existingProfile = await getUserById(authUser.uid);
    if (existingProfile) {
        return { profile: existingProfile, isNew: false };
    }

    const defaultProfile = buildDefaultUserProfile(authUser);
    await createUserProfile(defaultProfile);
    return { profile: defaultProfile, isNew: true };
};

export const getUserByEmail = async (email: string): Promise<User | undefined> => {
    if (!db) return undefined;
    try {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return undefined;

        const usersCollection = collection(db, 'users');
        let snapshot = await getDocs(query(usersCollection, where("email", "==", normalizedEmail), limit(1)));

        // Legacy fallback for records stored without normalization.
        if (snapshot.empty && email.trim() !== normalizedEmail) {
            snapshot = await getDocs(query(usersCollection, where("email", "==", email.trim()), limit(1)));
        }

        if (snapshot.empty) {
            return undefined;
        }
        return snapshot.docs[0].data() as User;
    } catch (error) {
        console.error(`[UserData] Failed to fetch user by email ${email}:`, error);
        return undefined;
    }
}

export const createUserProfile = async (newUser: User): Promise<void> => {
    if (!db) return;
    const userRef = doc(db, 'users', newUser.id);
    await setDoc(userRef, newUser)
        .catch(async (error) => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'create',
                requestResourceData: newUser,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw new Error('Failed to create user profile.');
        });
};

export const updateUser = async (updatedUser: User): Promise<void> => {
    if (!db) return;
    const userRef = doc(db, 'users', updatedUser.id);
    await setDoc(userRef, updatedUser, { merge: true })
        .catch(async (error) => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: updatedUser,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
}

import { updateUserAddressAction, updateUserPreferencesAction, toggleWishlistAction } from '@/app/actions/user';

export const updateUserAddress = async (userId: string, address: UserAddress): Promise<void> => {
    const res = await updateUserAddressAction(address);
    if (res.error) throw new Error(res.error);
};

export const updateUserPreferences = async (userId: string, preferences: UserPreferences): Promise<void> => {
    const res = await updateUserPreferencesAction(preferences);
    if (res.error) throw new Error(res.error);
};

export const toggleWishlist = async (userId: string, courseId: string, isAdded: boolean): Promise<void> => {
    const res = await toggleWishlistAction(courseId, isAdded);
    if (res.error) throw new Error(res.error);
};

export const deductTokens = async (userId: string, amount: number): Promise<boolean> => {
    if (!db) return false;
    const userRef = doc(db, 'users', userId);
    try {
        await updateDoc(userRef, {
            'aiUsage.tokensRemaining': increment(-amount)
        });
        return true;
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        return false;
    }
}

export const deleteUser = async (userId: string): Promise<void> => {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}

export const enrollUserInCourse = async (email: string, courseId: string): Promise<{success: boolean, message: string}> => {
    if (!db) return { success: false, message: 'Database not connected.'};
    const normalizedEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(normalizedEmail);
    if (!user) return { success: false, message: 'User not found.' };
    const courseRef = doc(db, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);
    if (!courseSnap.exists()) {
        return { success: false, message: 'Course not found.' };
    }

    const course = courseSnap.data() as { status?: string };
    if ((course.status || '').toLowerCase() !== 'published') {
        return { success: false, message: 'Course is not published for enrollment.' };
    }

    const isAlreadyEnrolled = user.enrollments.some(e => e.courseId === courseId);
    if (isAlreadyEnrolled) return { success: false, message: 'User is already enrolled.' };

    const newEnrollment: Enrollment = {
        courseId,
        enrolledDate: new Date().toISOString(),
        completedLessons: [],
    };

    const updatedEnrollments = [...user.enrollments, newEnrollment];
    const userRef = doc(db, 'users', user.id);
    try {
        await updateDoc(userRef, { enrollments: updatedEnrollments });
        return { success: true, message: 'User enrolled successfully.' };
    } catch {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: { enrollments: updatedEnrollments },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        return { success: false, message: 'Failed to enroll user.' };
    }
}

export const getNotes = async (userId?: string, lessonTitle?: string, lessonId?: string): Promise<Note[]> => {
    if (!db) return [];
    const notesCollection = collection(db, 'notes');
    let q = query(notesCollection);
    
    if (userId) {
        q = query(q, where('userId', '==', userId));
    }
    if (lessonId) {
        q = query(q, where('lessonId', '==', lessonId));
    } else if (lessonTitle) {
        q = query(q, where('lessonTitle', '==', lessonTitle));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data() as Note, id: doc.id }));
};

export const updateEnrollmentCompletedLessons = async (
    userId: string,
    courseId: string,
    completedLessonIds: string[]
): Promise<void> => {
    if (!db || !userId || !courseId) return;

    const userRef = doc(db, 'users', userId);
    await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) {
            throw new Error('User not found.');
        }

        const user = userSnap.data() as User;
        const updatedEnrollments = (user.enrollments || []).map((enrollment) =>
            enrollment.courseId === courseId
                ? { ...enrollment, completedLessons: completedLessonIds }
                : enrollment
        );

        tx.update(userRef, { enrollments: updatedEnrollments });
    }).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: {
                enrollments: [{ courseId, completedLessons: completedLessonIds }],
            },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw new Error('Failed to update lesson progress.');
    });
};

export const addNote = async (newNote: Note): Promise<void> => {
    if (!db) return;
    const noteRef = doc(db, 'notes', newNote.id);
    await setDoc(noteRef, newNote).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
            path: noteRef.path,
            operation: 'create',
            requestResourceData: newNote,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw new Error('Failed to create note.');
    });
}

export const updateNote = async (noteId: string, snippet: string): Promise<void> => {
    if (!db) return;
    const noteRef = doc(db, 'notes', noteId);
    await updateDoc(noteRef, { snippet, date: new Date().toISOString() }).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
            path: noteRef.path,
            operation: 'update',
            requestResourceData: { snippet },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw new Error('Failed to update note.');
    });
}

export const deleteNote = async (noteId: string): Promise<void> => {
    if (!db) return;
    const noteRef = doc(db, 'notes', noteId);
    await deleteDoc(noteRef).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
            path: noteRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw new Error('Failed to delete note.');
    });
}

export const addDiscussionThread = async (newThread: DiscussionThread): Promise<void> => {
    if (!db) return;
    const threadRef = doc(db, 'discussionThreads', newThread.id);
    await setDoc(threadRef, newThread).catch(async (error) => {
        const permissionError = new FirestorePermissionError({
            path: threadRef.path,
            operation: 'create',
            requestResourceData: newThread,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}
