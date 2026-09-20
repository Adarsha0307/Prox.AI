/**
 * Small, dependency-free request validation helpers for the API layer.
 *
 * These functions only validate the *shape* of incoming data. Document-level
 * validation of individual slides/elements lives in the client
 * (client/src/utils/validation.ts) and is enforced structurally here so a
 * malformed payload can never be persisted verbatim.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 80;
export const MAX_PROJECT_ID_LENGTH = 128;
export const MAX_TITLE_LENGTH = 200;
export const MAX_SLIDES = 50;
export const MAX_ELEMENTS_PER_SLIDE = 500;
export const MAX_PROJECT_BYTES = 2 * 1024 * 1024;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

export interface Credentials {
  email: string;
  password: string;
  name: string;
}

export function validateRegisterBody(body: unknown): Result<Credentials> {
  if (!isPlainObject(body)) return fail('Request body must be a JSON object');
  const email = asTrimmedString(body.email, MAX_EMAIL_LENGTH);
  if (!email || !EMAIL_PATTERN.test(email)) return fail('A valid email address is required');
  if (typeof body.password !== 'string') return fail('A password is required');
  if (body.password.length < MIN_PASSWORD_LENGTH) {
    return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (body.password.length > 200) return fail('Password is too long');
  const name = asTrimmedString(body.name, MAX_NAME_LENGTH);
  if (!name) return fail('A name is required');
  return ok({ email: email.toLowerCase(), password: body.password, name });
}

export function validateLoginBody(body: unknown): Result<{ email: string; password: string }> {
  if (!isPlainObject(body)) return fail('Request body must be a JSON object');
  const email = asTrimmedString(body.email, MAX_EMAIL_LENGTH);
  if (!email) return fail('Email and password are required');
  if (typeof body.password !== 'string' || body.password.length === 0) {
    return fail('Email and password are required');
  }
  return ok({ email: email.toLowerCase(), password: body.password });
}

export function validateVerificationBody(body: unknown): Result<{ email: string; code: string }> {
  if (!isPlainObject(body)) return fail('Request body must be a JSON object');
  const email = asTrimmedString(body.email, MAX_EMAIL_LENGTH);
  if (!email) return fail('Email and verification code are required');
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!/^\d{6}$/.test(code)) return fail('Verification code must be 6 digits');
  return ok({ email: email.toLowerCase(), code });
}

export interface ProjectPayload {
  id: string;
  document: unknown;
}

/**
 * Validates that a payload looks like a ProjectDocument we are willing to store.
 * `expectedId` is supplied for PUT requests where the URL/body ids must agree.
 */
export function validateProjectBody(body: unknown, expectedId?: string): Result<ProjectPayload> {
  if (!isPlainObject(body)) return fail('Request body must be a JSON object');

  const id = asTrimmedString(body.id, MAX_PROJECT_ID_LENGTH);
  if (!id) return fail('Project id is required');
  if (expectedId !== undefined && id !== expectedId) {
    return fail('Project id in the body does not match the id in the URL');
  }

  if (typeof body.title !== 'string' || body.title.length > MAX_TITLE_LENGTH) {
    return fail('Project title is required');
  }

  const dimensions = body.dimensions;
  if (!isPlainObject(dimensions) || typeof dimensions.width !== 'number' || typeof dimensions.height !== 'number') {
    return fail('Project dimensions are required');
  }
  if (
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width > 10000 ||
    dimensions.height > 10000
  ) {
    return fail('Project dimensions are out of the supported range');
  }

  if (typeof body.schemaVersion !== 'string' || body.schemaVersion.length > 16) {
    return fail('schemaVersion is required');
  }
  if (typeof body.revision !== 'number' || !Number.isFinite(body.revision) || body.revision < 1) {
    return fail('revision is required');
  }
  if (!Array.isArray(body.slides) || body.slides.length === 0) {
    return fail('A project must contain at least one slide');
  }
  if (body.slides.length > MAX_SLIDES) return fail(`A project may not contain more than ${MAX_SLIDES} slides`);

  for (const slide of body.slides) {
    if (!isPlainObject(slide) || typeof slide.id !== 'string' || !Array.isArray(slide.elements)) {
      return fail('Every slide needs an id and an elements array');
    }
    if (slide.elements.length > MAX_ELEMENTS_PER_SLIDE) {
      return fail(`A slide may not contain more than ${MAX_ELEMENTS_PER_SLIDE} elements`);
    }
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(body);
  } catch {
    return fail('Project payload is not serializable');
  }
  if (serialized.length > MAX_PROJECT_BYTES) return fail('Project payload is too large');

  return ok({ id, document: body });
}

export function readRevision(document: unknown): number | null {
  if (!isPlainObject(document)) return null;
  const revision = document.revision;
  return typeof revision === 'number' && Number.isFinite(revision) ? revision : null;
}
