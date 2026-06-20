/**
 * Apply CORS configuration to the Cloudflare R2 bucket.
 * Run: node scripts/apply-r2-cors.js
 * 
 * Requires: @aws-sdk/client-s3 (already installed)
 */
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
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

async function applyCors() {
  const corsConfig = {
    CORSRules: [
      {
        AllowedOrigins: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
  };

  console.log('Applying CORS to R2 bucket:', BUCKET_NAME);
  console.log('Config:', JSON.stringify(corsConfig, null, 2));

  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: corsConfig,
    }));
    console.log('✅ CORS applied successfully!');
  } catch (err) {
    console.error('❌ Failed to apply CORS:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }

  // Verify
  try {
    const result = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET_NAME }));
    console.log('\n📋 Current CORS rules:');
    console.log(JSON.stringify(result.CORSRules, null, 2));
  } catch (err) {
    console.warn('⚠️  Could not verify CORS (GetBucketCors may not be supported by R2):', err.message);
  }
}

applyCors();
