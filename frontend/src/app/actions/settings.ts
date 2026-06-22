'use server';

import prisma from '@/lib/prisma';
import { type GlobalSettings, defaultGlobalSettings } from '@/lib/platform-settings-data';

export async function getGlobalSettingsAction(forceRefresh = false): Promise<GlobalSettings> {
  try {
    const record = await prisma.platformSettings.findUnique({
      where: { id: 'master-config' }
    });
    if (record && record.settings) {
      return { ...defaultGlobalSettings, ...(record.settings as any) };
    }
    return defaultGlobalSettings;
  } catch (error) {
    console.error('getGlobalSettingsAction error:', error);
    return defaultGlobalSettings;
  }
}

export async function setGlobalSettingsAction(settings: GlobalSettings): Promise<void> {
  try {
    await prisma.platformSettings.upsert({
      where: { id: 'master-config' },
      update: {
        settings: settings as any,
      },
      create: {
        id: 'master-config',
        settings: settings as any,
      }
    });
  } catch (error) {
    console.error('setGlobalSettingsAction error:', error);
    throw new Error('Database connection unavailable.');
  }
}
