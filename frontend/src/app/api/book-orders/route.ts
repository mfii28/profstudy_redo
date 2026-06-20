import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { isAdminRole, validateTrustedServerContext } from '@/lib/trusted-server-context';

export async function GET(req: NextRequest) {
  const ctx = await validateTrustedServerContext(req);
  if (!ctx.success || !ctx.userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const scope = req.nextUrl.searchParams.get('scope');
    const status = req.nextUrl.searchParams.get('status');

    const canViewAll = isAdminRole(ctx.role) && scope === 'all';
    const snap = canViewAll
      ? await adminDb.collection('bookPurchases').get()
      : await adminDb.collection('bookPurchases').where('userId', '==', ctx.userId).get();

    let orders: Array<Record<string, unknown> & { id: string }> = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>),
    }));

    if (!canViewAll) {
      const ownedBookIds = new Set(
        orders
          .map((order) => (typeof order.bookId === 'string' ? order.bookId : ''))
          .filter(Boolean)
      );

      const userSnap = await adminDb.doc(`users/${ctx.userId}`).get();
      const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
      const enrollments = Array.isArray(userData?.enrollments)
        ? (userData.enrollments as Array<{ courseId?: string; enrolledDate?: string }>)
        : [];
      const enrolledCourseIds = Array.from(
        new Set(
          enrollments
            .map((enrollment) => (typeof enrollment.courseId === 'string' ? enrollment.courseId : ''))
            .filter(Boolean)
        )
      );

      const courseBookGrants = new Map<string, { courseId: string; grantedAt: string }>();

      for (let i = 0; i < enrolledCourseIds.length; i += 100) {
        const chunk = enrolledCourseIds.slice(i, i + 100);
        const refs = chunk.map((courseId) => adminDb.doc(`courses/${courseId}`));
        const courseSnaps = await adminDb.getAll(...refs);

        courseSnaps.forEach((courseSnap) => {
          if (!courseSnap.exists) return;
          const courseData = courseSnap.data() as Record<string, unknown>;
          const courseId = courseSnap.id;
          const enrollment = enrollments.find((item) => item.courseId === courseId);
          const grantedAt = enrollment?.enrolledDate || new Date().toISOString();
          const books = Array.isArray(courseData.books)
            ? (courseData.books as Array<{ id?: string }>)
            : [];

          books.forEach((bookRef) => {
            if (!bookRef?.id || typeof bookRef.id !== 'string') return;
            if (!courseBookGrants.has(bookRef.id)) {
              courseBookGrants.set(bookRef.id, { courseId, grantedAt });
            }
          });
        });
      }

      const missingLinkedBookIds = Array.from(courseBookGrants.keys()).filter((bookId) => !ownedBookIds.has(bookId));
      for (let i = 0; i < missingLinkedBookIds.length; i += 100) {
        const chunk = missingLinkedBookIds.slice(i, i + 100);
        const refs = chunk.map((bookId) => adminDb.doc(`books/${bookId}`));
        const bookSnaps = await adminDb.getAll(...refs);

        bookSnaps.forEach((bookSnap) => {
          if (!bookSnap.exists) return;
          const bookData = bookSnap.data() as Record<string, unknown>;
          const grant = courseBookGrants.get(bookSnap.id);
          if (!grant) return;

          const status = String(bookData.status || '').toLowerCase();
          if (status !== 'published') return;

          orders.push({
            id: `course-book-${grant.courseId}-${bookSnap.id}`,
            userId: ctx.userId!,
            bookId: bookSnap.id,
            bookTitle: String(bookData.title || 'Course Book'),
            bookType: String(bookData.type || 'digital'),
            amount: 0,
            purchasedAt: grant.grantedAt,
            paymentReference: `course:${grant.courseId}`,
            orderReference: `course-book:${grant.courseId}:${bookSnap.id}`,
            source: 'course_enrollment',
            grantedViaCourseId: grant.courseId,
          });
        });
      }
    }

    if (status) {
      orders = orders.filter((order) => String(order.deliveryStatus || '').toLowerCase() === status.toLowerCase());
    }

    orders.sort((a, b) => new Date(String(b.purchasedAt || 0)).getTime() - new Date(String(a.purchasedAt || 0)).getTime());

    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch book orders.' }, { status: 500 });
  }
}
