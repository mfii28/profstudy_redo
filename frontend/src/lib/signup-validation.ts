/**
 * Signup form validation utilities for phone number, student registration number, and affiliate link.
 * Supports both client-side and server-side validation.
 */

import { z } from 'zod';
import { collection, getDocs, limit, query, where, type Firestore } from 'firebase/firestore';

// ============================================================================
// PHONE NUMBER VALIDATION
// ============================================================================

const PHONE_E164_REGEX = /^[+][1-9]\d{1,14}$/;

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validates phone number in E.164 format or common local formats.
 * - Supports E.164: "+233201234567"
 * - Supports Ghana local: "0201234567" → auto-converts to "+233201234567"
 * - Removes common separators: spaces, dashes, parentheses
 *
 * @param raw - Raw phone input from user
 * @returns Validation result with normalized E.164 format if valid
 */
export function validatePhoneNumber(raw: string): PhoneValidationResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Phone number is required.' };
  }

  // Remove common separators for normalization
  const cleaned = trimmed.replace(/[\s()\-─.]/g, '');

  // Check for E.164 format
  if (PHONE_E164_REGEX.test(cleaned)) {
    if (cleaned.startsWith('+233') && cleaned.length !== 13) {
      return { isValid: false, error: 'Ghana numbers must have 9 digits after +233.' };
    }
    return { isValid: true, normalized: cleaned };
  }

  // Fallback: Try to detect Ghana format (0XX + 7 digits) and convert to E.164
  // Common Ghana prefixes: 024, 025, 026, 027, 028, 029, 054, 055, 056, 057, 058, 059
  if (/^0\d{9}$/.test(cleaned)) {
    const normalized = '+233' + cleaned.substring(1);
    return { isValid: true, normalized };
  }

  // Support plain international format without plus: 233XXXXXXXXX
  if (/^233\d{9}$/.test(cleaned)) {
    return { isValid: true, normalized: `+${cleaned}` };
  }

  // If looks like local without country code, guide user
  if (/^\+?\d{7,15}$/.test(cleaned) && !cleaned.startsWith('+')) {
    return {
      isValid: false,
      error: 'Include country code (e.g., +233 for Ghana or use local format 02X).',
    };
  }

  return {
    isValid: false,
    error: 'Invalid phone format. Use E.164 (e.g., +233201234567) or local Ghana format (e.g., 0201234567).',
  };
}

// ============================================================================
// STUDENT REGISTRATION NUMBER VALIDATION
// ============================================================================

/** Firestore-friendly max length; no format enforced. */
export const STUDENT_REGISTRATION_NUMBER_MAX_LENGTH = 512;

export interface RegistrationNumberValidationResult {
  isValid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validates student registration / ID number: optional; any trimmed text up to max length.
 * Stored as provided (trimmed); duplicate checks use exact stored value.
 */
export function validateStudentRegistrationNumber(raw: string): RegistrationNumberValidationResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { isValid: true, normalized: undefined };
  }

  if (trimmed.length > STUDENT_REGISTRATION_NUMBER_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Registration number must be at most ${STUDENT_REGISTRATION_NUMBER_MAX_LENGTH} characters.`,
    };
  }

  return { isValid: true, normalized: trimmed };
}

// ============================================================================
// AFFILIATE LINK VALIDATION
// ============================================================================

const AFFILIATE_ALLOWED_DOMAINS = [
  'profstrainingsolutions.com',
  'www.profstrainingsolutions.com',
  'mytestingdomain.icu',
  'www.mytestingdomain.icu',
  'ref.profstrainingsolutions.com',
  'referral.profstrainingsolutions.com',
  // Legacy domain kept for backward compatibility with existing affiliate links
  'studymate.com',
  'www.studymate.com',
  'ref.studymate.com',
  'referral.studymate.com',
];

const AFFILIATE_URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const AFFILIATE_MAX_LENGTH = 512;

export interface AffiliationLinkValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validates affiliate link.
 * - Optional field (empty is valid)
 * - Must be valid URL if provided
 * - Must point to whitelisted domain
 * - Max 512 characters (prevents buffer overflow)
 *
 * Examples:
 *   "https://studymate.com/ref/user-id-123"     ✅ Valid
 *   "studymate.com/ref/user-id-123"             ❌ Invalid (missing protocol)
 *   "http://malicious.com/ref/ama"              ❌ Invalid (blocked domain)
 *   ""                                           ✅ Valid (optional field)
 *
 * @param raw - Raw affiliate link input from user
 * @returns Validation result with sanitized URL if valid
 */
export function validateAffiliateLink(raw: string): AffiliationLinkValidationResult {
  // Optional field: empty is valid
  if (!raw || raw.trim() === '') {
    return { isValid: true, sanitized: undefined };
  }

  const trimmed = raw.trim();

  // Must be valid URL
  if (!AFFILIATE_URL_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Affiliate link must be a valid URL (e.g., https://mytestingdomain.icu/ref/username).',
    };
  }

  try {
    const url = new URL(trimmed);

    // Whitelist domain
    const domain = url.hostname;
    if (!AFFILIATE_ALLOWED_DOMAINS.includes(domain)) {
      return {
        isValid: false,
        error: `Affiliate domain must be one of: ${AFFILIATE_ALLOWED_DOMAINS.join(', ')}.`,
      };
    }

    // Length check (prevent abuse/stored XSS)
    const urlString = url.toString();
    if (urlString.length > AFFILIATE_MAX_LENGTH) {
      return {
        isValid: false,
        error: `Affiliate link is too long (max ${AFFILIATE_MAX_LENGTH} characters).`,
      };
    }

    // Return sanitized URL
    return { isValid: true, sanitized: urlString };
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format.',
    };
  }
}

/**
 * Sanitize affiliate link to prevent XSS.
 * - Verifies it's still a valid URL
 * - Re-constructs to ensure clean URL
 *
 * @param url - Raw URL string
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeAffiliateLink(url: string): string {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return '';
  }
}

// ============================================================================
// ZODSCHEMA FOR SERVER-SIDE VALIDATION
// ============================================================================

export const SignupPayloadSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be under 100 characters.')
    .trim(),
  email: z.string().email('Invalid email format.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .refine((p) => /[A-Z]/.test(p), 'Password must contain at least one uppercase letter.')
    .refine((p) => /[a-z]/.test(p), 'Password must contain at least one lowercase letter.')
    .refine((p) => /[0-9]/.test(p), 'Password must contain at least one number.'),
  phoneNumber: z.string().min(7, 'Invalid phone number format.'),
  studentRegistrationNumber: z.string().trim().max(512, 'Registration number is too long.').optional().default(''),
  affiliateLink: z.string().optional().default(''),
  referralId: z.string().optional(),
});

export type SignupPayload = z.infer<typeof SignupPayloadSchema>;

/**
 * Server-side comprehensive validation of signup payload.
 * Validates format, business rules, and uniqueness constraints.
 *
 * @param payload - Raw signup request payload
 * @returns Validation result with normalized data or field-level errors
 */
export async function validateSignupPayload(payload: unknown): Promise<{
  valid: boolean;
  errors?: Record<string, string>;
  data?: SignupPayload & {
    phoneNumberNormalized: string;
    registrationNumberNormalized?: string;
    affiliateLinkSanitized?: string;
  };
}> {
  // Schema validation
  const schemaResult = SignupPayloadSchema.safeParse(payload);
  if (!schemaResult.success) {
    const errors: Record<string, string> = {};
    schemaResult.error.errors.forEach((err) => {
      const path = err.path.join('.');
      errors[path] = err.message;
    });
    return { valid: false, errors };
  }

  const data = schemaResult.data;

  // Custom validation: Phone number
  const phoneResult = validatePhoneNumber(data.phoneNumber);
  if (!phoneResult.isValid) {
    return {
      valid: false,
      errors: { phoneNumber: phoneResult.error || 'Invalid phone number' },
    };
  }

  // Custom validation: Registration number (optional; any text up to max when provided)
  const regRaw = (data.studentRegistrationNumber || '').trim();
  const regResult = regRaw ? validateStudentRegistrationNumber(regRaw) : { isValid: true as const, normalized: undefined };
  if (!regResult.isValid) {
    return {
      valid: false,
      errors: { studentRegistrationNumber: regResult.error || 'Invalid registration number' },
    };
  }

  // Custom validation: Affiliate link
  const affResult = validateAffiliateLink(data.affiliateLink);
  if (!affResult.isValid) {
    return {
      valid: false,
      errors: { affiliateLink: affResult.error || 'Invalid affiliate link' },
    };
  }

  return {
    valid: true,
    data: {
      ...data,
      phoneNumberNormalized: phoneResult.normalized!,
      registrationNumberNormalized: regResult.normalized,
      affiliateLinkSanitized: affResult.sanitized,
    },
  };
}

/**
 * Check if registration number already exists in database.
 * Used by server-side validation to prevent duplicates.
 *
 * @param registrationNumber - Normalized registration number to check
 * @param adminDb - Firestore admin instance
 * @returns True if number exists, false otherwise
 */
export async function checkRegistrationNumberExists(
  registrationNumber: string,
  db: Firestore | { collection: (path: string) => any }
): Promise<boolean> {
  try {
    const normalized = registrationNumber.trim();

    // Firebase Admin SDK path (server-side)
    if (typeof (db as { collection?: unknown }).collection === 'function') {
      const snapshot = await (db as { collection: (path: string) => any })
        .collection('users')
        .where('student_registration_number', '==', normalized)
        .limit(1)
        .get();

      return !snapshot.empty;
    }

    // Firebase Client SDK path (browser-side)
    const usersRef = collection(db as Firestore, 'users');
    const q = query(usersRef, where('student_registration_number', '==', normalized), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('[RegistrationCheck] Error checking for duplicate:', error);
    // Fail securely: don't allow signup if check fails
    throw new Error('Unable to verify registration number. Please try again.');
  }
}
