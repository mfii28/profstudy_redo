import { z } from 'zod';

/**
 * @fileOverview Production-grade validation schemas
 * SECURITY: All user inputs validated before server processing
 */

// Authentication
export const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
  password: z.string().min(1, 'Password required'),
});

// Cart & Checkout
export const cartItemSchema = z.object({
  id: z.string().min(1),
  productId: z.string().optional(),
  title: z.string().min(1).max(200),
  price: z.number().positive(),
  quantity: z.number().int().min(1).max(100),
  itemType: z.enum(['course', 'product']),
  imageUrl: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.itemType === 'course' && data.quantity !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Course quantity must be exactly 1.',
      path: ['quantity'],
    });
  }
});

export const userAddressSchema = z.object({
  line1: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  region: z.string().min(1).max(100),
  zip: z.string().max(20).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
});

// Lightweight schema for checkout input — title/price are re-fetched server-side
export const checkoutInputItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
  itemType: z.enum(['course', 'product']),
  coursePurchaseOption: z.enum(['course_only', 'course_with_book']).optional(),
  attachedBookId: z.string().optional(),
});

export const checkoutPayloadSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  items: z.array(checkoutInputItemSchema).min(1),
    amount: z.number().min(0),
  address: userAddressSchema.nullable(),
});

// Course
export const courseUpdateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().positive().optional(),
  isFree: z.boolean().optional(),
  status: z.enum(['Draft', 'Published', 'Under Review', 'Rejected']).optional(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().min(10).max(1000),
  courseId: z.string().min(1),
});

// Support Ticket
export const supportTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  category: z.enum(['Technical Issue', 'Billing & Payments', 'Course Content', 'Other']),
  description: z.string().min(10).max(5000),
});

// Email Preferences
export const emailPreferencesSchema = z.object({
  subscribedToMarketing: z.boolean().optional(),
  subscribedToTransactional: z.boolean().optional(),
});

// Zoom Meeting
export const zoomMeetingSchema = z.object({
  // Zoom Video SDK uses session names (any alphanumeric string), not numeric meeting IDs
  meetingId: z.string().min(1).max(200).regex(/^[\w\-]+$/, 'Invalid meeting ID'),
  role: z.number().int().min(0).max(1),
});

// AIAssistant
export const aiQuestionSchema = z.object({
  question: z.string().min(1).max(2000),
  courseId: z.string().optional(),
  context: z.string().optional(),
});

/**
 * Validation helpers
 */
export function validateCheckout(data: unknown) {
  try {
    return checkoutPayloadSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
}

export function validateCartItem(data: unknown) {
  return cartItemSchema.parse(data);
}

export function validateAddress(data: unknown) {
  return userAddressSchema.parse(data);
}
