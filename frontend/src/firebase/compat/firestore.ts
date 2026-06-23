export function getFirestore(...args: any[]): any { return {}; }
export function initializeFirestore(...args: any[]): any { return {}; }
export function doc(...args: any[]): any { return {}; }
export function collection(...args: any[]): any { return {}; }
export function query(...args: any[]): any { return {}; }
export function where(...args: any[]): any { return {}; }
export function limit(...args: any[]): any { return {}; }
export function orderBy(...args: any[]): any { return {}; }
export async function getDocs(...args: any[]): Promise<any> { return { empty: true, docs: [] as any[] }; }
export async function getDoc(...args: any[]): Promise<any> { return { exists: () => false, data: () => null }; }
export async function setDoc(...args: any[]): Promise<any> {}
export async function updateDoc(...args: any[]): Promise<any> {}
export async function addDoc(...args: any[]): Promise<any> { return { id: 'stub' }; }
export async function deleteDoc(...args: any[]): Promise<any> {}
export function onSnapshot(ref: any, ...args: any[]): any {
  return () => {};
}
export function writeBatch(...args: any[]): any {
  return {
    set: (...args: any[]) => {},
    update: (...args: any[]) => {},
    delete: (...args: any[]) => {},
    commit: async (...args: any[]) => {},
  };
}
export function serverTimestamp(...args: any[]): any { return new Date().toISOString(); }
export function increment(val: number): any { return val; }
export function arrayUnion(...args: any[]): any { return args; }
export function arrayRemove(...args: any[]): any { return args; }
export async function runTransaction(db: any, updateFn: any): Promise<any> { return updateFn({
  get: async (...args: any[]) => ({ exists: () => false, data: () => null }),
  set: (...args: any[]) => {},
  update: (...args: any[]) => {},
  delete: (...args: any[]) => {},
}); }
export function documentId(...args: any[]): any { return 'id'; }
export function startAfter(...args: any[]): any { return {}; }

export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() {
    return new Timestamp(Math.floor(Date.now() / 1000), 0);
  }
  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }
  static fromMillis(milliseconds: number) {
    return new Timestamp(Math.floor(milliseconds / 1000), 0);
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
  toMillis() {
    return this.seconds * 1000;
  }
  valueOf() {
    return this.toMillis().toString();
  }
  isEqual(other: Timestamp) {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }
}

export type Firestore = any;
export type DocumentData = any;
export type QueryDocumentSnapshot<T = any> = any;
export type FieldValue = any;
export type Query<T = any> = any;
export type FirestoreError = any;
export type QuerySnapshot<T = any> = any;
export type CollectionReference<T = any> = any;
export type DocumentReference<T = any> = any;
export type DocumentSnapshot<T = any> = any;
export type SetOptions = any;
