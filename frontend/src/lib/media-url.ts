const PUBLIC_KEY_PREFIXES = ['avatars/', 'courses/', 'products/', 'branding/', 'books/'];
const R2_PUBLIC_HOST = (() => {
  const domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';
  if (!domain) return '';
  try {
    return new URL(domain).hostname;
  } catch {
    return domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
})();

function normalizeStorageKey(input: string): string {
  let value = input.trim();

  if (value.startsWith('http')) {
    try {
      const parsed = new URL(value);
      const isR2LikeHost =
        parsed.hostname.includes('.r2.dev') ||
        parsed.hostname.includes('.r2.cloudflarestorage.com') ||
        parsed.hostname === 'cdn.mytestingdomain.icu' ||
        (R2_PUBLIC_HOST ? parsed.hostname === R2_PUBLIC_HOST : false);

      if (!isR2LikeHost) {
        return value;
      }

      value = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '');

      const bucketName = process.env.R2_BUCKET_NAME || 'profstudymate';
      if (value.startsWith(`${bucketName}/`)) {
        value = value.slice(bucketName.length + 1);
      }
    } catch {
      return value;
    }
  }

  value = value
    .replace(/^\/+/, '')
    .replace(/^public\/public\//, 'public/')
    .replace(/^uploads\/public\//, 'public/');

  if (!value.startsWith('public/') && PUBLIC_KEY_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    value = `public/${value}`;
  }

  return value;
}

function extractKeyFromMediaApiPath(path: string): string | null {
  if (!path.includes('/api/media/') || !path.includes('key=')) return null;
  try {
    const parsed = new URL(path, 'http://localhost');
    const key = parsed.searchParams.get('key');
    return key ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}

export function resolveMediaUrl(path?: string, fallback = '/placeholder.svg'): string {
  if (!path) return fallback;
  const apiKey = extractKeyFromMediaApiPath(path);
  if (apiKey) return resolveMediaUrl(apiKey, fallback);
  const normalizedPath = normalizeStorageKey(path);

  if (normalizedPath.startsWith('http')) {
    return normalizedPath;
  }

  const r2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';
  if (r2Domain && normalizedPath.startsWith('public/')) {
    return `${r2Domain.replace(/\/+$/, '')}/${normalizedPath}`;
  }

  return `/api/media/file?key=${encodeURIComponent(normalizedPath)}`;
}

/**
 * Resolves an avatar string to a displayable URL.
 * Handles: full URLs (http), R2 keys (public/avatars/...), or empty/missing values.
 * Returns undefined when no avatar is available so AvatarFallback (initials) renders.
 */
export function resolveAvatarUrl(avatar?: string): string | undefined {
  if (!avatar) return undefined;
  const normalizedPath = normalizeStorageKey(avatar);

  if (normalizedPath.startsWith('http')) {
    return normalizedPath;
  }

  const r2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';
  if (r2Domain && normalizedPath.startsWith('public/')) {
    return `${r2Domain.replace(/\/+$/, '')}/${normalizedPath}`;
  }

  return `/api/media/file?key=${encodeURIComponent(normalizedPath)}`;
}

export const resolveCloudflareMediaUrl = resolveMediaUrl;
