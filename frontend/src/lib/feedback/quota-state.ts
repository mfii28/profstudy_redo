'use client';

const QUOTA_TTL_MS = 60_000;

type QuotaListener = () => void;

let lastQuotaAt = 0;
let lastMessage = '';
const listeners = new Set<QuotaListener>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function reportQuotaError(error: unknown, message?: string): void {
  const text =
    message ||
    (typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : 'Service is temporarily busy.');

  const lowered = text.toLowerCase();
  const isQuota =
    lowered.includes('quota') ||
    lowered.includes('resource exhausted') ||
    lowered.includes('too many requests') ||
    lowered.includes('rate limit') ||
    lowered.includes('service busy');

  if (!isQuota) return;

  lastQuotaAt = Date.now();
  lastMessage = text;
  notifyListeners();
}

export function subscribeQuotaState(listener: QuotaListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQuotaBannerState(): { visible: boolean; message: string } {
  const visible = Date.now() - lastQuotaAt < QUOTA_TTL_MS;
  return {
    visible,
    message: lastMessage || 'The service is temporarily busy. Please try again in a minute.',
  };
}

export function dismissQuotaBanner(): void {
  lastQuotaAt = 0;
  lastMessage = '';
  notifyListeners();
}
