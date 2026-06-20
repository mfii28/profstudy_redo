import type { Enrollment } from '@/lib/db';

export type RawCheckoutItem = {
  id?: string;
  title?: string;
  type?: string;
  price?: number;
};

type MetadataLike = Record<string, any> | string | null | undefined;

export function shouldProcessPaystackEvent(eventName?: string): boolean {
  return eventName === 'charge.success';
}

export function getOrderDocumentId(reference?: string): string {
  return `ord-${reference || 'unknown'}`;
}

export function parsePaystackMetadata(metadata: MetadataLike): Record<string, any> {
  if (!metadata) return {};

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof metadata === 'object' ? metadata : {};
}

export function getNewCourseEnrollments(
  items: RawCheckoutItem[],
  existingEnrollments: Enrollment[] = [],
  nowIso: string = new Date().toISOString()
): Enrollment[] {
  const existingIds = new Set(existingEnrollments.map((e) => e.courseId));
  const newIds = new Set<string>();

  for (const item of items) {
    if (item.type !== 'course' || !item.id) continue;
    if (existingIds.has(item.id)) continue;
    newIds.add(item.id);
  }

  return Array.from(newIds).map((courseId) => ({
    courseId,
    enrolledDate: nowIso,
    completedLessons: [],
  }));
}
