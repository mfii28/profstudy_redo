'use server';

import { apiFetchServer } from '@/lib/api-client.server';

export async function isTempSuperadminSignupEnabled(): Promise<boolean> {
  try {
    const data = await apiFetchServer('/api/v1/admin/settings/superadmin-temp-signup');
    if (data && data.settings) {
      return typeof data.settings.enabled === 'boolean' ? data.settings.enabled : true;
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

    // NOTE: This now registers a normal user and you would have to manually make it superadmin.
    // In production, temp superadmin signup is a security risk. This action is disabled.
    return { error: 'Temp superadmin via direct DB creation is disabled in phase 5. Please use Firebase CLI or Admin SDK directly to set the first superadmin custom claims.' };
  } catch (error: any) {
    return { error: error?.message || 'Failed to create superadmin account.' };
  }
}

export async function disableTempSuperadminSignup(idToken: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await apiFetchServer('/api/v1/admin/settings/superadmin-temp-signup', {
      method: 'PUT',
      body: JSON.stringify({ settings: { enabled: false } }),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to disable temporary signup.' };
  }
}
