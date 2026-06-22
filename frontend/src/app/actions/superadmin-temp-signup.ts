'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function isTempSuperadminSignupEnabled(): Promise<boolean> {
  try {
    const config = await prisma.platformSettings.findUnique({
      where: { id: 'superadmin-temp-signup' }
    });
    if (config && config.settings) {
      const data = config.settings as any;
      return typeof data.enabled === 'boolean' ? data.enabled : true;
    }
    return true;
  } catch {
    return true;
  }
}

export async function createTempSuperadminAccount(params: {
  name: string;
  email: string;
  password: string;
  setupKey: string;
}): Promise<{ success?: boolean; error?: string; uid?: string }> {
  try {
    const expectedKey = process.env.SUPERADMIN_TEMP_SIGNUP_KEY;
    if (!expectedKey) return { error: 'Temporary signup is not configured.' };
    if (!params.setupKey || params.setupKey !== expectedKey) return { error: 'Invalid setup key.' };

    const enabled = await isTempSuperadminSignupEnabled();
    if (!enabled) return { error: 'Temporary superadmin signup is disabled.' };

    const email = params.email.trim().toLowerCase();
    const name = params.name.trim();
    const password = params.password;
    if (!name) return { error: 'Name is required.' };
    if (!email || !email.includes('@')) return { error: 'Valid email is required.' };
    if (!password || password.length < 10) return { error: 'Password must be at least 10 characters.' };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: 'A user with this email already exists.' };

    const passwordHash = await bcrypt.hash(password, 10);
    const uid = `superadmin-${Math.random().toString(36).substring(2, 15)}`;

    const now = new Date();
    await prisma.user.create({
      data: {
        id: uid,
        name,
        email,
        passwordHash,
        role: 'superadmin',
        status: 'active',
        avatar: '',
        bio: '',
        isPremium: true,
        studyStreak: 0,
        enrollments: {} as any,
        aiUsage: { tokensRemaining: 500, lastResetDate: now.toISOString() } as any,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      }
    });

    return { success: true, uid };
  } catch (error: any) {
    console.error('createTempSuperadminAccount error:', error);
    return { error: error?.message || 'Failed to create superadmin account.' };
  }
}

export async function disableTempSuperadminSignup(idToken: string): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!idToken) return { error: 'Authentication token required.' };

    const user = await prisma.user.findUnique({ where: { id: idToken } });
    if (!user || user.role !== 'superadmin') {
      return { error: 'Only superadmin can disable temporary signup.' };
    }

    const now = new Date();
    await prisma.platformSettings.upsert({
      where: { id: 'superadmin-temp-signup' },
      update: {
        settings: { enabled: false, disabledAt: now.toISOString(), disabledBy: user.id } as any,
      },
      create: {
        id: 'superadmin-temp-signup',
        settings: { enabled: false, disabledAt: now.toISOString(), disabledBy: user.id } as any,
      }
    });

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to disable temporary signup.' };
  }
}
