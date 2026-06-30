'use client';

import type { User, Note, DiscussionThread, Enrollment, UserAddress, UserPreferences } from './db';

import { apiFetch } from '@/lib/api-client';

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
        const res = await apiFetch(`/admin/users?page=${page}&page_size=${pageSize}`);
        if (!res.ok) return { users: [], hasMore: false };
        const data = await res.json();
        return { users: data.users || [], hasMore: data.hasMore || false };
    } catch (error) {
        console.error("[UserData] Failed to fetch users:", error);
        return { users: [], hasMore: false };
    }
};

export const getUserById = async (userId: string): Promise<User | undefined> => {
    try {
        const res = await apiFetch(`/admin/users/${encodeURIComponent(userId)}`);
        if (!res.ok) return undefined;
        const data = await res.json();
        return data.user;
    } catch {
        return undefined;
    }
};

export const getUsersForBulkEmail = async (_lastVisible: any, _batchSize: number): Promise<{ users: User[], nextCursor: any | null }> => {
    return { users: [], nextCursor: null };
};

export const getStudentsForTutor = async (taughtCourseIds: string[]): Promise<User[]> => {
    if (taughtCourseIds.length === 0) return [];
    try {
        const res = await apiFetch('/tutor/students');
        if (!res.ok) return [];
        const data = await res.json();
        return data.students || [];
    } catch {
        return [];
    }
};

export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
    if (userIds.length === 0) return [];
    try {
        const res = await apiFetch('/users/profile');
        if (!res.ok) return [];
        const data = await res.json();
        return data.user ? [data.user] : [];
    } catch {
        return [];
    }
};

export const seedAuthProfile = async (profile: AuthProfileSeed): Promise<User> => {
    const res = await apiFetch('/users/bootstrap', {
        method: 'POST',
        body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error('Failed to seed profile');
    const data = await res.json();
    return data.user;
};

export const updateUser = async (idOrUser: string | Partial<User>, updates?: Partial<User>): Promise<void> => {
    const data = updates || (typeof idOrUser === 'object' ? idOrUser : {});
    await apiFetch(`/users/profile`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
    try {
        const res = await apiFetch(`/users/profile`);
        if (!res.ok) return undefined;
        const data = await res.json();
        return data.user?.email === email ? data.user : undefined;
    } catch {
        return undefined;
    }
};

export const updateUserPreferences = async (_userId: string, preferences: UserPreferences): Promise<void> => {
    await apiFetch('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ preferences }),
    });
};

export const toggleWishlist = async (_userId: string, courseId: string, isAdded: boolean): Promise<void> => {
    const res = await toggleWishlistAction(courseId, isAdded);
    if (res.error) throw new Error(res.error);
};

export const deductTokens = async (_userId: string, amount: number): Promise<boolean> => {
    return false;
};

export const createUserProfile = async (profile: AuthProfileSeed | Partial<User>): Promise<User> => {
    if ('uid' in profile) {
        return seedAuthProfile(profile as AuthProfileSeed);
    }
    const seed: AuthProfileSeed = {
        uid: (profile as any).id || '',
        displayName: (profile as any).name || (profile as any).displayName || null,
        email: (profile as any).email || null,
        photoURL: (profile as any).photoURL || (profile as any).avatar || null,
    };
    return seedAuthProfile(seed);
};

export const buildDefaultUserProfile = (_authUser?: any): User => ({
    id: _authUser?.uid || '',
    name: _authUser?.displayName || '',
    email: _authUser?.email || '',
    role: 'student',
} as User);

export const getUserProfileAction = async (_userId: string): Promise<User | null> => {
    try {
        const res = await apiFetch('/users/profile');
        if (!res.ok) return null;
        const data = await res.json();
        return data.user || null;
    } catch { return null; }
};

export const updateUserAddress = async (_userId: string, _address: UserAddress): Promise<void> => {
    await apiFetch('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ address: _address }),
    });
};

export const updateEnrollmentCompletedLessons = async (_userId: string, _courseId: string, _completedLessonIds: string[]): Promise<void> => {
    await apiFetch('/enrollments/progress', {
        method: 'PUT',
        body: JSON.stringify({ userId: _userId, courseId: _courseId, completedLessonIds: _completedLessonIds }),
    });
};

export const deleteUser = async (userId: string): Promise<void> => {
    // Not available via REST API yet
};

async function toggleWishlistAction(courseId: string, isAdded: boolean): Promise<{ error?: string }> {
    try {
        const res = await apiFetch(`/wishlist/${courseId}`, {
            method: isAdded ? 'PUT' : 'DELETE',
        });
        if (!res.ok) return { error: 'Failed to update wishlist' };
        return {};
    } catch {
        return { error: 'Failed to update wishlist' };
    }
}
