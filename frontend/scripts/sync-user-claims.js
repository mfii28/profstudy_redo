
const admin = require('firebase-admin');

/**
 * PRODUCTION UTILITY: Syncs existing Firestore user roles to Firebase Auth Custom Claims.
 * This is a one-time migration required after optimizing firestore.rules to 
 * prioritize zero-read claim checks.
 * 
 * RUN: node scripts/sync-user-claims.js
 */

async function syncAllUserClaims() {
  console.log('--- STARTING USER CLAIM SYNC ---');
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(), // Assumes GOOGLE_APPLICATION_CREDENTIALS is set
    });
  }

  const db = admin.firestore();
  const auth = admin.auth();
  const usersCollection = db.collection('users');
  
  try {
    const snapshot = await usersCollection.get();
    console.log(`Found ${snapshot.size} users to process.`);
    
    let processed = 0;
    let failed = 0;
    
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const uid = doc.id;
      const role = userData.role || 'student';
      
      try {
        await auth.setCustomUserClaims(uid, { role });
        processed++;
        if (processed % 10 === 0) console.log(`Processed ${processed} users...`);
      } catch (err) {
        console.error(`Failed to sync claims for UID: ${uid}`, err.message);
        failed++;
      }
    }
    
    console.log('--- SYNC COMPLETE ---');
    console.log(`Successfully synced: ${processed}`);
    console.log(`Failed: ${failed}`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

syncAllUserClaims();
