import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAllowedAdminPath } from '@/lib/admin-mvp-config';
import {
  STUDENT_CANONICAL_REDIRECTS,
  STUDENT_MVP_BLOCKED_PREFIXES,
} from '@/lib/student-mvp-config';
import { checkDistributedRateLimit } from '@/lib/distributed-rate-limit';

/**
 * @fileOverview Production-grade middleware for rate limiting, CORS, security headers,
 * and server-side auth gate for protected routes.
 * SECURITY: Implements strict rate limiting on critical endpoints.
 * AUTH: Requires __session cookie for protected dashboard routes (set at login).
 */

// Rate limiter map: key -> { count, resetTime, createdAt }
// SECURITY: Uses LRU eviction to prevent memory exhaustion under sustained load
const rateLimitMap = new Map<string, { count: number; resetTime: number; createdAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per minute per IP
const RATE_LIMIT_MAX_MAP_SIZE = 10000; // Max entries before LRU eviction

// Stricter limits for specific endpoints
const STRICT_RATE_LIMITS: Record<string, number> = {
  '/api/webhooks/paystack': 100, // Webhook endpoint - increased to handle Paystack retries
  '/api/auth': 20, // Auth endpoints
  '/api/books': 30,
  '/api/books/read': 30,
  '/api/live-sessions': 30,
  '/api/onboarding': 30,
  '/api/media/stream': 60,
  '/api/media/file': 80,
  '/api/media/upload': 20,
  '/api/media/playback-token': 80,
  '/admin/marketing/announcements': 20,
  '/student-dashboard/ai-assistant': 40,
  '/login': 30, // Login page
  '/signup': 20, // Signup page
  '/admin/login': 15, // Admin login
};

const localOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
];

const configuredOrigins = [
  process.env.NEXT_PUBLIC_BASE_URL,
  ...(process.env.CORS_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) || []),
].filter(Boolean) as string[];

const ALLOWED_ORIGINS = [
  ...(process.env.NODE_ENV === 'production' ? [] : localOrigins),
  ...configuredOrigins,
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
  'Access-Control-Allow-Credentials': 'true',
};


interface RateLimitEntry {
  count: number;
  resetTime: number;
  createdAt: number;
}

/**
 * Gets the client IP address from request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const Real = request.headers.get('x-real-ip');
  return (forwarded?.split(',')[0] || Real || '127.0.0.1').trim();
}

/**
 * LRU eviction: Remove oldest entries when map exceeds max size.
 * Oldest is determined by createdAt timestamp.
 */
function evictOldestEntries(count: number): void {
  const entries = Array.from(rateLimitMap.entries());
  // Sort by createdAt ascending (oldest first)
  entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
  // Remove oldest entries
  for (let i = 0; i < Math.min(count, entries.length); i++) {
    rateLimitMap.delete(entries[i][0]);
  }
}

/**
 * Checks rate limit for IP and endpoint.
 * Includes LRU eviction to prevent memory exhaustion.
 */
function checkRateLimit(ip: string, endpoint: string): boolean {
  const now = Date.now();
  const key = `${ip}:${endpoint}`;
  const entry = rateLimitMap.get(key) as RateLimitEntry | undefined;

  // Get limits for this endpoint
  const maxRequests = STRICT_RATE_LIMITS[endpoint] || RATE_LIMIT_MAX_REQUESTS;

  // Incremental cleanup of expired entries
  const mapKeys = Array.from(rateLimitMap.keys());
  for (let i = 0; i < 5 && mapKeys.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * mapKeys.length);
    const randomKey = mapKeys[randomIndex];
    const val = rateLimitMap.get(randomKey);
    if (val && val.resetTime < now) {
      rateLimitMap.delete(randomKey);
    }
    mapKeys.splice(randomIndex, 1);
  }

  // LRU eviction: If map is too large, remove oldest entries
  if (rateLimitMap.size >= RATE_LIMIT_MAX_MAP_SIZE) {
    // Evict 10% of oldest entries when max size reached
    const evictCount = Math.floor(RATE_LIMIT_MAX_MAP_SIZE * 0.1);
    evictOldestEntries(evictCount);
  }

  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW, createdAt: now });
    return true;
  }

  if (entry.count < maxRequests) {
    entry.count++;
    return true;
  }

  // Rate limit exceeded
  return false;
}

function getRateLimitBucket(pathname: string): string {
  const matched = Object.keys(STRICT_RATE_LIMITS)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => pathname.startsWith(prefix));
  return matched || pathname;
}

/**
 * Handles CORS preflight requests
 */
function handleCorsPreFlight(request: NextRequest, origin: string): NextResponse {
  if (!isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      ...CORS_HEADERS,
    },
  });
}

/**
 * Checks if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // No origin header means same-origin
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Typed representation of the Firebase ID token payload fields used in middleware.
 * Only the fields we actually inspect are declared — unknown extras are silently ignored.
 */
interface FirebaseJwtPayload {
  uid?: string;
  user_id?: string;
  role?: string;
  emailVerified?: boolean;
  /** Nested claim added by Firebase Authentication SDK. */
  firebase?: {
    sign_in_provider?: string;
  };
}

/**
 * Decodes a Firebase ID token payload WITHOUT cryptographic verification.
 * This is used only for routing/UX decisions in Edge middleware.
 * Full server-side verification happens in each page/action before any privileged operation.
 */
function decodeJwtPayloadUnsafe(token: string): FirebaseJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      // JWT payload is base64url-encoded
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const decoded = atob(padded);
      return JSON.parse(decoded);
    }
    // Fallback: decode directly as a base64 encoded JSON (our mock session token)
    const decoded = atob(token);
    const payload = JSON.parse(decoded);
    return {
      uid: payload.uid,
      user_id: payload.uid,
      role: payload.role,
      emailVerified: payload.emailVerified ?? true,
    };
  } catch {
    return null;
  }
}

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'subadmin']);

// Routes that should be inaccessible to admin-family roles
const COMMERCE_BLOCKED_FOR_ADMINS = ['/student-dashboard/cart', '/checkout'];

/**
 * Middleware entry point
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const method = request.method;

  // Legacy books URLs now live under student dashboard.
  if (pathname === '/books' || pathname.startsWith('/books/')) {
    const target = pathname === '/books'
      ? '/student-dashboard/books'
      : `/student-dashboard${pathname}`;
    const redirectUrl = new URL(target, request.url);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl);
  }

  // Student MVP gate: canonical redirects for duplicate/legacy routes.
  const canonicalSource = Object.keys(STUDENT_CANONICAL_REDIRECTS).find(
    (source) => pathname === source
  );
  if (canonicalSource) {
    return NextResponse.redirect(new URL(STUDENT_CANONICAL_REDIRECTS[canonicalSource], request.url));
  }

  // Student MVP gate: keep core learning + AI routes, redirect non-MVP modules.
  if (STUDENT_MVP_BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL('/student-dashboard', request.url));
  }

  // Admin MVP gate: block non-MVP admin routes even when accessed directly by URL.
  // Dynamic routes (for example /admin/courses/:id/edit) are allowed via regex patterns.
  if (pathname.startsWith('/admin') && !isAllowedAdminPath(pathname)) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return handleCorsPreFlight(request, origin || '');
  }

  // Get client IP
  const clientIp = getClientIp(request);

  // Protected routes that require authentication (cookie-based gate)
  const protectedPrefixes = ['/student-dashboard', '/tutor-dashboard', '/admin', '/checkout', '/room', '/affiliate'];
  const loginPaths = ['/admin/login'];
  const isProtectedRoute = protectedPrefixes.some(prefix => pathname.startsWith(prefix));
  const isLoginPage = loginPaths.some(path => pathname === path);

  if (isProtectedRoute && !isLoginPage) {
    const sessionCookie = request.cookies.get('__session')?.value;
    if (!sessionCookie) {
      // No session cookie — redirect to appropriate login
      const loginUrl = pathname.startsWith('/admin')
        ? new URL('/admin/login', request.url)
        : new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const payload = decodeJwtPayloadUnsafe(sessionCookie);
    const role = typeof payload?.role === 'string' ? payload.role : undefined;

    // RBAC: block admin-family roles from commerce routes.
    // We decode the JWT payload (without cryptographic verification) solely for routing
    // guidance. Actual authorization is re-verified server-side on each page/action.
    const isCommerceRoute = COMMERCE_BLOCKED_FOR_ADMINS.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    );
    if (isCommerceRoute) {
      if (role && ADMIN_ROLES.has(role)) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    }

    // Email verification gate: block unverified student/tutor accounts from dashboards.
    //
    // Gate logic (hardened):
    //  - emailVerified === true   → allow (explicitly verified via OTP or admin override)
    //  - emailVerified !== true   → redirect to verify-email (includes false, undefined, or any other value)
    //
    // SECURITY: Previously allowed 'undefined' to pass for pre-existing accounts, but this created
    // a bypass where new accounts missing the claim could access protected routes. Now requires
    // explicit emailVerified=true claim to proceed.
    //
    // For admin-created accounts or SSO users that should skip verification, the admin must
    // explicitly set emailVerified=true via admin panel or the account creation flow.
    const EMAIL_VERIFICATION_ROUTES = ['/student-dashboard', '/tutor-dashboard', '/checkout', '/room', '/affiliate'];
    const needsVerificationCheck = EMAIL_VERIFICATION_ROUTES.some(
      (prefix) => pathname.startsWith(prefix)
    );
    if (needsVerificationCheck && !ADMIN_ROLES.has(role || '')) {
      // Hardened check: must be EXPLICITLY true to proceed
      if (payload?.emailVerified !== true) {
        const verifyUrl = new URL('/verify-email', request.url);
        if (payload?.user_id) {
          verifyUrl.searchParams.set('uid', String(payload.user_id));
        }
        return NextResponse.redirect(verifyUrl);
      }
    }
  }

  // Critical endpoints that need strict rate limiting
  const criticalEndpoints = [
    '/api/webhooks/paystack',
    '/api/auth',
    '/api/books',
    '/api/books/read',
    '/api/live-sessions',
    '/api/onboarding',
    '/api/media/stream',
    '/api/media/file',
    '/api/media/upload',
    '/api/media/playback-token',
    '/admin/marketing/announcements',
    '/student-dashboard/ai-assistant',
    '/login',
    '/signup',
    '/admin/login',
  ];

  const isCriticalEndpoint = criticalEndpoints.some(ep => pathname.startsWith(ep));

  // Check rate limit
  if (isCriticalEndpoint) {
    const bucket = getRateLimitBucket(pathname);
    const maxRequests = STRICT_RATE_LIMITS[bucket] || RATE_LIMIT_MAX_REQUESTS;
    
    // Try distributed rate limit first (Upstash/Redis), fall back to local
    const distributed = await checkDistributedRateLimit(clientIp, bucket, maxRequests);
    const allowed = distributed?.allowed ?? checkRateLimit(clientIp, bucket);
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: 60,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }
  }

  // Add CORS headers to response
  const response = NextResponse.next();

  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(self), camera=(self)'
  );

  // Prevent caching of auth pages and admin panel
  if (pathname.startsWith('/admin') || pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseio.com https://*.googleapis.com https://unpkg.com https://vercel.live https://source.zoom.us",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.googleapis.com https://*.googleusercontent.com https://cdn.mytestingdomain.icu https://*.r2.cloudflarestorage.com https://*.r2.dev https://placehold.co https://images.unsplash.com https://picsum.photos https://i.pravatar.cc https://*.replit.dev https://*.repl.co https://*.replit.app",
      "font-src 'self' https://fonts.gstatic.com https://unpkg.com https://vercel.live",
      "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 https://*.supabase.co https://*.firebaseio.com https://*.googleapis.com https://*.firebase.google.com wss://*.firebaseio.com https://cdn.mytestingdomain.icu https://*.r2.cloudflarestorage.com https://*.r2.dev https://unpkg.com https://source.zoom.us wss://*.zoom.us wss://*.zoomgov.com https://*.zoom.us https://*.zoomgov.com https://*.replit.dev https://*.repl.co https://*.replit.app https://*.onrender.com https://vercel.live https://*.vercel.app",
      "media-src 'self' blob: https://*.r2.cloudflarestorage.com https://*.r2.dev",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://vercel.live https://*.replit.dev https://*.repl.co https://*.replit.app",
      "worker-src 'self' blob: https://source.zoom.us",
      "object-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  return response;
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|sw.js.map|workbox-|swe-worker|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
