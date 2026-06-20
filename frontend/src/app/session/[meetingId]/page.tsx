'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Loader2, ExternalLink, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLiveSessionJoinUrlApi } from '@/lib/live-session-api';

/**
 * @fileOverview Secure Live Session Gateway.
 *
 * This page acts as an authenticated redirect guard:
 *  1. Requires the user to be logged in.
 *  2. Calls the `getZoomJoinUrl` server action which verifies enrollment.
 *  3. Only then opens the external Zoom link in a new tab.
 *
 * The raw Zoom URL is NEVER in the page HTML or the Firestore client data.
 * Sharing this page URL is safe — unauthenticated or non-enrolled users
 * are rejected by the server action before any URL is exposed.
 */

interface GatewayProps {
  sessionId: string;
}

function SessionGateway({ sessionId }: GatewayProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useUser();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [zoomUrl, setZoomUrl] = useState('');

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      router.replace(`/login?redirect=/session/${encodeURIComponent(sessionId)}`);
      return;
    }

    const resolve = async () => {
      try {
        const idToken = await user.getIdToken();
        const result = await getLiveSessionJoinUrlApi(idToken, sessionId);

        setSessionTitle(result.title);
        setZoomUrl(result.url);
        setStatus('ready');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
        setStatus('error');
      }
    };

    void resolve();
  }, [user, isAuthLoading, sessionId, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying access…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-destructive/30 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <ShieldX className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="text-xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">{errorMessage}</p>
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready — show the join card
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ExternalLink className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">{sessionTitle || 'Live Session'}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            Your access has been verified. Click the button below to join the Zoom meeting.
          </p>
          <p className="text-xs text-muted-foreground/60">
            The link will open in a new tab. Do not share this page — access is tied to your account.
          </p>
          <Button
            size="lg"
            className="w-full gap-2 font-bold"
            onClick={() => {
              window.open(zoomUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            <ExternalLink className="h-4 w-4" />
            Join Zoom Meeting
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => router.back()}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface MeetingPageProps {
  params: Promise<{ meetingId: string }>;
}

export default function MeetingPage({ params }: MeetingPageProps) {
  const resolvedParams = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <SessionGateway sessionId={resolvedParams.meetingId} />
    </Suspense>
  );
}
