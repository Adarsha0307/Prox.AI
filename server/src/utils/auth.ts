import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function resolveSecret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.trim().length > 0) return configured;

  if (process.env.NODE_ENV === 'production') {
    // Refusing to start is safer than silently signing tokens with a public default.
    throw new Error('AUTH_SECRET must be set when NODE_ENV=production');
  }

  console.warn(
    '[auth] AUTH_SECRET is not set - generating an ephemeral development secret. ' +
      'Existing tokens are invalidated whenever the server restarts. ' +
      'Set AUTH_SECRET in server/.env (see .env.example).',
  );
  return crypto.randomBytes(32).toString('hex');
}

const SECRET_KEY = resolveSecret();

// Ensure the key is exactly 32 bytes (256 bits)
const key = crypto.createHash('sha256').update(SECRET_KEY).digest();

export interface TokenPayload {
  id: number;
  email: string;
  exp: number;
}

export function generateToken(payload: { id: number; email: string }): string {
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const payloadString = JSON.stringify({
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  let encrypted = cipher.update(payloadString, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag().toString('base64');

  // Format: iv.encryptedData.authTag
  return `${iv.toString('base64')}.${encrypted}.${authTag}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const ivPart = parts[0];
    const encryptedText = parts[1];
    const authTagPart = parts[2];
    if (ivPart === undefined || encryptedText === undefined || authTagPart === undefined) {
      throw new Error('Invalid token format');
    }

    const iv = Buffer.from(ivPart, 'base64');
    const authTag = Buffer.from(authTagPart, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    const parsed: unknown = JSON.parse(decrypted);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid token payload');

    const { id, email, exp } = parsed as Partial<TokenPayload>;
    if (typeof id !== 'number' || !Number.isInteger(id)) throw new Error('Invalid token subject');
    if (typeof email !== 'string') throw new Error('Invalid token subject');
    if (typeof exp !== 'number' || exp < Date.now()) throw new Error('Token expired');

    return { id, email, exp };
  } catch {
    return null; // Invalid, tampered with, or expired token
  }
}
