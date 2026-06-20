'use client';

import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  addDoc,
  orderBy,
  updateDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { User } from '@/lib/db';

export type Conversation = {
  id: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  unreadCount: Record<string, number>;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: string;
};

const normalizeTimestamp = (value: unknown): string => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

export const getConversations = async (userId: string): Promise<Conversation[]> => {
  if (!db || !userId) return [];
  const convCollection = collection(db, 'conversations');
  const q = query(convCollection, where('participantIds', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => {
      const data = d.data() as Omit<Conversation, 'id'>;
      return {
        id: d.id,
        ...data,
        lastMessageAt: normalizeTimestamp(data.lastMessageAt),
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
};

export const getMessages = async (conversationId: string): Promise<DirectMessage[]> => {
  if (!db || !conversationId) return [];
  const messagesCollection = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesCollection, orderBy('timestamp', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data() as Omit<DirectMessage, 'id'>;
    return {
      id: d.id,
      ...data,
      timestamp: normalizeTimestamp(data.timestamp),
    };
  });
};

export const subscribeToConversations = (
  userId: string,
  onUpdate: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void,
) => {
  if (!db || !userId) return () => undefined;
  const convCollection = collection(db, 'conversations');
  const q = query(convCollection, where('participantIds', 'array-contains', userId));

  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs
      .map((d) => {
        const data = d.data() as Omit<Conversation, 'id'>;
        return {
          id: d.id,
          ...data,
          lastMessageAt: normalizeTimestamp(data.lastMessageAt),
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    onUpdate(conversations);
  }, (error) => {
    onError?.(error as Error);
  });
};

export const subscribeToMessages = (
  conversationId: string,
  onUpdate: (messages: DirectMessage[]) => void,
  onError?: (error: Error) => void,
) => {
  if (!db || !conversationId) return () => undefined;
  const messagesCollection = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesCollection, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((d) => {
      const data = d.data() as Omit<DirectMessage, 'id'>;
      return {
        id: d.id,
        ...data,
        timestamp: normalizeTimestamp(data.timestamp),
      };
    });
    onUpdate(messages);
  }, (error) => {
    onError?.(error as Error);
  });
};

// ─── Content Moderation ─────────────────────────────────────────────────────
const PHONE_PATTERN = /(\+?[\d][\d\s\-().]{6,}[\d])/;
const OFF_PLATFORM_PATTERN = /\b(whatsapp|telegram|wechat|signal|instagram|discord|facebook|viber|snapchat|tiktok)\b/i;
const CONTACT_REDIRECT_PATTERN = /\b(chat me on|contact me on|reach me on|message me on|text me on|call me on|find me on|add me on)\b/i;

export type SendMessageResult = { blocked: boolean; reason?: string };

export const moderateMessageContent = (content: string): SendMessageResult => {
  if (PHONE_PATTERN.test(content)) {
    return { blocked: true, reason: 'Sharing phone numbers is not allowed on the platform.' };
  }
  if (OFF_PLATFORM_PATTERN.test(content)) {
    return { blocked: true, reason: 'Redirecting conversations to external platforms is not permitted.' };
  }
  if (CONTACT_REDIRECT_PATTERN.test(content)) {
    return { blocked: true, reason: 'Please keep all communications within the platform.' };
  }
  return { blocked: false };
};

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  content: string,
): Promise<SendMessageResult> => {
  if (!db || !conversationId || !content.trim()) return { blocked: false };
  // Security: Moderate content before saving
  const moderation = moderateMessageContent(content);
  if (moderation.blocked) return moderation;

  const messagesCollection = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(messagesCollection, {
    conversationId,
    senderId,
    content: content.trim(),
    timestamp: new Date().toISOString(),
  });
  // Update conversation's last message
  const convRef = doc(db, 'conversations', conversationId);
  await updateDoc(convRef, {
    lastMessage: content.trim().slice(0, 100),
    lastMessageAt: new Date().toISOString(),
    lastSenderId: senderId,
  });
  return { blocked: false };
};

export const createConversation = async (
  currentUserId: string,
  currentUserName: string,
  currentUserAvatar: string,
  recipientId: string,
  recipientName: string,
  recipientAvatar: string,
): Promise<string> => {
  if (!db) throw new Error('Firestore not initialized');
  
  // Check if conversation already exists between these two users
  const existing = await getConversations(currentUserId);
  const found = existing.find(c =>
    c.participantIds.includes(recipientId) && c.participantIds.length === 2
  );
  if (found) return found.id;

  const convCollection = collection(db, 'conversations');
  const docRef = await addDoc(convCollection, {
    participantIds: [currentUserId, recipientId],
    participantNames: {
      [currentUserId]: currentUserName,
      [recipientId]: recipientName,
    },
    participantAvatars: {
      [currentUserId]: currentUserAvatar,
      [recipientId]: recipientAvatar,
    },
    lastMessage: '',
    lastMessageAt: new Date().toISOString(),
    lastSenderId: '',
    unreadCount: { [currentUserId]: 0, [recipientId]: 0 },
  });
  return docRef.id;
};

/**
 * Returns only the instructors of courses the student is enrolled in.
 * Enforces messaging restriction: students may only contact their own course instructors.
 */
export const getInstructorsForStudent = async (enrolledCourseIds: string[]): Promise<User[]> => {
  if (!db || enrolledCourseIds.length === 0) return [];
  try {
    const tutorIds = new Set<string>();
    await Promise.all(
      enrolledCourseIds.slice(0, 10).map(async (courseId) => {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (courseDoc.exists()) {
          const tutorId = courseDoc.data()?.tutorId;
          if (tutorId) tutorIds.add(tutorId as string);
        }
      })
    );
    if (tutorIds.size === 0) return [];

    const instructorDocs = await Promise.all(
      Array.from(tutorIds).map((id) => getDoc(doc(db, 'users', id)))
    );
    return instructorDocs
      .filter((d) => d.exists())
      .map((d) => ({ id: d.id, ...d.data() } as User));
  } catch (error) {
    console.error('[Messaging] Failed to load eligible instructors:', error);
    return [];
  }
};
