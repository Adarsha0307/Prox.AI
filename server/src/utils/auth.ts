import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// In a real app, this should be in .env and strictly 32 bytes
const SECRET_KEY = process.env.AUTH_SECRET || 'a-very-secure-32-byte-secret-key!!'; 

// Ensure the key is exactly 32 bytes (256 bits)
const key = crypto.createHash('sha256').update(SECRET_KEY).digest();

export function generateToken(payload: object): string {
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const payloadString = JSON.stringify({
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days expiration
  });

  let encrypted = cipher.update(payloadString, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag().toString('base64');
  
  // Format: iv.encryptedData.authTag
  return `${iv.toString('base64')}.${encrypted}.${authTag}`;
}

export function verifyToken(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const iv = Buffer.from(parts[0], 'base64');
    const encryptedText = parts[1];
    const authTag = Buffer.from(parts[2], 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    const payload = JSON.parse(decrypted);

    if (payload.exp && payload.exp < Date.now()) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (err) {
    return null; // Invalid token
  }
}
