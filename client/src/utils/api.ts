/**
 * Single place that knows how to talk to the Prox API, so the base URL comes
 * from configuration (VITE_API_URL) instead of being hard-coded in components.
 */
import { useCredentialStore } from '../store/credentialStore';

export const API_BASE: string = (() => {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured && configured.trim().length > 0) return configured.replace(/\/+$/, '');
  return '';
})();

export interface ApiFailure {
  status: number;
  message: string;
  code?: string;
  /** Set for responses the caller may want to retry (network/5xx). */
  retryable: boolean;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Absolute URL for an API path. Relative paths are expressed against the same
 * origin the client is served from (works for dev via the Vite proxy and for
 * any same-origin deployment without hardcoding a loopback origin).
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {};
  // FormData supplies its own Content-Type (multipart, with boundary).
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  
  if (path.startsWith('/api/generate/')) {
    const openaiKey = useCredentialStore.getState().openaiKey;
    if (openaiKey) {
      headers['X-Provider-Key'] = openaiKey;
    }
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : isFormData ? (options.body as BodyInit) : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    return {
      ok: false,
      error: {
        status: 0,
        message: error instanceof Error ? error.message : 'Network request failed',
        retryable: true,
      },
    };
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const record = (payload ?? {}) as { error?: string; code?: string };
    return {
      ok: false,
      error: {
        status: response.status,
        message: record.error ?? `Request failed with status ${response.status}`,
        code: record.code,
        retryable: response.status >= 500 || response.status === 429,
      },
    };
  }

  return { ok: true, data: payload as T };
}
