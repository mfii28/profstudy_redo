/**
 * Authentication Audit Test — Playwright Script
 * Tests: Login, token handling, API calls, redirects, admin access
 */
import { chromium } from 'playwright';

const ADMIN_EMAIL = 'admin@studymate.com';
const ADMIN_PASSWORD = 'admin@studymate.com';
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Collect all console messages
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  // Collect all failed requests
  const failedRequests = [];
  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      failure: req.failure()?.errorText,
      method: req.method(),
    });
  });

  // Collect all responses
  const responses = [];
  page.on('response', (resp) => {
    responses.push({
      url: resp.url(),
      status: resp.status(),
      method: resp.request().method(),
    });
  });

  console.log('=== PHASE 1: Navigate to Admin Login ===');
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'audit-01-admin-login-page.png', fullPage: true });
  console.log('Page title:', await page.title());

  console.log('\n=== PHASE 2: Attempt Login ===');
  // Fill in the login form
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.screenshot({ path: 'audit-02-before-login.png', fullPage: true });

  // Click the login button
  await page.click('button[type="submit"]');
  
  // Wait for navigation after login
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'audit-03-after-login.png', fullPage: true });

  console.log('Current URL:', page.url());

  // Check cookies
  const cookies = await context.cookies();
  console.log('Cookies:', cookies.map(c => ({ name: c.name, value: c.value.substring(0, 30) + '...', domain: c.domain })));

  console.log('\n=== PHASE 3: Check if we reached admin dashboard ===');
  if (page.url().includes('/admin')) {
    console.log('SUCCESS: Reached admin page');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'audit-04-admin-dashboard.png', fullPage: true });
  } else {
    console.log('FAILED: Did not reach admin page');
  }

  console.log('\n=== PHASE 4: Network Responses Summary ===');
  const backendCalls = responses.filter(r => r.url.includes('localhost:8000'));
  console.log('Backend API calls:', backendCalls.length);
  for (const r of backendCalls) {
    const statusIcon = r.status >= 200 && r.status < 300 ? '✅' : r.status >= 400 ? '❌' : '⚠️';
    console.log(`  ${statusIcon} ${r.method} ${r.url.split('/api/v1')[1] || r.url} → ${r.status}`);
  }

  console.log('\n=== PHASE 5: Failed Requests ===');
  for (const r of failedRequests) {
    console.log(`❌ ${r.method} ${r.url} → ${r.failure}`);
  }

  console.log('\n=== PHASE 6: Console Logs (important entries) ===');
  const importantLogs = consoleLogs.filter(l => 
    l.type === 'error' || l.text.includes('[Admin') || l.text.includes('401') || 
    l.text.includes('auth') || l.text.includes('token') || l.text.includes('credentials')
  );
  for (const l of importantLogs) {
    console.log(`[${l.type}] ${l.text.substring(0, 300)}`);
  }

  console.log('\n=== PHASE 7: Check /api/v1 health endpoint ===');
  // Now let's make an API debug call
  const apiTests = [
    { name: 'Health', url: `${API_URL}/health` },
    { name: 'API docs', url: `${API_URL}/docs` },
  ];
  for (const test of apiTests) {
    try {
      const resp = await page.request.get(test.url);
      console.log(`${test.name}: ${resp.status()} ${resp.statusText()}`);
    } catch (e) {
      console.log(`${test.name}: FAILED - ${e.message}`);
    }
  }

  console.log('\n=== PHASE 8: Full Console Log Dump ===');
  consoleLogs.forEach(l => {
    if (l.type === 'error' || l.type === 'warning') {
      console.log(`[${l.type}] ${l.text.substring(0, 500)}`);
    }
  });

  await browser.close();
  console.log('\n=== AUDIT COMPLETE ===');
}

run().catch(async (err) => {
  console.error('AUDIT FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
