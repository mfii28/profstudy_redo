'use client';

/**
 * @fileOverview Data service for course programs.
 * Routes through the Python backend REST API.
 */

import type { CourseProgram } from '@/lib/db';

interface Category { id: string; name: string; }
import { apiFetch } from '@/lib/api-client';

export const getPrograms = async (): Promise<CourseProgram[]> => {
    try {
        const res = await apiFetch('/courses/');
        if (!res.ok) return [];
        const data = await res.json();
        return data.courses || [];
    } catch {
        return [];
    }
};

export const saveProgram = async (program: CourseProgram): Promise<void> => {};

export const addProgram = async (programOrName: CourseProgram | string): Promise<CourseProgram> => {
    const data = typeof programOrName === 'string' ? { id: `prog-${Date.now()}`, name: programOrName, description: '', courses: [], createdAt: new Date().toISOString() } as unknown as CourseProgram : programOrName;
    await apiFetch('/admin/programs', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return data;
};

export const updateProgram = async (programOrId: CourseProgram | string, data?: Partial<CourseProgram>): Promise<CourseProgram> => {
    if (typeof programOrId === 'string' && data) {
        const full = { id: programOrId, ...data } as CourseProgram;
        await apiFetch(`/admin/programs/${programOrId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        return full;
    }
    const program = programOrId as CourseProgram;
    await apiFetch(`/admin/programs/${program.id}`, {
        method: 'PUT',
        body: JSON.stringify(program),
    });
    return program;
};

export const deleteProgram = async (id: string): Promise<void> => {
    await apiFetch(`/admin/programs/${id}`, { method: 'DELETE' });
};

export const addCategoryToProgram = async (program: CourseProgram, category: Category): Promise<CourseProgram> => {
    const programId = typeof program === 'string' ? program : program.id;
    await apiFetch(`/admin/programs/${programId}/categories`, {
        method: 'POST',
        body: JSON.stringify(category),
    });
    const updated = { ...(typeof program === 'object' ? program : ({ id: programId } as CourseProgram)) };
    if (!updated.categories) updated.categories = [];
    updated.categories.push(category);
    return updated;
};

export const updateCategoryInProgram = async (program: CourseProgram, category: Category): Promise<CourseProgram> => {
    const programId = typeof program === 'string' ? program : program.id;
    await apiFetch(`/admin/programs/${programId}/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify(category),
    });
    const updated = { ...(typeof program === 'object' ? program : ({ id: programId } as CourseProgram)) };
    return updated;
};

export const deleteCategoryFromProgram = async (program: CourseProgram | string, categoryId: string): Promise<CourseProgram> => {
    const programId = typeof program === 'string' ? program : program.id;
    await apiFetch(`/admin/programs/${programId}/categories/${categoryId}`, { method: 'DELETE' });
    const updated = { ...(typeof program === 'object' ? program : ({ id: programId } as CourseProgram)) };
    return updated;
};
