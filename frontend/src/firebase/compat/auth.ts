export function getAuth() { return {}; }
export async function signInWithEmailAndPassword() { throw new Error('Auth migrated to NextAuth'); }
export async function signOut() {}
export async function updateProfile() {}
export async function updatePassword() {}
export async function reauthenticateWithCredential() {}
export class EmailAuthProvider {
  static credential() { return {}; }
}
export type Auth = any;
export type User = any;
