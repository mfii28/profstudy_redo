import { apiFetch } from '@/lib/api-client';
import type { Classroom, ClassroomMessage, ClassroomMember } from '@/lib/db';

export async function getClassroomById(courseId: string): Promise<Classroom> {
  const res = await apiFetch(`/classrooms/${courseId}`);
  if (!res.ok) throw new Error('Failed to fetch classroom');
  const data = await res.json();
  return data.classroom as Classroom;
}

export async function getClassroomMembers(courseId: string): Promise<ClassroomMember[]> {
  const res = await apiFetch(`/classrooms/${courseId}/members`);
  if (!res.ok) throw new Error('Failed to fetch members');
  const data = await res.json();
  return data.members as ClassroomMember[];
}

export async function updateUserPresence(courseId: string, status: string): Promise<void> {
  await apiFetch(`/classrooms/${courseId}/presence`, {
    method: 'POST',
    body: JSON.stringify({ status }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getClassroomUserProfile(courseId: string, userId: string) {
  const res = await apiFetch(`/classrooms/${courseId}/users/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch profile');
  const data = await res.json();
  return data.profile;
}

export async function getOlderClassroomMessages(courseId: string, channel: string, beforeTimestamp?: string): Promise<ClassroomMessage[]> {
  const res = await apiFetch(`/classroom-messages/${courseId}?channel=${channel}${beforeTimestamp ? `&before=${beforeTimestamp}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  const data = await res.json();
  return data.messages;
}

export async function sendClassroomMessage(courseId: string, channel: string, content: string, attachments: any[] = []): Promise<{ id: string }> {
  const res = await apiFetch(`/classroom-messages/`, {
    method: 'POST',
    body: JSON.stringify({ classroomId: courseId, channel, content, attachments }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function editClassroomMessage(messageId: string, content: string): Promise<void> {
  const res = await apiFetch(`/classroom-messages/${messageId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to edit message');
}

export async function deleteClassroomMessage(messageId: string): Promise<void> {
  const res = await apiFetch(`/classroom-messages/${messageId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete message');
}

export async function reactToClassroomMessage(messageId: string, emoji: string): Promise<void> {
  const res = await apiFetch(`/classroom-messages/${messageId}/react`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to react');
}

export async function createThreadReply(messageId: string, content: string, attachments: any[] = []): Promise<void> {
  const res = await apiFetch(`/classroom-messages/${messageId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content, attachments }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to reply');
}

export async function pinClassroomMessage(messageId: string): Promise<void> {
  const res = await apiFetch(`/classroom-messages/${messageId}/pin`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to pin');
}

export async function unpinClassroomMessage(messageId: string): Promise<void> {
  const res = await apiFetch(`/classroom-messages/${messageId}/unpin`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to unpin');
}

export async function repairMyClassroomAccess(courseId: string): Promise<void> {
  // Sync the student on the backend if they were missing
  const res = await apiFetch(`/classrooms/${courseId}/sync-student`, {
    method: 'POST',
    body: JSON.stringify({ courseId }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to repair access');
}
