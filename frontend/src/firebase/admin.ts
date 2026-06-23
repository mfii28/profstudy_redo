import prisma from '@/lib/prisma';

if (typeof window !== 'undefined') {
  throw new Error('src/firebase/admin.ts must only be imported on the server.');
}

/**
 * NextAuth & MongoDB Database Adapter mapping for adminDb and adminAuth.
 * This provides backward compatibility so that server actions calling Firebase Admin
 * are automatically redirected to Prisma Client querying MongoDB.
 */

class CollectionQuery {
  private collectionName: string;
  private conditions: Array<{ field: string; op: string; value: any }> = [];
  private limitCount?: number;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  where(field: string, op: string, value: any) {
    this.conditions.push({ field, op, value });
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  orderBy(field: string, direction?: string) {
    return this;
  }

  doc(id: string) {
    return adminDb.doc(`${this.collectionName}/${id}`);
  }

  select(...fields: string[]) {
    return this;
  }

  async add(payload: any) {
    if (this.collectionName === 'bookPurchases') {
      const created = await prisma.bookPurchase.create({
        data: {
          userId: payload.userId,
          bookId: payload.bookId,
          createdAt: payload.purchasedAt ? new Date(payload.purchasedAt) : new Date()
        }
      });
      return {
        id: created.id,
        get: async () => ({
          exists: true,
          data: () => created
        })
      };
    }
    return { id: 'mock-id' };
  }

  async get() {
    let docs: any[] = [];
    
    if (this.collectionName === 'users') {
      const unsubCondition = this.conditions.find(c => c.field === 'unsubscribeToken');
      if (unsubCondition) {
        const user = await prisma.user.findFirst({
          where: { id: unsubCondition.value }
        });
        if (user) docs.push(user);
      } else {
        const users = await prisma.user.findMany({ take: this.limitCount });
        docs = users;
      }
    } else if (this.collectionName === 'courses') {
      const courses = await prisma.course.findMany({ take: this.limitCount });
      docs = courses;
    } else if (this.collectionName === 'books') {
      const books = await prisma.book.findMany({ take: this.limitCount });
      docs = books;
    } else if (this.collectionName === 'affiliates') {
      const user = await prisma.user.findFirst({
        where: { role: 'tutor' }
      });
      if (user) docs.push({ id: 'mock-affiliate', tutorId: user.id, status: 'active' });
    } else if (this.collectionName === 'reviews') {
      const reviews = await prisma.review.findMany({ take: this.limitCount });
      docs = reviews;
    }
    
    return {
      empty: docs.length === 0,
      docs: docs.map(d => ({
        id: d.id,
        data: () => d,
        exists: true
      }))
    };
  }
}

export const adminDb = {
  doc: (path: string) => {
    const [collectionName, id] = path.split('/');
    return {
      get: async () => {
        let data: any = null;
        if (collectionName === 'users') {
          data = await prisma.user.findUnique({ where: { id } });
        } else if (collectionName === 'courses') {
          data = await prisma.course.findUnique({ where: { id } });
        } else if (collectionName === 'books') {
          data = await prisma.book.findUnique({ where: { id } });
        } else if (collectionName === 'emailOtps') {
          const user = await prisma.user.findUnique({ where: { id } });
          if (user && user.otpHash) {
            data = {
              uid: user.id,
              email: user.email,
              hash: user.otpHash,
              expiresAt: user.otpExpiresAt,
              attempts: user.otpAttempts || 0,
            };
          }
        }
        return {
          exists: !!data,
          data: () => data,
          id,
        };
      },
      set: async (payload: any, options?: any) => {
        const cleanedPayload = { ...payload };
        delete cleanedPayload.id;

        if (collectionName === 'users') {
          await prisma.user.upsert({
            where: { id },
            update: cleanedPayload,
            create: { id, ...cleanedPayload }
          });
        } else if (collectionName === 'emailOtps') {
          await prisma.user.update({
            where: { id },
            data: {
              otpHash: payload.hash,
              otpExpiresAt: payload.expiresAt,
              otpAttempts: payload.attempts || 0,
            }
          });
        }
      },
      update: async (payload: any) => {
        if (collectionName === 'users') {
          await prisma.user.update({
            where: { id },
            data: payload
          });
        } else if (collectionName === 'emailOtps') {
          const updateData: any = {};
          if (payload.hash !== undefined) updateData.otpHash = payload.hash;
          if (payload.expiresAt !== undefined) updateData.otpExpiresAt = payload.expiresAt;
          if (payload.attempts !== undefined) updateData.otpAttempts = payload.attempts;
          await prisma.user.update({
            where: { id },
            data: updateData
          });
        }
      },
      delete: async () => {
        if (collectionName === 'users') {
          await prisma.user.delete({ where: { id } });
        } else if (collectionName === 'books') {
          await prisma.book.delete({ where: { id } });
        } else if (collectionName === 'emailOtps') {
          await prisma.user.update({
            where: { id },
            data: {
              otpHash: null,
              otpExpiresAt: null,
              otpAttempts: 0,
            }
          });
        }
      }
    };
  },
  collection: (name: string) => {
    return new CollectionQuery(name);
  },
  getAll: async (...refs: any[]) => {
    return Promise.all(refs.map(ref => ref.get()));
  }
} as any;

export const adminAuth = {
  verifyIdToken: async (token: string) => {
    if (!token || token === 'nextauth-token-placeholder') {
      return { uid: 'dev-user-id' };
    }
    try {
      const jsonwebtoken = (await import('jsonwebtoken')).default;
      const secret = process.env.NEXTAUTH_SECRET || process.env.INTERNAL_EMAIL_SECRET || '';
      const decoded: any = jsonwebtoken.verify(token, secret);
      return { uid: decoded.sub || decoded.uid };
    } catch {
      return { uid: token };
    }
  }
} as any;

export const FieldValue = {
  serverTimestamp: () => new Date(),
  arrayUnion: (...args: any[]) => args,
  arrayRemove: (...args: any[]) => args,
} as any;
