import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '@/lib/s3-client';

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'profstudymate';

function sanitizeKey(key: string) {
  let decoded = key;
  try { decoded = decodeURIComponent(key); } catch { /* keep original if malformed */ }
  let prev = '';
  while (prev !== decoded) {
    prev = decoded;
    decoded = decoded.replace(/\.\.[/\\]/g, '').replace(/%2e%2e[/\\%]/gi, '');
  }
  return decoded.replace(/[<>:"|?*\\]/g, '').replace(/\0/g, '').trim();
}

function normalizePublicKey(rawKey: string) {
  let value = sanitizeKey(rawKey);

  if (value.startsWith('http')) {
    try {
      const parsed = new URL(value);
      value = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '');
    } catch {
      // Keep original sanitized value on parse failure.
    }
  }

  const bucketName = process.env.R2_BUCKET_NAME || BUCKET_NAME;
  if (value.startsWith(`${bucketName}/`)) {
    value = value.slice(bucketName.length + 1);
  }

  value = value
    .replace(/^\/+/, '')
    .replace(/^public\/public\//, 'public/')
    .replace(/^uploads\/public\//, 'public/');

  if (!value.startsWith('public/')) {
    const knownPublicPrefix = ['avatars/', 'courses/', 'products/', 'branding/', 'books/']
      .some((prefix) => value.startsWith(prefix));
    if (knownPublicPrefix) {
      value = `public/${value}`;
    }
  }

  return value;
}

export async function GET(request: NextRequest) {
  const keyParam = request.nextUrl.searchParams.get('key');
  if (!keyParam) {
    return NextResponse.json({ error: 'Missing key parameter.' }, { status: 400 });
  }

  const cleanKey = normalizePublicKey(keyParam);

  if (!cleanKey.startsWith('public/')) {
    return NextResponse.json({ error: 'Only public assets are supported by this endpoint.' }, { status: 403 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: cleanKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    return NextResponse.redirect(signedUrl, 307);
  } catch (error: any) {
    console.error('[Media] Failed to resolve URL for key:', cleanKey, error);
    return NextResponse.json({ error: 'Failed to resolve media URL.' }, { status: 500 });
  }
}
