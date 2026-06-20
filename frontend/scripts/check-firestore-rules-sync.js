const fs = require('fs');
const path = require('path');

const rootRulesPath = path.join(process.cwd(), 'firestore.rules');
const srcRulesPath = path.join(process.cwd(), 'src', 'firestore.rules');

function normalize(content) {
  return content.replace(/\r\n/g, '\n').trim();
}

try {
  const rootRules = normalize(fs.readFileSync(rootRulesPath, 'utf8'));
  const srcRules = normalize(fs.readFileSync(srcRulesPath, 'utf8'));

  if (rootRules !== srcRules) {
    console.error('Firestore rules mismatch detected between firestore.rules and src/firestore.rules.');
    console.error('Keep both files identical to avoid deploying stale policies.');
    process.exit(1);
  }

  console.log('Firestore rules are synchronized.');
} catch (error) {
  console.error('Failed to verify Firestore rules synchronization.');
  console.error(error.message || error);
  process.exit(1);
}
