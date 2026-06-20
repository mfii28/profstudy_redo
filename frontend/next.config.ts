import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    disableDevLogs: true,
    navigateFallback: '/offline',
    navigateFallbackDenylist: [/^\/api\//, /^\/_next\/data\//],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 8, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: ({ request }: { request: Request }) => request.destination === 'image',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: ({ url }: { url: URL }) =>
          url.pathname.startsWith('/api/') ||
          url.hostname.includes('firebase') ||
          url.hostname.includes('googleapis') ||
          url.hostname.includes('r2.cloudflarestorage') ||
          url.hostname.includes('r2.dev') ||
          url.hostname.includes('paystack'),
        handler: 'NetworkOnly',
      },
      {
        urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
          networkTimeoutSeconds: 25,
        },
      },
    ],
  },
});

/**
 * Ensure required env vars are present during build time.
 * This helps catch missing config early in CI.
 */
const requiredEnv = [
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];

const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length > 0) {
  // Warn instead of throwing so the dev server can start while secrets are being configured
  console.warn(`[next.config] Warning: Missing env vars: ${missing.join(', ')} — some features may not work until these are set.`);
}

const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || '';
const r2PublicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';
const r2PublicHost = (() => {
  if (!r2PublicDomain) return '';
  try {
    return new URL(r2PublicDomain).hostname;
  } catch {
    return r2PublicDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
})();

const nextConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
    // Smaller / faster client chunks (helps avoid dev ChunkLoadError on heavy layouts).
    optimizePackageImports: ['lucide-react'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.mytestingdomain.icu',
        port: '',
        pathname: '/**',
      },
      ...(r2PublicHost
        ? [
            {
              protocol: 'https' as const,
              hostname: r2PublicHost,
              port: '',
              pathname: '/**',
            },
          ]
        : []),
      {
        protocol: 'https',
        hostname: '*.replit.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
  allowedDevOrigins: [
    'localhost:5000',
    '127.0.0.1:5000',
    '*.replit.dev',
    '*.worf.replit.dev',
    ...(replitDomain ? [replitDomain] : []),
  ],
  async redirects() {
    return [
      {
        source: '/admin/platform-controls',
        destination: '/admin/settings/general',
        permanent: true,
      },
      {
        source: '/admin/ai',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/admin/settings/theme',
        destination: '/admin/settings/general',
        permanent: true,
      },
    ];
  },
  // Ensure builds trace output files from the correct root when multiple lockfiles exist
  outputFileTracingRoot: process.cwd(),

  // Allow pdf.worker.min.mjs from pdfjs-dist to be served as a static asset
  webpack: (config, { dev }) => {
    config.resolve.alias.canvas = false;
    if (dev) {
      // Windows / network paths: more reliable watching; can reduce “stuck” compiles.
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 500,
        ...(process.env.WATCHPACK_POLLING === '1'
          ? { poll: 1000, ignored: ['**/node_modules/**'] }
          : {}),
      };
    }
    return config;
  },
};

export default withPWA(nextConfig);
