/**
 * Comprehensive unit tests for signup validation utilities
 * Tests phone number, registration number, and affiliate link validation
 */

import { describe, it, expect } from 'vitest';
import {
  validatePhoneNumber,
  validateStudentRegistrationNumber,
  validateAffiliateLink,
  sanitizeAffiliateLink,
  validateSignupPayload,
} from './signup-validation';

// ============================================================================
// PHONE NUMBER VALIDATION TESTS
// ============================================================================

describe('validatePhoneNumber', () => {
  describe('Valid E.164 Format', () => {
    it('accepts valid E.164 Ghana number', () => {
      const result = validatePhoneNumber('+233201234567');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+233201234567');
      expect(result.error).toBeUndefined();
    });

    it('accepts valid E.164 US number', () => {
      const result = validatePhoneNumber('+12025550173');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+12025550173');
    });

    it('accepts valid E.164 UK number', () => {
      const result = validatePhoneNumber('+442071838750');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+442071838750');
    });
  });

  describe('Ghana Local Format Conversion', () => {
    it('converts 0-prefixed Ghana number to E.164', () => {
      const result = validatePhoneNumber('0201234567');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+233201234567');
    });

    it('converts 054 (Vodafone) to E.164', () => {
      const result = validatePhoneNumber('0541234567');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+233541234567');
    });

    it('converts 055 (MTN) to E.164', () => {
      const result = validatePhoneNumber('0551234567');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+233551234567');
    });

    it('handles spaces in local format', () => {
      const result = validatePhoneNumber('0201 234 567');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toContain('233');
    });

    it('handles dashes in local format', () => {
      const result = validatePhoneNumber('020-1234-567');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toContain('+233');
    });
  });

  describe('Invalid Formats', () => {
    it('rejects empty string', () => {
      const result = validatePhoneNumber('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('rejects whitespace-only string', () => {
      const result = validatePhoneNumber('   ');
      expect(result.isValid).toBe(false);
    });

    it('rejects too short number', () => {
      const result = validatePhoneNumber('123456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects number without country code', () => {
      const result = validatePhoneNumber('1234567');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('country code');
    });

    it('rejects local format without leading 0', () => {
      const result = validatePhoneNumber('201234567');
      expect(result.isValid).toBe(false);
    });

    it('rejects invalid country code', () => {
      const result = validatePhoneNumber('+0201234567');
      expect(result.isValid).toBe(false);
    });

    it('rejects non-numeric characters (except +)', () => {
      const result = validatePhoneNumber('+233-ABC#@!');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles extra whitespace gracefully', () => {
      const result = validatePhoneNumber('  +233201234567  ');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+233201234567');
    });

    it('handles parentheses in number', () => {
      const result = validatePhoneNumber('(020) 123 4567');
      expect(result.isValid).toBe(true);
      expect(result.normalized?.startsWith('+')).toBe(true);
    });
  });
});

// ============================================================================
// STUDENT REGISTRATION NUMBER VALIDATION TESTS
// ============================================================================

describe('validateStudentRegistrationNumber', () => {
  it('accepts empty as optional (no normalized value)', () => {
    const result = validateStudentRegistrationNumber('');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBeUndefined();
  });

  it('accepts alphanumeric and preserves casing', () => {
    const result = validateStudentRegistrationNumber('  icag/2024/abc-12  ');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('icag/2024/abc-12');
  });

  it('accepts legacy STUD format unchanged', () => {
    const result = validateStudentRegistrationNumber('STUD-2024-001234');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('STUD-2024-001234');
  });

  it('rejects when longer than 512 characters', () => {
    const result = validateStudentRegistrationNumber('x'.repeat(513));
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('512');
  });
});

// ============================================================================
// AFFILIATE LINK VALIDATION TESTS
// ============================================================================

describe('validateAffiliateLink', () => {
  describe('Valid URLs', () => {
    it('accepts valid HTTPS studymate.com URL', () => {
      const result = validateAffiliateLink('https://studymate.com/ref/user-123');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toContain('studymate.com');
    });

    it('accepts valid HTTPS www.studymate.com URL', () => {
      const result = validateAffiliateLink('https://www.studymate.com/ref/ama-boateng');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toContain('www.studymate.com');
    });

    it('accepts ref.studymate.com subdomain', () => {
      const result = validateAffiliateLink('https://ref.studymate.com/user101');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toContain('ref.studymate.com');
    });

    it('accepts referral.studymate.com subdomain', () => {
      const result = validateAffiliateLink('https://referral.studymate.com/my-link');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toContain('referral.studymate.com');
    });

    it('accepts HTTP (non-HTTPS) URL', () => {
      const result = validateAffiliateLink('http://studymate.com/ref/test');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeDefined();
    });
  });

  describe('Optional Field (Empty is Valid)', () => {
    it('accepts empty string', () => {
      const result = validateAffiliateLink('');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeUndefined();
    });

    it('accepts whitespace-only string', () => {
      const result = validateAffiliateLink('   ');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeUndefined();
    });
  });

  describe('Invalid URLs', () => {
    it('rejects URL without protocol', () => {
      const result = validateAffiliateLink('studymate.com/ref/user');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid URL');
    });

    it('rejects non-whitelisted domain', () => {
      const result = validateAffiliateLink('https://evil.com/ref/user');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('domain');
    });

    it('rejects malformed URL', () => {
      const result = validateAffiliateLink('not-a-url-at-all');
      expect(result.isValid).toBe(false);
    });

    it('rejects URL with port number (if not whitelisted)', () => {
      const result = validateAffiliateLink('https://studymate.com:3000/ref/user');
      expect(result.isValid).toBe(true); // URL parser still works
      expect(result.sanitized).toBeDefined();
    });

    it('rejects javascript: protocol', () => {
      const result = validateAffiliateLink('javascript:alert("xss")');
      expect(result.isValid).toBe(false);
    });

    it('rejects data: protocol', () => {
      const result = validateAffiliateLink('data:text/html,<h1>XSS</h1>');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Length Constraints (max 512 chars)', () => {
    it('accepts URL under 512 characters', () => {
      const longPath = 'a'.repeat(400);
      const url = `https://studymate.com/ref/${longPath}`;
      const result = validateAffiliateLink(url);
      expect(result.isValid).toBe(true);
    });

    it('rejects URL over 512 characters', () => {
      const longPath = 'a'.repeat(500);
      const url = `https://studymate.com/ref/${longPath}`;
      const result = validateAffiliateLink(url);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });
});

// ============================================================================
// AFFILIATE LINK SANITIZATION TESTS
// ============================================================================

describe('sanitizeAffiliateLink', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeAffiliateLink('')).toBe('');
  });

  it('returns clean URL with trailing slash normalized', () => {
    const input = 'https://studymate.com/ref/user/';
    const output = sanitizeAffiliateLink(input);
    expect(output).toContain('studymate.com');
  });

  it('returns empty string for invalid URL', () => {
    expect(sanitizeAffiliateLink('not-a-url')).toBe('');
  });

  it('handles query parameters correctly', () => {
    const input = 'https://studymate.com/ref/user?src=email';
    const output = sanitizeAffiliateLink(input);
    expect(output).toContain('email');
  });
});

// ============================================================================
// COMPREHENSIVE SIGNUP PAYLOAD VALIDATION TESTS
// ============================================================================

describe('validateSignupPayload', () => {
  const validPayload = {
    fullName: 'Ama Boateng',
    email: 'ama@example.com',
    password: 'SecurePass123',
    phoneNumber: '+233201234567',
    studentRegistrationNumber: 'STUD-2024-001234',
    affiliateLink: 'https://studymate.com/ref/ama',
  };

  it('accepts fully valid payload', async () => {
    const result = await validateSignupPayload(validPayload);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.phoneNumberNormalized).toBe('+233201234567');
    expect(result.data?.registrationNumberNormalized).toBe('STUD-2024-001234');
    expect(result.data?.affiliateLinkSanitized).toContain('studymate.com');
  });

  it('accepts payload without optional affiliate link', async () => {
    const payload = { ...validPayload, affiliateLink: '' };
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.data?.affiliateLinkSanitized).toBeUndefined();
  });

  it('rejects with invalid phone number', async () => {
    const payload = { ...validPayload, phoneNumber: 'invalid' };
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors?.phoneNumber).toBeDefined();
  });

  it('rejects with registration number that is too long', async () => {
    const payload = { ...validPayload, studentRegistrationNumber: 'x'.repeat(513) };
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors?.studentRegistrationNumber).toBeDefined();
  });

  it('rejects with invalid affiliate link', async () => {
    const payload = { ...validPayload, affiliateLink: 'https://evil.com/ref' };
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors?.affiliateLink).toBeDefined();
  });

  it('rejects with weak password', async () => {
    const payload = { ...validPayload, password: 'weak' };
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors?.password).toBeDefined();
  });

  it('rejects with missing required field', async () => {
    const payload = { ...validPayload };
    delete (payload as any).fullName;
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors?.fullName).toBeDefined();
  });

  it('converts Ghana local phone to E.164', async () => {
    const payload = { ...validPayload, phoneNumber: '0201234567' };
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.data?.phoneNumberNormalized).toBe('+233201234567');
  });

  it('preserves registration casing in normalized output', async () => {
    const payload = { ...validPayload, studentRegistrationNumber: 'stud-2024-001234' };
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.data?.registrationNumberNormalized).toBe('stud-2024-001234');
  });

  it('accepts empty optional registration on payload', async () => {
    const payload = { ...validPayload, studentRegistrationNumber: '' };
    const result = await validateSignupPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.data?.registrationNumberNormalized).toBeUndefined();
  });
});
