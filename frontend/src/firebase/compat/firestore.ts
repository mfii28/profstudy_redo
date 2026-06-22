export function getFirestore() { return {}; }
export function initializeFirestore() { return {}; }
export function doc() { return {}; }
export function collection() { return {}; }
export function query() { return {}; }
export function where() { return {}; }
export function limit() { return {}; }
export function orderBy() { return {}; }
export async function getDocs() { return { empty: true, docs: [] }; }
export async function getDoc() { return { exists: () => false, data: () => null }; }
export async function setDoc() {}
export async function updateDoc() {}
export async function addDoc() { return { id: 'stub' }; }
export async function deleteDoc() {}
export function onSnapshot(ref: any, callback: (snap: any) => void) {
  return () => {};
}
export function writeBatch() {
  return {
    set: () => {},
    update: () => {},
    delete: () => {},
    commit: async () => {},
  };
}
export function serverTimestamp() { return new Date().toISOString(); }
export function increment(val: number) { return val; }
export function arrayUnion(...args: any[]) { return args; }
export function arrayRemove(...args: any[]) { return args; }
export async function runTransaction(db: any, updateFn: any) { return updateFn({
  get: async () => ({ exists: () => false, data: () => null }),
  set: () => {},
  update: () => {},
  delete: () => {},
}); }
export function documentId() { return 'id'; }
export function startAfter(...args: any[]) { return {}; }

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
export type QueryDocumentSnapshot = any;
export type FieldValue = any;
