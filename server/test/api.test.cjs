/**
 * API integration tests for accounts, authorization, and cloud projects.
 *
 * Runs the compiled server (dist/index.js) against a *disposable copy* of the
 * SQLite database, so no real data is touched. Requires `npm run build` first:
 *
 *   npm run build && npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
let Database;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function textElement(id) {
  return {
    id,
    type: 'text',
    role: 'heading',
    text: 'Hello QA',
    left: 10,
    top: 10,
    width: 400,
    height: 100,
    rotation: 0,
    opacity: 1,
    locked: false,
    fontFamily: 'Inter',
    fontSize: 60,
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: 'left',
    fill: '#000000',
    lineHeight: 1.2,
    charSpacing: 0,
  };
}

function templateProject(id, overrides = {}) {
  return {
    id,
    title: 'QA Fixture Carousel',
    createdAt: 1,
    updatedAt: 1,
    dimensions: { width: 1080, height: 1080 },
    revision: 1,
    schemaVersion: '1.0',
    theme: {
      colors: { primary: '#000000', secondary: '#666666', background: '#ffffff', text: '#000000' },
      fonts: { heading: 'Inter', body: 'Inter' },
    },
    slides: [{ id: `${id}-slide-1`, background: '#ffffff', elements: [textElement(`${id}-el-1`)] }],
    ...overrides,
  };
}

async function api(method, route, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers,
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

function readVerificationCode(email) {
  const database = new Database(dbPath, { readonly: true });
  try {
    const row = database.prepare('select verification_code from users where email = ?').get(email);
    return row ? row.verification_code : null;
  } finally {
    database.close();
  }
}

async function registerAndVerify(email, name) {
  const password = 'qa-password-123';
  const registered = await api('POST', '/auth/register', { body: { email, password, name } });
  assert.equal(registered.status, 200, `register ${email}: ${JSON.stringify(registered.body)}`);

  const code = readVerificationCode(email);
  assert.ok(code, `verification code should be stored for ${email}`);

  const verified = await api('POST', '/auth/verify-email', { body: { email, code } });
  assert.equal(verified.status, 200, `verify ${email}: ${JSON.stringify(verified.body)}`);
  assert.ok(verified.body.token, 'verify should return a token');

  return { email, password, token: verified.body.token, user: verified.body.user };
}

test.before(async () => {
  assert.ok(fs.existsSync(ENTRY), 'dist/index.js is missing - run `npm run build` in server/ first');
  assert.ok(fs.existsSync(SEED_DB), 'server/sqlite.db seed database is missing');

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prox-qa-'));
  dbPath = path.join(tempDir, 'test.sqlite.db');
  fs.copyFileSync(SEED_DB, dbPath);
  Database = require('better-sqlite3');

  child = spawn(process.execPath, [ENTRY], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH: dbPath,
      AUTH_SECRET: TEST_SECRET,
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  let healthy = false;
  for (let attempt = 0; attempt < 60 && !healthy; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      healthy = response.ok;
    } catch {
      await sleep(250);
    }
  }
  assert.ok(healthy, 'test server failed to start');
});

test.after(async () => {
  if (child && !child.killed) {
    child.kill();
    // Windows keeps the SQLite file locked until the child process has exited.
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  if (tempDir && fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort: a locked temp directory must never fail the suite.
    }
  }
});

test('registration rejects malformed input with 400 instead of 500', async () => {
  const missingPassword = await api('POST', '/auth/register', {
    body: { email: 'qa-missing-password@example.com', name: 'No Password' },
  });
  assert.equal(missingPassword.status, 400);

  const shortPassword = await api('POST', '/auth/register', {
    body: { email: 'qa-short@example.com', name: 'Short', password: 'short' },
  });
  assert.equal(shortPassword.status, 400);

  const badEmail = await api('POST', '/auth/register', {
    body: { email: 'not-an-email', name: 'Bad Email', password: 'qa-password-123' },
  });
  assert.equal(badEmail.status, 400);
});

test('unauthenticated and invalid tokens cannot reach project endpoints', async () => {
  assert.equal((await api('GET', '/api/projects')).status, 401);
  assert.equal((await api('GET', '/api/projects', { token: 'not.a.token' })).status, 401);
  assert.equal((await api('GET', '/api/projects', { token: 'aaaa.bbbb.cccc' })).status, 401);
  assert.equal((await api('GET', '/api/projects/some-id')).status, 401);
  assert.equal((await api('POST', '/api/projects', { body: templateProject('x') })).status, 401);
});

test('accounts, project ownership, and cross-account isolation', async () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const accountA = await registerAndVerify(`qa-a-${suffix}@example.com`, 'QA Account A');
  const accountB = await registerAndVerify(`qa-b-${suffix}@example.com`, 'QA Account B');

  // Unverified accounts cannot sign in.
  const unverifiedEmail = `qa-unverified-${suffix}@example.com`;
  await api('POST', '/auth/register', {
    body: { email: unverifiedEmail, password: 'qa-password-123', name: 'Unverified' },
  });
  const blockedLogin = await api('POST', '/auth/login', {
    body: { email: unverifiedEmail, password: 'qa-password-123' },
  });
  assert.equal(blockedLogin.status, 403);

  const wrongPassword = await api('POST', '/auth/login', {
    body: { email: accountA.email, password: 'definitely-wrong' },
  });
  assert.equal(wrongPassword.status, 400);

  // --- A creates a project ---------------------------------------------------
  const projectId = `proj-${suffix}`;
  const created = await api('POST', '/api/projects', { token: accountA.token, body: templateProject(projectId) });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.data.id, projectId);

  // Duplicate ids are a conflict, not a silent overwrite or a 500.
  assert.equal(
    (await api('POST', '/api/projects', { token: accountA.token, body: templateProject(projectId) })).status,
    409,
  );

  // B cannot claim A's id.
  assert.equal(
    (await api('POST', '/api/projects', { token: accountB.token, body: templateProject(projectId) })).status,
    409,
  );

  // --- B cannot read, list, update, or delete A's project --------------------
  const bRead = await api('GET', `/api/projects/${projectId}`, { token: accountB.token });
  assert.equal(bRead.status, 403);
  assert.equal(bRead.body.data, undefined, 'a forbidden response must not include document data');

  const bList = await api('GET', '/api/projects', { token: accountB.token });
  assert.equal(bList.status, 200);
  assert.deepEqual(bList.body, [], 'account B must not see account A projects');

  const bUpdate = await api('PUT', `/api/projects/${projectId}`, {
    token: accountB.token,
    body: templateProject(projectId, { title: 'Overwritten by B', revision: 99 }),
  });
  assert.equal(bUpdate.status, 403);

  assert.equal((await api('DELETE', `/api/projects/${projectId}`, { token: accountB.token })).status, 403);

  const aStillThere = await api('GET', `/api/projects/${projectId}`, { token: accountA.token });
  assert.equal(aStillThere.status, 200);
  assert.equal(aStillThere.body.data.title, 'QA Fixture Carousel', 'A project must be untouched by B');
});


test('older revisions cannot overwrite newer server state', async () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const account = await registerAndVerify(`qa-rev-${suffix}@example.com`, 'QA Revision');
  const projectId = `proj-rev-${suffix}`;

  const created = await api('POST', '/api/projects', { token: account.token, body: templateProject(projectId) });
  assert.equal(created.status, 200, JSON.stringify(created.body));

  const newer = await api('PUT', `/api/projects/${projectId}`, {
    token: account.token,
    body: templateProject(projectId, { title: 'Revision 5', revision: 5 }),
  });
  assert.equal(newer.status, 200, JSON.stringify(newer.body));

  const stale = await api('PUT', `/api/projects/${projectId}`, {
    token: account.token,
    body: templateProject(projectId, { title: 'Revision 2 from a stale tab', revision: 2 }),
  });
  assert.equal(stale.status, 409, 'stale revision must be rejected');
  assert.equal(stale.body.code, 'STALE_REVISION');
  assert.equal(stale.body.serverRevision, 5);

  const winner = await api('GET', `/api/projects/${projectId}`, { token: account.token });
  assert.equal(winner.body.data.title, 'Revision 5');

  // An equal or newer revision is still accepted (last write wins).
  const equal = await api('PUT', `/api/projects/${projectId}`, {
    token: account.token,
    body: templateProject(projectId, { title: 'Revision 5 rewritten', revision: 5 }),
  });
  assert.equal(equal.status, 200);
});

test('project payloads are validated before they reach the database', async () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const account = await registerAndVerify(`qa-val-${suffix}@example.com`, 'QA Validation');
  const projectId = `proj-val-${suffix}`;

  const mismatchedId = await api('PUT', `/api/projects/${projectId}`, {
    token: account.token,
    body: templateProject('different-id', { revision: 1 }),
  });
  assert.equal(mismatchedId.status, 400);

  const noSlides = await api('PUT', `/api/projects/${projectId}`, {
    token: account.token,
    body: templateProject(projectId, { revision: 1, slides: [] }),
  });
  assert.equal(noSlides.status, 400);

  const tooManySlides = await api('PUT', `/api/projects/${projectId}`, {
    token: account.token,
    body: templateProject(projectId, {
      revision: 1,
      slides: Array.from({ length: 51 }, (_, index) => ({ id: `s-${index}`, elements: [], background: '#fff' })),
    }),
  });
  assert.equal(tooManySlides.status, 400);

  const badDimensions = await api('PUT', `/api/projects/${projectId}`, {
    token: account.token,
    body: templateProject(projectId, { revision: 1, dimensions: { width: -1, height: 1080 } }),
  });
  assert.equal(badDimensions.status, 400);

  const missingRevision = await api('PUT', `/api/projects/${projectId}`, {
    token: account.token,
    body: { ...templateProject(projectId), revision: undefined },
  });
  assert.equal(missingRevision.status, 400);

  const unknownRoute = await api('GET', '/api/does-not-exist', { token: account.token });
  assert.equal(unknownRoute.status, 404);
});

test('sessions: current user is resolved from the token, and deletion is owner-only', async () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const account = await registerAndVerify(`qa-session-${suffix}@example.com`, 'QA Session');
  const projectId = `proj-session-${suffix}`;

  await api('POST', '/api/projects', { token: account.token, body: templateProject(projectId) });

  const me = await api('GET', '/auth/me', { token: account.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, account.email);
  assert.equal(me.body.user.password, undefined, 'password hash must never be returned');
  assert.equal(me.body.user.verificationCode, undefined, 'verification code must never be returned');

  assert.equal((await api('DELETE', `/api/projects/${projectId}`, { token: account.token })).status, 200);
  assert.equal((await api('GET', `/api/projects/${projectId}`, { token: account.token })).status, 404);
});

test('CORS rejects unknown origins and accepts the configured one', async () => {
  const allowed = await fetch(`${BASE}/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const rejected = await fetch(`${BASE}/health`, { headers: { Origin: 'https://evil.example.com' } });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
});

