'use client';

import { apiFetch } from '@/lib/api-client';
import type { User } from '@/lib/db';

export type Conversation = { id: string; participants: string[]; lastMessage?: string; updatedAt: string };
export type DirectMessage = { id: string; conversationId: string; senderId: string; content: string; timestamp: string };

const PHONE_PATTERN = /[\+\(]?\d[\d\s\-\(\)]{6,}\d/g;
const OFF_PLATFORM_PATTERN = /(whatsapp|telegram|phone|call me|contact me|email me|my email|my number)/gi;
const CONTACT_REDIRECT_PATTERN = /(?:contact|email|phone|whatsapp|telegram)\s*(?::|at|us at|me at)?\s*[\w\.]+@[\w\.]+|[\+\(]?\d{7,}/gi;

export function moderateMessageContent(content: string): { isClean: boolean; reason?: string } {
  if (PHONE_PATTERN.test(content)) return { isClean: false, reason: 'Phone numbers are not allowed.' };
  if (OFF_PLATFORM_PATTERN.test(content)) return { isClean: false, reason: 'Off-platform contact details are not allowed.' };
  if (CONTACT_REDIRECT_PATTERN.test(content)) return { isClean: false, reason: 'Contact information is not allowed.' };
  return { isClean: true };
}

export function normalizeTimestamp(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return new Date().toISOString();
}

export const getConversations = async (_userId: string): Promise<Conversation[]> => {
  try { const r = await apiFetch('/messages/conversations'); if (!r.ok) return []; return (await r.json()).conversations || []; } catch { return []; }
};

export const getMessages = async (_conversationId: string): Promise<DirectMessage[]> => {
  try { const r = await apiFetch(`/messages/${_conversationId}`); if (!r.ok) return []; return (await r.json()).messages || []; } catch { return []; }
};

export const subscribeToConversations = (_userId: string, _onUpdate: (c: Conversation[]) => void, _onError?: () => void): (() => void) => {
  return () => {};
};

export const subscribeToMessages = (_conversationId: string, _onUpdate: (m: DirectMessage[]) => void, _onError?: () => void): (() => void) => {
  return () => {};
};

export const sendMessage = async (_conversationId: string, _senderId: string, content: string): Promise<{ blocked: boolean; reason?: string }> => {
  const mod = moderateMessageContent(content);
  if (!mod.isClean) return { blocked: true, reason: mod.reason };
  try { await apiFetch('/messages', { method: 'POST', body: JSON.stringify({ conversationId: _conversationId, senderId: _senderId, content }) }); } catch { /* ignore */ }
  return { blocked: false };
};

export const createConversation = async (_participants: string[], _courseId?: string): Promise<string> => {
  try { const r = await apiFetch('/messages/conversations', { method: 'POST', body: JSON.stringify({ participants: _participants, courseId: _courseId }) }); if (r.ok) return (await r.json()).id; } catch { /* ignore */ }
  return `conv-${Date.now()}`;
};

export const getInstructorsForStudent = async (_enrolledCourseIds: string[]): Promise<User[]> => {
  try {
    const r = await apiFetch(`/tutor/students`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.users || data.students || [];
  } catch {
    return [];
  }
};
