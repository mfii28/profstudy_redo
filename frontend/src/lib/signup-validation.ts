export const validatePhoneNumber = (phone: string) => {
  let normalized = phone.trim();
  
  if (normalized.startsWith('0')) {
    normalized = '+233' + normalized.substring(1);
  }

  // Strip non-digits except +
  const stripped = normalized.replace(/[^\d+]/g, '');
  if (stripped.length < 9) {
    return { isValid: false, error: 'Phone number is too short' };
  }

  return { isValid: true, normalized };
};

export const validateAffiliateLink = (link: string) => {
  if (!link) return { isValid: true, sanitized: '' };
  try {
    new URL(link);
    return { isValid: true, sanitized: link.trim() };
  } catch {
    return { isValid: false, error: 'Invalid URL' };
  }
};

export const validateStudentRegistrationNumber = (reg: string) => {
  const trimmed = reg.trim();
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Registration number too short' };
  }
  return { isValid: true, normalized: trimmed };
};
