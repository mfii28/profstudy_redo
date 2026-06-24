/**
 * @deprecated Firebase errors module. No longer used.
 * Stub kept for backward compatibility with remaining data libs.
 */

export class FirestorePermissionError extends Error {
  constructor(context?: any) {
    super('Firestore is no longer available. Use REST API instead.');
    this.name = 'FirestorePermissionError';
  }
}

export type SecurityRuleContext = Record<string, any>;
