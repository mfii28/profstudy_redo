/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const APPLY_MODE = process.argv.includes('--apply');
const FILESYSTEM_ONLY_MODE = process.argv.includes('--filesystem-only');

const PROJECT_ROOT = process.cwd();
const STORAGE_BASE = path.resolve(PROJECT_ROOT, 'storage');
const PUBLIC_UPLOADS_BASE = path.resolve(PROJECT_ROOT, 'public', 'uploads');

function resolveProjectId() {
  const fromEnv =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (fromEnv) {
    return fromEnv;
  }

  const firebaseRcPath = path.join(PROJECT_ROOT, '.firebaserc');
  if (!fs.existsSync(firebaseRcPath)) {
    return '';
  }

  try {
    const rc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    return rc?.projects?.default || '';
  } catch {
    return '';
  }
}

function sanitizeKey(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/\\/g, '/')
    .replace(/\0/g, '')
    .replace(/\.\.(\/|\\)/g, '')
    .replace(/^\/+/, '');
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

function normalizeLegacyKey(rawKey) {
  const key = sanitizeKey(rawKey);
  if (!key) return '';

  if (key.startsWith('storage/')) {
    return key.slice('storage/'.length);
  }

  if (key.startsWith('public/uploads/')) {
    return key.slice('public/uploads/'.length);
  }

  if (key.startsWith('uploads/')) {
    return key.slice('uploads/'.length);
  }

  return key;
}

function canonicalLessonKey(courseId, rawKey) {
  const normalized = normalizeLegacyKey(rawKey);
  if (!normalized || isRemoteUrl(normalized)) return null;

  const canonicalPrefix = `private/courses/${courseId}/lessons/`;
  if (normalized.startsWith(canonicalPrefix)) {
    return normalized;
  }

  const fileName = path.posix.basename(normalized);
  if (!fileName) return null;

  return `${canonicalPrefix}${fileName}`;
}

function canonicalLibraryKey(tutorId, rawKey) {
  const normalized = normalizeLegacyKey(rawKey);
  if (!normalized || isRemoteUrl(normalized)) return null;

  const canonicalPrefix = `private/tutors/${tutorId}/library/`;
  if (normalized.startsWith(canonicalPrefix)) {
    return normalized;
  }

  const fileName = path.posix.basename(normalized);
  if (!fileName) return null;

  return `${canonicalPrefix}${fileName}`;
}

function resolveCanonicalAbsolutePath(key) {
  if (key.startsWith('private/')) {
    return path.resolve(STORAGE_BASE, key);
  }

  if (key.startsWith('public/')) {
    return path.resolve(PUBLIC_UPLOADS_BASE, key);
  }

  return null;
}

function fileExists(absolutePath) {
  try {
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

function getSourceCandidates(rawKey) {
  const normalized = normalizeLegacyKey(rawKey);
  if (!normalized) return [];

  const candidates = new Set([normalized]);

  if (!normalized.startsWith('private/') && !normalized.startsWith('public/')) {
    candidates.add(`private/${normalized}`);
    candidates.add(`public/${normalized}`);
  }

  const absoluteCandidates = new Set();
  for (const key of candidates) {
    if (key.startsWith('private/')) {
      absoluteCandidates.add(path.resolve(STORAGE_BASE, key));
      absoluteCandidates.add(path.resolve(PUBLIC_UPLOADS_BASE, key));
      continue;
    }

    if (key.startsWith('public/')) {
      absoluteCandidates.add(path.resolve(PUBLIC_UPLOADS_BASE, key));
      absoluteCandidates.add(path.resolve(STORAGE_BASE, key));
      continue;
    }

    absoluteCandidates.add(path.resolve(STORAGE_BASE, key));
    absoluteCandidates.add(path.resolve(PUBLIC_UPLOADS_BASE, key));
  }

  return Array.from(absoluteCandidates);
}

function findFirstExistingSource(rawKey) {
  const candidates = getSourceCandidates(rawKey);
  for (const absolutePath of candidates) {
    if (fileExists(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

function copyThenDelete(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);

  const sourceSize = fs.statSync(sourcePath).size;
  const targetSize = fs.statSync(targetPath).size;
  if (sourceSize !== targetSize) {
    throw new Error(`Size mismatch after copy (${sourceSize} != ${targetSize}).`);
  }

  if (sourcePath !== targetPath) {
    fs.unlinkSync(sourcePath);
  }
}

function printHeader() {
  console.log('--- Asset Key Migration ---');
  const mode = FILESYSTEM_ONLY_MODE
    ? APPLY_MODE
      ? 'FILESYSTEM-ONLY APPLY'
      : 'FILESYSTEM-ONLY DRY-RUN'
    : APPLY_MODE
      ? 'APPLY'
      : 'DRY-RUN';
  console.log(`Mode: ${mode}`);
  console.log(`Storage base: ${STORAGE_BASE}`);
  console.log(`Public uploads base: ${PUBLIC_UPLOADS_BASE}`);
  console.log('');
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function migrateFilesystemOnly(summary) {
  const misplacedRoots = [
    {
      sourceRoot: path.resolve(PUBLIC_UPLOADS_BASE, 'private'),
      targetBase: STORAGE_BASE,
      namespacePrefix: 'private',
    },
    {
      sourceRoot: path.resolve(STORAGE_BASE, 'public'),
      targetBase: PUBLIC_UPLOADS_BASE,
      namespacePrefix: 'public',
    },
  ];

  for (const config of misplacedRoots) {
    const files = walkFiles(config.sourceRoot);
    for (const sourcePath of files) {
      const relativeToNamespace = path.relative(config.sourceRoot, sourcePath);
      const targetPath = path.resolve(config.targetBase, config.namespacePrefix, relativeToNamespace);
      if (sourcePath === targetPath) {
        continue;
      }

      const targetExists = fileExists(targetPath);
      if (!targetExists) {
        if (APPLY_MODE) {
          try {
            copyThenDelete(sourcePath, targetPath);
          } catch (error) {
            summary.errors.push(`Filesystem-only move failed (${sourcePath} -> ${targetPath}): ${error.message}`);
            continue;
          }
        }
        summary.filesMoved += 1;
      }
    }
  }
}

function printSummary(summary) {
  console.log('--- Summary ---');
  console.log(`Courses scanned: ${summary.coursesScanned}`);
  console.log(`Library assets scanned: ${summary.libraryAssetsScanned}`);
  console.log(`Records changed: ${summary.recordsChanged}`);
  console.log(`Files moved: ${summary.filesMoved}`);
  console.log(`Missing source files: ${summary.missingSource}`);
  console.log(`Skipped remote urls: ${summary.skippedRemote}`);
  console.log(`Skipped invalid entries: ${summary.skippedInvalid}`);
  console.log(`Errors: ${summary.errors.length}`);

  if (summary.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const error of summary.errors) {
      console.log(`- ${error}`);
    }
  }
}

async function main() {
  printHeader();

  const summary = {
    coursesScanned: 0,
    libraryAssetsScanned: 0,
    recordsChanged: 0,
    filesMoved: 0,
    missingSource: 0,
    skippedRemote: 0,
    skippedInvalid: 0,
    errors: [],
  };

  if (FILESYSTEM_ONLY_MODE) {
    migrateFilesystemOnly(summary);
    printSummary(summary);
    if (!APPLY_MODE) {
      console.log('');
      console.log('Dry-run only. Re-run with --apply --filesystem-only to execute file moves.');
    }
    return;
  }

  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');

  try {
    if (!getApps().length) {
      const projectId = resolveProjectId();
      if (!projectId) {
        throw new Error(
          'Unable to detect Firebase project ID. Set FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.'
        );
      }

      const rawCreds = process.env.FIREBASE_ADMIN_CREDENTIALS;
      if (rawCreds) {
        const parsed = rawCreds.startsWith('{')
          ? JSON.parse(rawCreds)
          : JSON.parse(Buffer.from(rawCreds, 'base64').toString('utf8'));
        initializeApp({ credential: cert(parsed), projectId });
      } else {
        console.warn(
          '[Migration] FIREBASE_ADMIN_CREDENTIALS is missing. Using application default credentials; this requires a local ADC login or emulator host.'
        );
        initializeApp({ projectId });
      }
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK.');
    console.error('Set FIREBASE_ADMIN_CREDENTIALS in .env.local (raw JSON or base64 JSON),');
    console.error('or run against emulator with FIRESTORE_EMULATOR_HOST,');
    console.error('or authenticate ADC via: gcloud auth application-default login');
    throw error;
  }

  const db = getFirestore();

  const coursesSnap = await db.collection('courses').get();
  summary.coursesScanned = coursesSnap.size;

  for (const courseDoc of coursesSnap.docs) {
    const course = courseDoc.data();
    const sections = Array.isArray(course.sections) ? course.sections : [];
    let courseChanged = false;

    for (const section of sections) {
      const lessons = Array.isArray(section.lessons) ? section.lessons : [];

      for (const lesson of lessons) {
        const oldRawKey = lesson.contentUrl;
        if (!oldRawKey || typeof oldRawKey !== 'string') {
          summary.skippedInvalid += 1;
          continue;
        }

        if (isRemoteUrl(oldRawKey)) {
          summary.skippedRemote += 1;
          continue;
        }

        const newKey = canonicalLessonKey(courseDoc.id, oldRawKey);
        if (!newKey) {
          summary.skippedInvalid += 1;
          continue;
        }

        const targetPath = resolveCanonicalAbsolutePath(newKey);
        if (!targetPath) {
          summary.skippedInvalid += 1;
          continue;
        }

        const oldNormalized = normalizeLegacyKey(oldRawKey);
        const sourcePath = findFirstExistingSource(oldNormalized) || findFirstExistingSource(newKey);
        const targetExists = fileExists(targetPath);

        if (!sourcePath && !targetExists) {
          summary.missingSource += 1;
          summary.errors.push(`Missing file for course ${courseDoc.id}, lesson ${lesson.id}, key ${oldRawKey}`);
        }

        if (sourcePath && sourcePath !== targetPath && !targetExists) {
          if (APPLY_MODE) {
            try {
              copyThenDelete(sourcePath, targetPath);
            } catch (error) {
              summary.errors.push(`Move failed for course ${courseDoc.id}, lesson ${lesson.id}: ${error.message}`);
              continue;
            }
          }
          summary.filesMoved += 1;
        }

        if (lesson.contentUrl !== newKey) {
          lesson.contentUrl = newKey;
          courseChanged = true;
        }
      }
    }

    if (courseChanged) {
      summary.recordsChanged += 1;
      if (APPLY_MODE) {
        try {
          await courseDoc.ref.update({ sections: course.sections || [] });
        } catch (error) {
          summary.errors.push(`Failed to update course ${courseDoc.id}: ${error.message}`);
        }
      }
    }
  }

  const librarySnap = await db.collection('libraryAssets').get();
  summary.libraryAssetsScanned = librarySnap.size;

  for (const assetDoc of librarySnap.docs) {
    const asset = assetDoc.data();
    const oldRawKey = asset.url;
    const tutorId = asset.tutorId;

    if (!oldRawKey || typeof oldRawKey !== 'string' || !tutorId || typeof tutorId !== 'string') {
      summary.skippedInvalid += 1;
      continue;
    }

    if (isRemoteUrl(oldRawKey)) {
      summary.skippedRemote += 1;
      continue;
    }

    const newKey = canonicalLibraryKey(tutorId, oldRawKey);
    if (!newKey) {
      summary.skippedInvalid += 1;
      continue;
    }

    const targetPath = resolveCanonicalAbsolutePath(newKey);
    if (!targetPath) {
      summary.skippedInvalid += 1;
      continue;
    }

    const oldNormalized = normalizeLegacyKey(oldRawKey);
    const sourcePath = findFirstExistingSource(oldNormalized) || findFirstExistingSource(newKey);
    const targetExists = fileExists(targetPath);

    if (!sourcePath && !targetExists) {
      summary.missingSource += 1;
      summary.errors.push(`Missing file for library asset ${assetDoc.id}, key ${oldRawKey}`);
    }

    if (sourcePath && sourcePath !== targetPath && !targetExists) {
      if (APPLY_MODE) {
        try {
          copyThenDelete(sourcePath, targetPath);
        } catch (error) {
          summary.errors.push(`Move failed for library asset ${assetDoc.id}: ${error.message}`);
          continue;
        }
      }
      summary.filesMoved += 1;
    }

    if (asset.url !== newKey) {
      summary.recordsChanged += 1;
      if (APPLY_MODE) {
        try {
          await assetDoc.ref.update({ url: newKey });
        } catch (error) {
          summary.errors.push(`Failed to update library asset ${assetDoc.id}: ${error.message}`);
        }
      }
    }
  }

  printSummary(summary);

  if (!APPLY_MODE) {
    console.log('');
    console.log('Dry-run only. Re-run with --apply to execute file moves and Firestore writes.');
  }
}

main().catch((error) => {
  console.error('Migration failed with an unrecoverable error.');
  console.error(error?.message || error);
  process.exit(1);
});
