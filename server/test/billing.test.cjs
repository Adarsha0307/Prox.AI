const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');

const SERVER_DIR = path.join(__dirname, '..');
const ENTRY = path.join(SERVER_DIR, 'dist', 'index.js');
const SEED_DB = path.join(SERVER_DIR, 'sqlite.db');
const TEST_SECRET = 'billing-integration-test-secret';
const PORT = 32000 + Math.floor(Math.random() * 2000);
const BASE = `http://127.0.0.1:${PORT}`;

let tempDir;
let dbPath;
let child;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(method, route, { token, body, headers = {} } = {}) {
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers: reqHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  
  const text = await response.text();
  let json;
  try {
    json = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status, body: json };
}

test('Billing & Funded Usage API', async (t) => {
  t.before(async () => {
    if (!fs.existsSync(ENTRY)) {
      throw new Error(`dist/index.js not found. Run npm run build first.`);
    }

    dbPath = path.join(__dirname, 'billing-test-data.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    if (fs.existsSync(SEED_DB)) {
      fs.copyFileSync(SEED_DB, dbPath);
    }

    child = spawn('node', [ENTRY], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        PORT: PORT.toString(),
        DATABASE_PATH: dbPath,
        JWT_SECRET: TEST_SECRET,
        ENABLE_PLATFORM_FUNDING: 'true',
        OPENAI_API_KEY: 'mock-platform-key' // Will cause 401 from live provider
      },
      stdio: 'pipe',
    });

    let started = false;
    child.stdout.on('data', (d) => {
      const str = d.toString().trim();
      if (str.includes('listening on')) started = true;
      const match = str.match(/Your verification code is: (\d{6})/);
      if (match) {
        global.lastVerificationCode = match[1];
      }
    });

    for (let i = 0; i < 50; i++) {
      if (started) break;
      await sleep(100);
    }
    if (!started) throw new Error('Server failed to start in time');
  });

  t.after(() => {
    if (child) child.kill();
    try { if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); } catch {}
  });

  let email = `billing-${Date.now()}@test.com`;
  let token;
  let userId;

  await t.test('Register user and setup credits', async () => {
    const res = await api('POST', '/auth/register', { body: { email, name: 'Billing User', password: 'password' } });
    assert.equal(res.status, 200);
    
    const sqlite = new Database(dbPath);
    const userRow = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email);
    userId = userRow.id;
    sqlite.close();
    
    await sleep(500);
    const code = global.lastVerificationCode;
    
    const verifyRes = await api('POST', '/auth/verify-email', { body: { email, code } });
    assert.equal(verifyRes.status, 200);

    const loginRes = await api('POST', '/auth/login', { body: { email, password: 'password' } });
    assert.equal(loginRes.status, 200);
    token = loginRes.body.token;

    // Direct DB update to set credits to 5
    const db2 = new Database(dbPath);
    db2.prepare('UPDATE users SET credits = 5 WHERE id = ?').run(userId);
    db2.close();
  });

  await t.test('Refunds credits if generation fails from provider', async () => {
    const res = await api('POST', '/api/generate/outline', {
      token,
      body: { topic: 'Test Outline' }
    });
    
    // With fake OPENAI_API_KEY, it hits 401 provider rejected
    if (res.status !== 401) console.error('Refund test failed status:', res.status, res.body);
    assert.equal(res.status, 401);
    assert.equal(res.body?.code, 'provider_credentials_rejected');

    // Check credits remain 5 because of the refund!
    const sqlite = new Database(dbPath);
    const user = sqlite.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
    sqlite.close();
    assert.equal(user.credits, 5);
  });

  await t.test('Fails immediately with 402 if credits insufficient', async () => {
    // Set credits to 0
    const sqlite = new Database(dbPath);
    sqlite.prepare('UPDATE users SET credits = 0 WHERE id = ?').run(userId);
    
    const res = await api('POST', '/api/generate/image', {
      token,
      body: { prompt: 'Expensive Image' }
    });
    
    // It should hit the internal 402, NOT the provider 401
    if (res.status !== 402) console.error('402 test failed status:', res.status, res.body);
    assert.equal(res.status, 402);
    assert.equal(res.body?.code, 'insufficient_platform_credits');

    // Restore credits for next test
    sqlite.prepare('UPDATE users SET credits = 5 WHERE id = ?').run(userId);
    sqlite.close();
  });

  await t.test('Bypasses platform credits when BYOK is provided', async () => {
    const res = await api('POST', '/api/generate/image', {
      token,
      headers: {
        'X-Provider-Key': 'byok-fake-key'
      },
      body: { prompt: 'Test Image BYOK' }
    });
    
    // It should hit the provider using BYOK and get 401
    if (res.status !== 401) console.error('BYOK test failed status:', res.status, res.body);
    assert.equal(res.status, 401);
    assert.equal(res.body?.code, 'provider_credentials_rejected');

    // Check credits remain 5 (no deduction logic was run for BYOK)
    const sqlite = new Database(dbPath);
    const user = sqlite.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
    sqlite.close();
    assert.equal(user.credits, 5);
  });
});
