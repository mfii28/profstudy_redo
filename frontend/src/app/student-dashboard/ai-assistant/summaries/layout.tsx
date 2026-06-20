import type { ReactNode } from 'react';

/** Avoid static prerender of this subtree (Genkit + client manifest edge case on Windows CI). */
export const dynamic = 'force-dynamic';

export default function AiAssistantSummariesLayout({ children }: { children: ReactNode }) {
  return children;
}
