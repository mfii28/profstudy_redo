import { apiFetch } from '@/lib/api-client';
import type { Assignment } from '@/lib/db';

/**
 * @fileOverview Data service for course assignments.
 * Routes through the Python backend REST API.
 */

export async function getAssignments(): Promise<Assignment[]> {
    try {
        const res = await apiFetch('/assignments');
        if (!res.ok) return [];
        return (await res.json()).assignments || [];
    } catch (error) {
        console.error("[AssignmentData] Failed to fetch assignments:", error);
        return [];
    }
}

export async function getAssignmentsByUserId(userId: string): Promise<Assignment[]> {
    try {
        const res = await apiFetch(`/assignments?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return [];
        return (await res.json()).assignments || [];
    } catch (error) {
        console.error("[AssignmentData] Failed to fetch assignments:", error);
        return [];
    }
}

export async function saveAssignment(assignment: Assignment): Promise<void> {
    await apiFetch('/assignments', {
        method: 'POST',
        body: JSON.stringify(assignment),
    });
}
