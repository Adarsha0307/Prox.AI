const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const SERVER_DIR = path.join(__dirname, '..');
const ENTRY = path.join(SERVER_DIR, 'dist', 'index.js');
const SEED_DB = path.join(SERVER_DIR, 'sqlite.db');
const TEST_SECRET = 'integration-test-secret-value';
const PORT = 31000 + Math.floor(Math.random() * 2000);
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

test('BYOK API integration tests', async (t) => {
  t.before(async () => {
    if (!fs.existsSync(ENTRY)) {
      throw new Error(`dist/index.js not found. Run npm run build first.`);
    }

    dbPath = path.join(__dirname, 'byok-test-data.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    if (fs.existsSync(SEED_DB)) {
      fs.copyFileSync(SEED_DB, dbPath);
    }

    child = spawn('node', [ENTRY], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        PORT: PORT.toString(),
        DATABASE_URL: dbPath,
        JWT_SECRET: TEST_SECRET,
        // ENABLE_PLATFORM_FUNDING is explicitly NOT set, so it should default to false
      },
      stdio: 'pipe',
    });

    let started = false;
    child.stdout.on('data', (d) => {
      const str = d.toString().trim();
      console.log('SERVER OUT:', str);
      if (str.includes('listening on')) started = true;
      const match = str.match(/Your verification code is: (\d{6})/);
      if (match) {
        global.lastVerificationCode = match[1];
      }
    });
    child.stderr.on('data', (d) => console.error('SERVER ERR:', d.toString().trim()));

    // Wait up to 5s for server to bind
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

  let email = `byok-${Date.now()}@test.com`;
  let token;

  await t.test('Register user', async () => {
    const res = await api('POST', '/auth/register', { body: { email, name: 'BYOK User', password: 'password' } });
    assert.equal(res.status, 200, 'Registration should succeed');
    
    await new Promise(r => setTimeout(r, 500));
    const code = global.lastVerificationCode;
    console.log(`Extracted code from stdout: ${code}`);
    
    const verifyRes = await api('POST', '/auth/verify-email', { body: { email, code } });
    if (verifyRes.status !== 200) console.error('Verification failed:', verifyRes.body, 'with code:', code);
    assert.equal(verifyRes.status, 200, 'Verification should succeed');
  });

  await t.test('Login', async () => {
    const res = await api('POST', '/auth/login', { body: { email, password: 'password' } });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    token = res.body.token;
  });

  await t.test('Generate Outline without BYOK fails when funding disabled', async () => {
    const res = await api('POST', '/api/generate/outline', {
      token,
      body: { topic: 'Testing BYOK' }
    });
    
    assert.equal(res.status, 402);
    assert.equal(res.body.code, 'platform_funding_disabled');
  });

  await t.test('Generate Outline with invalid BYOK hits live provider and fails', async () => {
    const res = await api('POST', '/api/generate/outline', {
      token,
      headers: {
        'X-Provider-Key': 'sk-invalid-fake-key'
      },
      body: { topic: 'Testing BYOK' }
    });
    
    // We expect the backend to actually try the OpenAI API, fail with 401, and map it.
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'provider_credentials_rejected');
  });
  
  await t.test('Generate Image with invalid BYOK hits live provider and fails', async () => {
    const res = await api('POST', '/api/generate/image', {
      token,
      headers: {
        'X-Provider-Key': 'sk-valid-or-not'
      },
      body: { prompt: 'Draw something' }
    });
    
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'provider_credentials_rejected');
  });
});
