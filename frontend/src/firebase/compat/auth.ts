export function getAuth(...args: any[]): any { return {}; }
export async function signInWithEmailAndPassword(...args: any[]) { throw new Error('Auth migrated to NextAuth'); }
export async function createUserWithEmailAndPassword(...args: any[]) { throw new Error('Auth migrated to NextAuth'); }
export async function signInAnonymously(...args: any[]) { return {}; }
export async function signOut(...args: any[]) {}
export async function updateProfile(...args: any[]) {}
export async function updatePassword(...args: any[]) {}
export async function reauthenticateWithCredential(...args: any[]) {}
export class EmailAuthProvider {
  static credential(...args: any[]) { return {}; }
}
export type Auth = any;
export type User = any;
