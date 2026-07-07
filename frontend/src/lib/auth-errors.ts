export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  
  const msg = typeof error === 'string' ? error : (error.message || '');
  const code = error.code || '';
  
  // Login errors
  if (code === 'auth/user-not-found' || msg.includes('user-not-found') || code === 'auth/invalid-credential' || msg.includes('invalid-credential') || code === 'auth/wrong-password' || msg.includes('wrong-password')) {
    return "The email or password you entered is incorrect. Please check and try again.";
  }
  
  if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
    return "You've tried to log in too many times. Your account is temporarily locked. Please try again later or reset your password.";
  }

  if (code === 'auth/user-disabled' || msg.includes('user-disabled')) {
    return "This account has been disabled. Please contact support for help.";
  }

  // Signup errors
  if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
    return "An account with this email address already exists. Please log in instead or use a different email.";
  }

  if (code === 'auth/weak-password' || msg.includes('weak-password')) {
    return "Your password is too weak. Please use at least 6 characters with a mix of letters and numbers.";
  }

  if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
    return "The email address you entered is not valid. Please check for typos.";
  }

  // General errors
  if (code === 'auth/network-request-failed' || msg.includes('network-request-failed')) {
    return "We couldn't connect to our servers. Please check your internet connection and try again.";
  }

  if (code === 'auth/account-exists-with-different-credential' || msg.includes('account-exists-with-different-credential')) {
    return "An account already exists with the same email address but was created using a different sign-in method. Please log in using that method.";
  }

  if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
    return "The login popup was closed before finishing. Please try again.";
  }

  if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
    return "Your browser blocked the login popup. Please allow popups for this site and try again.";
  }

  // Fallback for technical messages: if it still has "Firebase:" remove it
  if (msg.includes('Firebase:')) {
    return "We encountered a temporary issue connecting to your account. Please try again.";
  }

  return msg || 'An unexpected error occurred. Please try again.';
}
