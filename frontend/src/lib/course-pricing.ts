import type { Course } from '@/lib/db';

/** Sum of attached book list prices for a course. */
export function sumAttachedBookPrices(course: Pick<Course, 'books'>): number {
  return (course.books || []).reduce((sum, b) => sum + (Number(b.price) || 0), 0);
}

/**
 * Course-only list price (does not include attached book prices).
 * Supports legacy `basePrice` and courses where only `price` (total) was stored.
 */
export function getCourseListingPrice(course: Pick<Course, 'listingPrice' | 'basePrice' | 'price' | 'books'>): number {
  if (typeof course.listingPrice === 'number' && !Number.isNaN(course.listingPrice)) {
    return course.listingPrice;
  }
  if (typeof course.basePrice === 'number' && !Number.isNaN(course.basePrice)) {
    return course.basePrice;
  }
  const books = sumAttachedBookPrices(course);
  const total = Number(course.price || 0);
  return Math.max(0, total - books);
}

/** Total marketplace price: listing + all attached books. */
export function getCourseTotalListPrice(course: Pick<Course, 'listingPrice' | 'basePrice' | 'price' | 'books'>): number {
  return getCourseListingPrice(course) + sumAttachedBookPrices(course);
}

export function normalizeCoursePriceStatus(
  status: Course['priceStatus'] | undefined
): 'free' | 'paid' | undefined {
  if (status === 'premium') return 'paid';
  if (status === 'free' || status === 'paid') return status;
  return undefined;
}
