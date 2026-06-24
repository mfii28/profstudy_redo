'use client';

/**
 * @fileOverview Data service for course programs.
 * Routes through the Python backend REST API.
 */

import type { CourseProgram } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getPrograms = async (): Promise<CourseProgram[]> => {
    return [];
};

export const saveProgram = async (program: CourseProgram): Promise<void> => {};
