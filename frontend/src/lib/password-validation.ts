/**
 * Shared password validation for signup and password change forms.
 * Enforces strong password policy for a payment-enabled platform.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number.' };
  }
  return { isValid: true };
}

export function validateFullName(name: string): PasswordValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Full name is required.' };
  }
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters.' };
  }
  if (trimmed.length > 100) {
    return { isValid: false, error: 'Name must be under 100 characters.' };
  }
  return { isValid: true };
}
