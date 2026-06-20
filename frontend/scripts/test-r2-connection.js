/**
 * Quick R2 connectivity test.
 * Run: node scripts/test-r2-connection.js
 */
const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET_NAME) {
  console.error('Missing R2 credentials in .env');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

async function test() {
  console.log('Testing R2 connection...');
  console.log('Endpoint:', `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`);
  console.log('Bucket:', BUCKET_NAME);
  console.log('');

  // Test 1: List objects
  try {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 5,
    }));
    console.log('✅ ListObjects succeeded!');
    console.log('   Objects found:', result.KeyCount);
    if (result.Contents) {
      result.Contents.forEach(obj => console.log('   -', obj.Key, `(${obj.Size} bytes)`));
    }
  } catch (err) {
    console.error('❌ ListObjects failed:', err.message);
    console.error('   Code:', err.Code || err.$metadata?.httpStatusCode);
  }

  console.log('');

  // Test 2: Generate presigned PUT URL
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'test/connectivity-check.txt',
      ContentType: 'text/plain',
    });
    const url = await getSignedUrl(s3, command, {
      expiresIn: 60,
      unhoistableHeaders: new Set(['content-type']),
    });
    console.log('✅ Presigned PUT URL generated!');
    console.log('   URL starts with:', url.substring(0, 80) + '...');
    console.log('   Contains bucket in path:', url.includes(`/${BUCKET_NAME}/`));

    // Test 3: Actually upload using the presigned URL
    const response = await fetch(url, {
      method: 'PUT',
      body: 'Hello from R2 connectivity test!',
      headers: { 'Content-Type': 'text/plain' },
    });
    if (response.ok) {
      console.log('✅ Upload via presigned URL succeeded! Status:', response.status);
    } else {
      const body = await response.text();
      console.error('❌ Upload via presigned URL failed! Status:', response.status);
      console.error('   Response:', body.substring(0, 500));
    }
  } catch (err) {
    console.error('❌ Presigned URL test failed:', err.message);
  }

  console.log('');

  // Test 4: CDN domain check
  const cdnDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
  if (cdnDomain) {
    try {
      const cdnResponse = await fetch(`${cdnDomain}/test/connectivity-check.txt`);
      if (cdnResponse.ok) {
        const text = await cdnResponse.text();
        console.log('✅ CDN retrieval succeeded!');
        console.log('   Content:', text);
      } else {
        console.error('❌ CDN retrieval failed! Status:', cdnResponse.status);
      }
    } catch (err) {
      console.error('❌ CDN domain unreachable:', err.message);
    }
  } else {
    console.warn('⚠️  NEXT_PUBLIC_R2_PUBLIC_DOMAIN not set — CDN test skipped');
  }
}

test().catch(console.error);
