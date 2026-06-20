'use client';

import { collection, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Role } from '@/lib/db';

type RoleName = 'student' | 'tutor' | 'admin' | 'subadmin' | 'superadmin';

type PermissionUser = {
  role?: RoleName;
  roleId?: string;
};

export const getRoles = async (): Promise<Role[]> => {
    if (!db) return [];
    const rolesCollection = collection(db, 'roles');
    const snapshot = await getDocs(rolesCollection);
    if (!snapshot.empty) {
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Role));
    }

    // No roles exist yet. Use a sentinel document as a mutex so that only the
    // first concurrent caller creates the default admin role and subsequent
    // callers get the collection snapshot instead.
    const sentinelRef = doc(db, 'roles', '__init__');
    const sentinelSnap = await getDoc(sentinelRef);
    if (sentinelSnap.exists()) {
        // Another tab/client already started initialisation – refetch.
        const refetch = await getDocs(rolesCollection);
        return refetch.docs
            .filter(d => d.id !== '__init__')
            .map(d => ({ id: d.id, ...d.data() } as Role));
    }

    const defaultRole: Role = {
        id: 'admin-default',
        name: 'Admin',
        description: 'Default administrator with all permissions.',
        permissions: Object.values(getAllPermissions()).flat().map(p => p.id),
    };
    await saveRoles([defaultRole]);
    return [defaultRole];
};

export const saveRoles = async (roles: Role[]): Promise<void> => {
    if (!db) return;
    const batch = writeBatch(db);
    roles.forEach(role => {
        const docRef = doc(db, 'roles', role.id);
        batch.set(docRef, role);
    });
    await batch.commit();
};

export const getRoleById = async (roleId: string): Promise<Role | undefined> => {
    if (!db) return undefined;
    const docRef = doc(db, 'roles', roleId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Role : undefined;
}

// Static list of all available permissions
export const getAllPermissions = () => {
  return {
    'Dashboard': [
      { id: 'dashboard:view:main', label: 'View Main Dashboard' },
      { id: 'dashboard:view:analytics', label: 'View Global Analytics' },
    ],
    'User Management': [
      { id: 'users:read', label: 'View All Users' },
      { id: 'users:create', label: 'Create Users' },
      { id: 'users:edit', label: 'Edit User Details' },
      { id: 'users:delete', label: 'Delete Users' },
      { id: 'users:edit:role', label: 'Change User Roles' },
      { id: 'users:suspend', label: 'Suspend or Un-suspend Users' },
    ],
    'Course Management': [
      { id: 'courses:read', label: 'View All Courses' },
      { id: 'courses:create', label: 'Create New Courses' },
      { id: 'courses:edit', label: 'Edit Courses' },
      { id: 'courses:delete', label: 'Delete Courses' },
      { id: 'courses:approve', label: 'Approve or Reject Courses' },
    ],
    'Financial Management': [
      { id: 'finance:read', label: 'View Financial Ledger & Reports' },
      { id: 'finance:approve:payouts', label: 'Approve Instructor Payouts' },
      { id: 'finance:process:refunds', label: 'Process Refunds' },
    ],
     'System & Security': [
      { id: 'system:read:logs', label: 'View System & Audit Logs' },
      { id: 'system:manage:backups', label: 'Manage System Backups' },
      { id: 'security:manage:rules', label: 'Manage IP Rules & Bans' },
    ],
  };
};

const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, string[]> = {
    student: [],
    tutor: [],
    admin: Object.values(getAllPermissions()).flat().map((permission) => permission.id),
    subadmin: [
      'dashboard:view:main',
      'dashboard:view:analytics',
      'users:read',
      'courses:read',
      'courses:approve',
      'finance:read',
    ],
    superadmin: ['*'],
};

export const hasPermission = async (
    user: PermissionUser | undefined,
    permissionId: string
  ): Promise<boolean> => {
    if (!user?.role) return false;

    if (user.role === 'superadmin') {
      return true;
    }

    if (user.roleId) {
      // getRoleById may throw on Firestore errors — let the error propagate so
      // callers can handle it; do NOT silently fall back to default permissions,
      // as that could grant unintended access on transient DB failures.
      const role = await getRoleById(user.roleId);
      if (role) {
        return role.permissions.includes(permissionId) || role.permissions.includes('*');
      }
      // roleId provided but role document not found — deny and log
      console.warn('[RBAC] Role document not found for roleId:', user.roleId);
      return false;
    }

    // No custom roleId — use the static default permissions for this role
    const fallbackPermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    return fallbackPermissions.includes(permissionId) || fallbackPermissions.includes('*');
};
