'use client';

/**
 * @fileOverview Data service for role-based access control.
 * Routes through the Python backend REST API.
 */

import type { Role } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getRoles = async (): Promise<Role[]> => {
    try {
        const res = await apiFetch('/admin/roles');
        if (!res.ok) return [];
        const data = await res.json();
        return data.roles || [];
    } catch {
        return [];
    }
};

export const saveRole = async (role: Role): Promise<void> => {
    await apiFetch('/admin/roles', {
        method: 'POST',
        body: JSON.stringify(role),
    });
};

export const getPermissions = async (): Promise<string[]> => {
    try {
        const res = await apiFetch('/admin/permissions');
        if (!res.ok) return [];
        const data = await res.json();
        return data.permissions || [];
    } catch {
        return [];
    }
};

export const saveRoleWithPermissions = async (role: Role, permissions: string[]): Promise<void> => {
    await apiFetch('/admin/roles', {
        method: 'POST',
        body: JSON.stringify({ role, permissions }),
    });
};

export const hasPermission = async (userIdOrUser: string | { id?: string } | undefined, permission: string): Promise<boolean> => {
    const userId = typeof userIdOrUser === 'string' ? userIdOrUser : userIdOrUser?.id;
    if (!userId) return false;
    try {
        const res = await apiFetch(`/admin/users/${userId}/permissions`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.permissions?.includes(permission) || false;
    } catch {
        return false;
    }
};

export const getAllPermissions = async (): Promise<string[]> => {
    try {
        const res = await apiFetch('/admin/permissions');
        if (!res.ok) return [];
        const data = await res.json();
        return (data.permissions as string[]) || [];
    } catch {
        return [];
    }
};

export const saveRoles = async (roles: Role[]): Promise<void> => {
    await Promise.all(roles.map(role => saveRole(role)));
};
