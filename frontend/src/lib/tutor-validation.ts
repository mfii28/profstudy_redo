/**
 * @fileOverview Input validation helpers for tutor operations.
 * Ensures data integrity before Firestore writes.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate payout request
 */
export function validatePayoutRequest(amount: number, availableBalance: number): ValidationResult {
  const errors: string[] = [];

  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Amount must be a valid number');
  }

  if (amount < 50) {
    errors.push('Minimum withdrawal is GH₵50.00');
  }

  if (amount > availableBalance) {
    errors.push('Amount exceeds available balance');
  }

  // Max reasonable payout check (prevent accidental large amounts)
  if (amount > 100000) {
    errors.push('Amount exceeds maximum limit of GH₵100,000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate course data
 */
export function validateCourse(data: {
  title?: string;
  subtitle?: string;
  description?: string;
  price?: number;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Course title is required');
  }

  if (data.title && data.title.length > 200) {
    errors.push('Course title must be 200 characters or less');
  }

  if (data.description && data.description.length > 5000) {
    errors.push('Course description must be 5000 characters or less');
  }

  if (data.price !== undefined && (typeof data.price !== 'number' || data.price < 0)) {
    errors.push('Price must be a non-negative number');
  }

  if (data.price && data.price > 10000) {
    errors.push('Price cannot exceed GH₵10,000');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate message content
 */
export function validateMessage(content: string): ValidationResult {
  const errors: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push('Message cannot be empty');
  }

  if (content.length > 10000) {
    errors.push('Message must be 10,000 characters or less');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format and validate amount for display
 */
export function formatAndValidateCurrency(amount: number): { valid: boolean; formatted: string } {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, formatted: '₵0.00' };
  }

  if (amount < 0) {
    return { valid: false, formatted: '₵0.00' };
  }

  const formatted = new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount);

  return { valid: true, formatted };
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  // Remove script tags and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .trim();
}

/**
 * Validate array of recipient IDs (for bulk messaging)
 */
export function validateRecipients(recipientIds: unknown[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(recipientIds)) {
    errors.push('Recipients must be an array');
  }

  if (recipientIds.length === 0) {
    errors.push('At least one recipient is required');
  }

  if (recipientIds.length > 10000) {
    errors.push('Cannot send to more than 10,000 recipients at once');
  }

  const invalidIds = recipientIds.filter(id => typeof id !== 'string' || id.length === 0);
  if (invalidIds.length > 0) {
    errors.push(`${invalidIds.length} invalid recipient ID(s)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
