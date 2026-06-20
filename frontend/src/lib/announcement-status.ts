import type { Announcement } from '@/lib/db';

export const ANNOUNCEMENTS_SEEN_EVENT = 'announcements-seen-updated';

const getAnnouncementLastSeenKey = (userId: string) => `student-announcements-last-seen:${userId}`;

const parseTimestamp = (value?: string | null) => {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const getLastSeenAnnouncementAt = (userId: string) => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(getAnnouncementLastSeenKey(userId));
};

export const markAnnouncementsSeen = (userId: string, seenAt = new Date().toISOString()) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(getAnnouncementLastSeenKey(userId), seenAt);
  window.dispatchEvent(new CustomEvent(ANNOUNCEMENTS_SEEN_EVENT, { detail: { userId, seenAt } }));
};

export const isAnnouncementNew = (announcementDate: string, lastSeenAt?: string | null) => {
  if (!lastSeenAt) return true;
  return parseTimestamp(announcementDate) > parseTimestamp(lastSeenAt);
};

export const hasUnreadAnnouncements = (announcements: Announcement[], lastSeenAt?: string | null) => {
  return announcements.some((announcement) => isAnnouncementNew(announcement.date, lastSeenAt));
};