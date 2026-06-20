'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Referral landing page: /ref/[code]
 *
 * Stores the affiliate code in localStorage so the signup page can read it
 * and attribute the new account to the referring affiliate.
 *
 * After saving the code, immediately redirects to /signup so the flow is
 * invisible to the user (they just see the signup page).
 */
export default function ReferralLandingPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const rawCode = params?.code;
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';

    // Only store alphanumeric codes to prevent any injection via URL
    if (code && /^[a-zA-Z0-9_-]{1,128}$/.test(code)) {
      try {
        localStorage.setItem('studymate_ref', code);
        localStorage.setItem('studymate_ref_link', `${window.location.origin}/ref/${encodeURIComponent(code)}`);
      } catch {
        // Storage may be blocked in private browsing — silently continue
      }

      // Fire-and-forget click tracking (non-blocking)
      fetch('/api/affiliate/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      }).catch(() => {/* silently ignore tracking failures */});
    }

    router.replace('/signup');
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
