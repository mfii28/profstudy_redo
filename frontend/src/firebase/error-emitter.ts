/**
 * @deprecated Firebase error emitter. No longer used.
 * Stub kept for backward compatibility with remaining data libs.
 */

export const errorEmitter = {
  emit: (event: string, ...args: any[]) => {
    // No-op
  },
  on: (event: string, handler: Function) => {
    // No-op
    return () => {};
  },
  off: (event: string, handler: Function) => {
    // No-op
  },
};
