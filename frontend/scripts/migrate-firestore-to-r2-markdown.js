/* eslint-disable no-console */
/**
 * One-shot migration: read `courses/{courseId}/ragChunks/*` documents,
 * rebuild them into full documents, compile into a unified Markdown context file,
 * write to Cloudflare R2, and create RAG source metadata documents.
 *
 * Usage:
 *   node scripts/migrate-firestore-to-r2-markdown.js          # dry-run (default)
 *   node scripts/migrate-firestore-to-r2-markdown.js --apply  # write updates to R2 & Firestore
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env or .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn('[Migration] No .env or .env.local file found. Operating on system env vars.');
}

const APPLY_MODE = process.argv.includes('--apply');

function resolveProjectId() {
  const fromEnv =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (fromEnv) return fromEnv;
  const firebaseRcPath = path.join(process.cwd(), '.firebaserc');
  if (!fs.existsSync(firebaseRcPath)) return '';
  try {
    const rc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    return rc?.projects?.default || '';
  } catch {
    return '';
  }
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

async function main() {
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error('Set FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.');
  }

  // Initialize Firebase Admin
  if (!getApps().length) {
    const rawCreds = process.env.FIREBASE_ADMIN_CREDENTIALS;
    if (rawCreds) {
      let jsonCandidate = rawCreds;
      if (jsonCandidate.startsWith('{')) {
        jsonCandidate = jsonCandidate.replace(/"private_key"\s*:\s*"([\s\S]+?)"/g, (match, keyContent) => {
          const sanitizedKey = keyContent.replace(/\n/g, '\\n').replace(/\r/g, '');
          return `"private_key": "${sanitizedKey}"`;
        });
      }
      const parsed = rawCreds.startsWith('{')
        ? JSON.parse(jsonCandidate)
        : JSON.parse(Buffer.from(rawCreds, 'base64').toString('utf8'));
      initializeApp({ credential: cert(parsed), projectId });
    } else {
      console.warn('[Migration] No FIREBASE_ADMIN_CREDENTIALS; using ADC / emulator.');
      initializeApp({ projectId });
    }
  }

  // Initialize Cloudflare R2 client
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'profstudymate';

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    throw new Error('Missing Cloudflare R2 environment credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).');
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });

  const db = getFirestore();
  const coursesSnap = await db.collection('courses').get();
  console.log(`Scanning RAG collections across ${coursesSnap.size} courses...`);

  let coursesProcessed = 0;
  let totalChunksRead = 0;
  let r2FilesUploaded = 0;
  let metaCreated = 0;

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;
    const chunksSnap = await courseDoc.ref.collection('ragChunks').get();
    if (chunksSnap.empty) continue;

    console.log(`Course [${courseId}]: Found ${chunksSnap.size} legacy chunks. Consolidating...`);
    coursesProcessed++;

    // Group chunks by source label
    const sources = {};
    chunksSnap.docs.forEach(d => {
      totalChunksRead++;
      const data = d.data();
      const source = data.sourceFile || 'Course material';
      if (!sources[source]) {
        sources[source] = [];
      }
      sources[source].push({
        text: data.text || '',
        index: typeof data.chunkIndex === 'number' ? data.chunkIndex : 0,
      });
    });

    let combinedMarkdown = '';
    const metadataUpdates = [];

    // Sort chunks and join text
    for (const [sourceLabel, list] of Object.entries(sources)) {
      list.sort((a, b) => a.index - b.index);
      const fullText = list.map(item => item.text).join('\n\n');
      
      combinedMarkdown += `\n\n## Source: ${sourceLabel.trim()}\n${fullText.trim()}`;
      
      const contentHash = sha256Hex(fullText);
      metadataUpdates.push({
        sourceFile: sourceLabel.trim(),
        contentHash,
        chunkCount: list.length,
      });
    }

    combinedMarkdown = combinedMarkdown.trim();
    if (!combinedMarkdown) continue;

    const key = `private/courses/${courseId}/rag/materials.md`;

    if (APPLY_MODE) {
      console.log(`Course [${courseId}]: Writing Markdown to R2...`);
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: Buffer.from(combinedMarkdown, 'utf-8'),
        ContentType: 'text/markdown',
      }));
      r2FilesUploaded++;

      const metaCol = courseDoc.ref.collection('ragSourceMeta');
      for (const update of metadataUpdates) {
        const docId = sha256Hex(update.sourceFile);
        await metaCol.doc(docId).set({
          sourceFile: update.sourceFile,
          contentHash: update.contentHash,
          chunkCount: update.chunkCount,
          updatedAt: Date.now(),
        });
        metaCreated++;
      }
      console.log(`Course [${courseId}]: Successfully uploaded materials and created ${metadataUpdates.length} metadata docs.`);
    } else {
      console.log(`Course [${courseId}]: [Dry-Run] Rebuilt unified Markdown. Output size: ${combinedMarkdown.length} chars. Sources: ${metadataUpdates.map(m => m.sourceFile).join(', ')}`);
    }
  }

  console.log('\nMigration Summary:');
  console.log(JSON.stringify({
    coursesProcessed,
    totalChunksRead,
    r2FilesUploaded,
    metaCreated,
    apply: APPLY_MODE
  }, null, 2));

  if (!APPLY_MODE && coursesProcessed > 0) {
    console.log('\nThis was a dry-run. Run with "--apply" to write changes to Cloudflare R2 and Firestore.');
  }
}

main().catch(err => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});
