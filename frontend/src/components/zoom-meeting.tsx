'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { generateZoomSignature } from '@/app/actions/zoom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';

interface ZoomMeetingProps {
  meetingId: string;
  userName: string;
  role: 0 | 1; // 0 for attendee, 1 for host
}

export function ZoomMeeting({ meetingId, userName, role }: ZoomMeetingProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Initializing SDK...');
  const [error, setError] = useState<string | null>(null);
  const [zoomClient, setZoomClient] = useState<any>(null);
  const [mediaStream, setMediaStream] = useState<any>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const initCalledRef = useRef(false);

  const [isMuted, setIsMuted] = useState(true); // start muted
  const [isVideoOff, setIsVideoOff] = useState(true); // start with camera off

  // ── Attendance (stub - migrated to REST API) ──
  const recordAttendance = useCallback(async () => {
    // Attendance now recorded via the backend API
  }, [user, role, meetingId]);

  // ── SDK Initialization (runs once) ──
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    let client: any;
    let isMounted = true;
    const TIMEOUT_MS = 45000; // Increased timeout for slow connections

    const timeoutId = setTimeout(() => {
      if (isMounted && isLoading) {
        setError('Connection timed out. Please check:\n1. Your internet connection\n2. Firewall settings\n3. Domain configuration in Zoom app settings');
        setIsLoading(false);
      }
    }, TIMEOUT_MS);

    const initZoom = async () => {
      const safeMeetingId = String(meetingId || '');
      const safeUserName = String(userName || 'Learner').substring(0, 15);

      try {
        setLoadingStep('Authorizing Secure Connection...');

        const { default: ZoomVideo } = await import('@zoom/videosdk');
        if (!isMounted) return;

        client = ZoomVideo.createClient();

        const signatureResult = await generateZoomSignature(
          user ? await user.getIdToken() : '',
          safeMeetingId,
          role,
        );

        if (!isMounted) return;
        if ('error' in signatureResult || !('signature' in signatureResult)) {
          throw new Error(typeof signatureResult.error === 'string' ? signatureResult.error : 'Auth failed');
        }

        setLoadingStep('Loading Video Engine...');
        // Use `Global` rendering mode — works cross-browser including Firefox/Safari
        await client.init('en-US', 'Global', { 
          patchJsMedia: true,
          stayAwake: true,
          enforceMultipleVideos: true 
        });

        if (!isMounted) return;
        setLoadingStep('Joining Session...');
        
        // Add retry logic for join
        let joinAttempts = 0;
        const maxJoinAttempts = 3;
        
        while (joinAttempts < maxJoinAttempts && isMounted) {
          try {
            await client.join(safeMeetingId, signatureResult.signature, safeUserName, '');
            break; // Success
          } catch (joinError: any) {
            joinAttempts++;
            console.warn(`[Zoom] Join attempt ${joinAttempts} failed:`, joinError.message);
            if (joinAttempts >= maxJoinAttempts) {
              throw new Error(`Join failed after ${maxJoinAttempts} attempts: ${joinError.message}`);
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        if (!isMounted) return;

        const stream = client.getMediaStream();
        setZoomClient(client);
        setMediaStream(stream);

        // Start audio (unmuted by default on join so mute it)
        try {
          await stream.startAudio();
          await stream.muteAudio();
        } catch {
          console.warn('[Zoom] Audio start deferred — user gesture may be required');
        }

        clearTimeout(timeoutId);
        setIsLoading(false);
        recordAttendance();

        // Track participant count
        const updateCount = () => {
          try {
            const participants = client.getAllUser();
            if (isMounted) setParticipantCount(participants?.length ?? 1);
          } catch { /* ignore */ }
        };
        updateCount();
        client.on('user-added', updateCount);
        client.on('user-removed', updateCount);
        client.on('user-updated', updateCount);

        toast({ title: 'Connected', description: 'You are now in the live session.' });

      } catch (e: any) {
        console.error('[Zoom] Critical Error:', e);
        if (isMounted) {
          clearTimeout(timeoutId);
          let message = 'Connection failed. Please try again.';
          
          // Specific error handling
          if (e?.type === 'INVALID_PARAMETERS') {
            message = `SDK Error: ${e.reason || 'Invalid parameters'}. Check your Zoom SDK credentials.`;
          } else if (e?.message?.includes('CORS')) {
            message = 'CORS Error: Domain not allowed. Contact support.';
          } else if (e?.message?.includes('network') || e?.message?.includes('timeout')) {
            message = 'Network Error: Check your internet connection and firewall settings.';
          } else if (e?.message?.includes('signature') || e?.message?.includes('token')) {
            message = 'Authentication Error: Invalid meeting credentials.';
          } else if (e?.code === 1) {
            message = 'Invalid parameters. Check meeting ID and credentials.';
          } else if (e?.code === 3008) {
            message = 'Meeting not found or already ended.';
          } else if (e?.code === 200) {
            message = 'Network connection failed. Please check your internet.';
          }
          
          setError(message);
          setIsLoading(false);
        }
      }
    };

    initZoom();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (client) {
        try { client.leave(); } catch { /* already left */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — initCalledRef guards double-invocation in StrictMode

  // ── Audio toggle ──
  const toggleAudio = useCallback(async () => {
    if (!mediaStream) return;
    try {
      if (isMuted) {
        await mediaStream.unmuteAudio();
      } else {
        await mediaStream.muteAudio();
      }
      setIsMuted(!isMuted);
    } catch (e) {
      console.error('[Zoom] Audio toggle failed:', e);
      toast({ variant: 'destructive', title: 'Audio Error', description: 'Could not toggle microphone.' });
    }
  }, [mediaStream, isMuted, toast]);

  // ── Video toggle ──
  const toggleVideo = useCallback(async () => {
    if (!mediaStream || !selfVideoRef.current) return;
    try {
      if (isVideoOff) {
        await mediaStream.startVideo({ videoElement: selfVideoRef.current });
      } else {
        await mediaStream.stopVideo();
      }
      setIsVideoOff(!isVideoOff);
    } catch (e) {
      console.error('[Zoom] Video toggle failed:', e);
      toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not toggle camera. Check browser permissions.' });
    }
  }, [mediaStream, isVideoOff, toast]);

  // ── Leave ──
  const handleLeaveSession = useCallback(async () => {
    try {
      if (zoomClient) await zoomClient.leave();
    } catch { /* already left */ }
    router.back();
  }, [zoomClient, router]);

  // ── Error state ──
  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="p-4 bg-destructive/10 rounded-full mb-6">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold font-headline">Live Session Error</h2>
        <p className="mt-2 max-w-md text-muted-foreground">{error}</p>
        <div className="mt-8 flex gap-4">
          <Button onClick={() => window.location.reload()} variant="outline">Retry Connection</Button>
          <Button onClick={() => router.back()}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col bg-black text-white items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg font-medium animate-pulse">{loadingStep}</p>
        <p className="mt-2 text-xs text-gray-500 uppercase tracking-widest">Encrypting stream...</p>
      </div>
    );
  }

  // ── Active session ──
  return (
    <div className="flex h-screen w-full flex-col bg-black text-white">
      {/* Video area */}
      <div className="flex-1 relative p-4">
        <div className="absolute top-4 left-4 z-10 rounded-md bg-black/50 px-3 py-1 text-xs font-mono flex items-center gap-3">
          <span>ID: {meetingId}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {participantCount}</span>
        </div>

        <div ref={videoContainerRef} className="h-full w-full flex items-center justify-center">
          {/* Self-video element (hidden when camera off, shown when on) */}
          <video
            ref={selfVideoRef}
            className={`h-full w-full rounded-2xl object-cover ${isVideoOff ? 'hidden' : ''}`}
            autoPlay
            playsInline
            muted
          />
          {isVideoOff && (
            <div className="w-full h-full bg-slate-900/50 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-gray-500 gap-4">
              <div className="p-8 bg-white/5 rounded-full">
                <Video className="w-16 h-16 opacity-20" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest opacity-30">
                Camera Off — Click &quot;Video&quot; to start
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Control bar */}
      <footer className="z-10 bg-slate-900/90 backdrop-blur-xl border-t border-white/5">
        <div className="container mx-auto flex h-20 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="lg"
              className="h-14 w-14 flex-col gap-1 rounded-lg text-white hover:bg-white/10"
              onClick={toggleAudio}
            >
              {isMuted ? <MicOff className="text-destructive" /> : <Mic />}
              <span className="text-[10px] font-bold uppercase">{isMuted ? 'Unmute' : 'Mute'}</span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-14 w-14 flex-col gap-1 rounded-lg text-white hover:bg-white/10"
              onClick={toggleVideo}
            >
              {isVideoOff ? <VideoOff className="text-destructive" /> : <Video />}
              <span className="text-[10px] font-bold uppercase">Video</span>
            </Button>
          </div>

          <Button
            variant="destructive"
            size="lg"
            className="h-12 px-6 font-bold shadow-xl"
            onClick={handleLeaveSession}
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            Leave
          </Button>
        </div>
      </footer>
    </div>
  );
}
