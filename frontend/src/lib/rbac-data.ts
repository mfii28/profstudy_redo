'use client';

/**
 * @fileOverview Data service for role-based access control.
 * Routes through the Python backend REST API.
 */

import type { Role, Permission } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getRoles = async (): Promise<Role[]> => {
    return [];
};

export const saveRole = async (role: Role): Promise<void> => {};

export const getPermissions = async (): Promise<Permission[]> => {
    return [];
};

export const saveRoleWithPermissions = async (role: Role, permissions: Permission[]): Promise<void> => {};
