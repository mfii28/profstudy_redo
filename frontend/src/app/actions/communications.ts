'use server';
export const emitUserCommunicationEvent = async (args: any) => ({ success: true });
export const getCommunicationAttempts = async (args?: any) => [];
export async function getCommunicationProviderStatus(...args: any[]) { return { status: 'mocked' }; }
export async function loadCommunicationTemplatesAdmin(...args: any[]) { return { templates: [] }; }
export async function saveCommunicationTemplateAdmin(...args: any[]) { return { error: 'Not implemented' }; }
export async function sendTestCommunication(...args: any[]) { return { error: 'Not implemented' }; }
export async function sendTemplateTestCommunication(...args: any[]) { return { error: 'Not implemented' }; }
export async function previewAllSmsTemplatesAction(...args: any[]) { return { previews: [] }; }
export async function sendAllSmsTemplateTestsAction(...args: any[]) { return { error: 'Not implemented' }; }
export async function processCommunicationQueueNow(...args: any[]) { return { error: 'Not implemented' }; }
