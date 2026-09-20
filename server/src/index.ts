import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { projects, users } from './schema';
import { generateToken, verifyToken, type TokenPayload } from './utils/auth';
import {
  readRevision,
  validateLoginBody,
  validateProjectBody,
  validateRegisterBody,
  validateVerificationBody,
} from './utils/validate';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// --- CORS -------------------------------------------------------------------
// Bearer tokens are used (no cookies), so requests are not CSRF-prone, but a
// wildcard origin still lets any site read responses if a token leaks.
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header => curl, same-origin, or a server-to-server call.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '2mb' }));

// --- Rate limiting ----------------------------------------------------------
// Small in-memory limiter for the sensitive auth endpoints. It is per-process
// (adequate for the single-instance deployment this project targets) and exists
// to slow down credential stuffing and verification-code brute forcing.
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

function rateLimit(options: { name: string; max: number; windowMs: number }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${options.name}:${req.ip ?? 'unknown'}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    return next();
  };
}

const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000);
pruneTimer.unref();

// --- Auth middleware --------------------------------------------------------
interface AuthRequest extends express.Request {
  user?: TokenPayload;
}

const authenticate = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = payload;
  return next();
};

const requireUserId = (req: AuthRequest): number => {
  const userId = req.user?.id;
  if (typeof userId !== 'number') {
    // authenticate() guarantees this, so reaching here is a programming error.
    throw new Error('Authenticated request is missing a user id');
  }
  return userId;
};

function internalError(res: express.Response, err: unknown) {
  // Log the detail server-side but never return internals to the client.
  console.error('[api] unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

function logMockVerificationEmail(email: string, code: string) {
  if (isProduction) return; // never write codes to production logs
  console.log(`[MOCK EMAIL] To: ${email} | Your verification code is: ${code}`);
}

// --- AUTH ROUTES ------------------------------------------------------------

app.post(
  '/auth/register',
  rateLimit({ name: 'register', max: 10, windowMs: 60 * 60 * 1000 }),
  async (req, res) => {
    const parsed = validateRegisterBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const { email, password, name } = parsed.value;

    try {
      const existingUser = db.select().from(users).where(eq(users.email, email)).get();

      if (existingUser) {
        if (!existingUser.isVerified) {
          // Re-registration issues a fresh code for the still-unverified account.
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

          db.update(users)
            .set({ verificationCode: code, verificationCodeExpiresAt: expiresAt })
            .where(eq(users.id, existingUser.id))
            .run();

          logMockVerificationEmail(email, code);
          return res.json({ message: 'Verification code resent', requiresVerification: true, email });
        }
        return res.status(400).json({ error: 'Email already in use' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      const result = db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          name,
          isVerified: false,
          verificationCode: code,
          verificationCodeExpiresAt: expiresAt,
        })
        .returning({ id: users.id, email: users.email, name: users.name })
        .get();

      logMockVerificationEmail(email, code);

      return res.json({
        message: 'Registration successful, please verify email',
        requiresVerification: true,
        email: result.email,
      });
    } catch (err) {
      return internalError(res, err);
    }
  },
);

app.post(
  '/auth/login',
  rateLimit({ name: 'login', max: 20, windowMs: 15 * 60 * 1000 }),
  async (req, res) => {
    const parsed = validateLoginBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const { email, password } = parsed.value;

    try {
      const user = db.select().from(users).where(eq(users.email, email)).get();
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      if (!user.isVerified) {
        return res
          .status(403)
          .json({ error: 'Please verify your email address first', requiresVerification: true, email: user.email });
      }

      const token = generateToken({ id: user.id, email: user.email });

      return res.json({
        user: { id: user.id, email: user.email, name: user.name },
        token,
      });
    } catch (err) {
      return internalError(res, err);
    }
  },
);

app.post(
  '/auth/verify-email',
  rateLimit({ name: 'verify', max: 20, windowMs: 15 * 60 * 1000 }),
  async (req, res) => {
    const parsed = validateVerificationBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const { email, code } = parsed.value;

    try {
      const user = db.select().from(users).where(eq(users.email, email)).get();
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      if (user.isVerified) {
        return res.status(400).json({ error: 'Email already verified' });
      }

      if (user.verificationCode !== code) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      if (!user.verificationCodeExpiresAt || new Date() > new Date(user.verificationCodeExpiresAt)) {
        return res
          .status(400)
          .json({ error: 'Verification code has expired. Please register again to get a new code.' });
      }

      // Mark as verified and clear the code
      const updatedUser = db
        .update(users)
        .set({ isVerified: true, verificationCode: null, verificationCodeExpiresAt: null })
        .where(eq(users.id, user.id))
        .returning({ id: users.id, email: users.email, name: users.name })
        .get();

      const token = generateToken({ id: updatedUser.id, email: updatedUser.email });

      return res.json({
        message: 'Email verified successfully',
        user: updatedUser,
        token,
      });
    } catch (err) {
      return internalError(res, err);
    }
  },
);

app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const userId = requireUserId(req as AuthRequest);
    const user = db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ user });
  } catch (err) {
    return internalError(res, err);
  }
});


// --- PROJECT ROUTES ---------------------------------------------------------

interface StoredProjectRow {
  id: string;
  userId: number;
  data: string;
  updatedAt: Date | null;
}

function parseStoredDocument(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    console.error('[api] stored project document is not valid JSON');
    return null;
  }
}

/**
 * Owner check shared by the project routes.
 * Returns the row when it exists and belongs to the caller.
 */
function findOwnedProject(projectId: string, userId: number, res: express.Response) {
  const existing = db.select().from(projects).where(eq(projects.id, projectId)).get() as StoredProjectRow | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  if (existing.userId !== userId) {
    // The id is a UUID and never disclosed to other accounts, so this is only
    // reachable if someone shares an id or guesses one.
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return existing;
}

app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const userId = requireUserId(req as AuthRequest);
    const rows = db.select().from(projects).where(eq(projects.userId, userId)).all() as StoredProjectRow[];

    const result: { id: string; updatedAt: Date | null; data: unknown }[] = [];
    for (const row of rows) {
      const document = parseStoredDocument(row.data);
      if (document !== null) result.push({ id: row.id, updatedAt: row.updatedAt, data: document });
    }

    return res.json(result);
  } catch (err) {
    return internalError(res, err);
  }
});

app.get('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const userId = requireUserId(req as AuthRequest);
    const existing = findOwnedProject(req.params.id as string, userId, res);
    if (!existing) return undefined;

    return res.json({ id: existing.id, updatedAt: existing.updatedAt, data: parseStoredDocument(existing.data) });
  } catch (err) {
    return internalError(res, err);
  }
});

app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const userId = requireUserId(req as AuthRequest);
    const parsed = validateProjectBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const { id, document } = parsed.value;

    const existing = db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get();
    if (existing) {
      // Includes the case where the id belongs to another account: no detail is leaked.
      return res.status(409).json({ error: 'Project already exists. Update it instead.' });
    }

    const result = db
      .insert(projects)
      .values({ id, userId, data: JSON.stringify(document) })
      .returning()
      .get() as StoredProjectRow;

    return res.json({ id: result.id, updatedAt: result.updatedAt, data: JSON.parse(result.data) as unknown });
  } catch (err) {
    return internalError(res, err);
  }
});

app.put('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const userId = requireUserId(req as AuthRequest);
    const projectId = req.params.id as string;
    const parsed = validateProjectBody(req.body, projectId);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const existing = findOwnedProject(projectId, userId, res);
    if (!existing) return undefined;

    // Optimistic concurrency: never let an older save silently overwrite a
    // newer revision that another tab or device already persisted.
    const incomingRevision = readRevision(parsed.value.document);
    const storedRevision = readRevision(parseStoredDocument(existing.data));
    if (incomingRevision !== null && storedRevision !== null && incomingRevision < storedRevision) {
      return res.status(409).json({
        error: 'This project has a newer revision on the server. Reload before saving.',
        code: 'STALE_REVISION',
        serverRevision: storedRevision,
      });
    }

    const result = db
      .update(projects)
      .set({ data: JSON.stringify(parsed.value.document), updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning()
      .get() as StoredProjectRow;

    return res.json({ id: result.id, updatedAt: result.updatedAt, data: JSON.parse(result.data) as unknown });
  } catch (err) {
    return internalError(res, err);
  }
});

app.delete('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const userId = requireUserId(req as AuthRequest);
    const projectId = req.params.id as string;

    const existing = findOwnedProject(projectId, userId, res);
    if (!existing) return undefined;

    db.delete(projects).where(eq(projects.id, projectId)).run();
    return res.json({ ok: true, id: projectId });
  } catch (err) {
    return internalError(res, err);
  }
});

// --- Health, fallbacks, and startup ----------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const message = err instanceof Error ? err.message : '';
  if (message.includes('not allowed by CORS')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  return internalError(res, err);
});

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(`[api] allowed origins: ${allowedOrigins.join(', ')}`);
});

