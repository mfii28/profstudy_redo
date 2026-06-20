/* eslint-disable no-console */
/**
 * One-shot migration: rewrite `courses/{courseId}/ragChunks/*` documents whose `embedding`
 * field is a plain number[] to Firestore `FieldValue.vector(...)` so `findNearest` works.
 *
 * Usage:
 *   node scripts/migrate-rag-chunks-to-firestore-vector.js          # dry-run (default)
 *   node scripts/migrate-rag-chunks-to-firestore-vector.js --apply  # write updates
 *
 * Requires the same Firebase Admin env as other scripts (.env.local with FIREBASE_ADMIN_CREDENTIALS).
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

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

async function main() {
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');

  if (!getApps().length) {
    const projectId = resolveProjectId();
    if (!projectId) {
      throw new Error('Set FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.');
    }
    const rawCreds = process.env.FIREBASE_ADMIN_CREDENTIALS;
    if (rawCreds) {
      const parsed = rawCreds.startsWith('{')
        ? JSON.parse(rawCreds)
        : JSON.parse(Buffer.from(rawCreds, 'base64').toString('utf8'));
      initializeApp({ credential: cert(parsed), projectId });
    } else {
      console.warn('[migrate-rag-vector] No FIREBASE_ADMIN_CREDENTIALS; using ADC / emulator.');
      initializeApp({ projectId });
    }
  }

  const db = getFirestore();
  let coursesScanned = 0;
  let chunksScanned = 0;
  let chunksNeedingUpdate = 0;
  let chunksUpdated = 0;
  const errors = [];

  const coursesSnap = await db.collection('courses').get();
  coursesScanned = coursesSnap.size;

  for (const courseDoc of coursesSnap.docs) {
    const chunksSnap = await courseDoc.ref.collection('ragChunks').get();
    const toUpdate = [];

    for (const d of chunksSnap.docs) {
      chunksScanned += 1;
      const data = d.data();
      const emb = data.embedding;
      if (Array.isArray(emb) && emb.length > 0 && typeof emb[0] === 'number') {
        toUpdate.push({ ref: d.ref, values: emb });
      }
    }

    for (const item of toUpdate) {
      chunksNeedingUpdate += 1;
      if (APPLY_MODE) {
        try {
          await item.ref.update({ embedding: FieldValue.vector(item.values) });
          chunksUpdated += 1;
        } catch (e) {
          errors.push(`${item.ref.path}: ${e.message || e}`);
        }
      }
    }
  }

  console.log(JSON.stringify({ coursesScanned, chunksScanned, chunksNeedingUpdate, chunksUpdated, apply: APPLY_MODE, errors }, null, 2));
  if (!APPLY_MODE && chunksNeedingUpdate > 0) {
    console.log('\nDry-run only. Re-run with --apply to write FieldValue.vector() on those documents.');
    console.log('Deploy the vector index first: firebase deploy --only firestore:indexes');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
