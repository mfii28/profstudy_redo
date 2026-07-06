'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { type GlobalSettings, defaultGlobalSettings } from '@/lib/platform-settings-data';

export async function getGlobalSettingsAction(forceRefresh = false): Promise<GlobalSettings> {
  try {
    const data = await apiFetchServer('/api/v1/admin/settings/master-config');
    if (data && data.settings) {
      return { ...defaultGlobalSettings, ...data.settings };
    }
    return defaultGlobalSettings;
  } catch (error) {
    console.error('getGlobalSettingsAction error:', error);
    return defaultGlobalSettings;
  }
}

export async function setGlobalSettingsAction(settings: GlobalSettings): Promise<void> {
  try {
    await apiFetchServer('/api/v1/admin/settings/master-config', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  } catch (error: any) {
    console.error('setGlobalSettingsAction error:', error);
    throw new Error(error.message || 'Database connection unavailable.');
  }
}
