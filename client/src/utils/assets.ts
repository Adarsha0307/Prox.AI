import { loadAsset } from './db';
import type { ImageElement, ProjectDocument, Slide } from '../types/schema';

/**
 * Uploaded images live in IndexedDB. Rendered surfaces (canvas, export) need an
 * object URL, which is created on demand and revoked again, so a document never
 * persists a temporary URL.
 */
const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function isExternalImageUrl(src: string | undefined): src is string {
  if (!src) return false;
  return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('/');
}

/** Resolves an asset id to a (cached) object URL, or null when it is missing. */
export async function resolveAssetUrl(assetId: string): Promise<string | null> {
  const cached = urlCache.get(assetId);
  if (cached) return cached;

  const pending = inflight.get(assetId);
  if (pending) return pending;

  const promise = (async (): Promise<string | null> => {
    try {
      const asset = await loadAsset(assetId);
      if (!asset || !asset.blob) return null;
      const url = URL.createObjectURL(asset.blob);
      urlCache.set(assetId, url);
      return url;
    } catch {
      return null;
    } finally {
      inflight.delete(assetId);
    }
  })();

  inflight.set(assetId, promise);
  return promise;
}

export function getCachedAssetUrl(assetId: string): string | null {
  return urlCache.get(assetId) ?? null;
}

export function releaseAssetUrl(assetId: string): void {
  const url = urlCache.get(assetId);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(assetId);
  }
}

export function releaseAllAssetUrls(): void {
  for (const assetId of Array.from(urlCache.keys())) releaseAssetUrl(assetId);
}

/**
 * Returns the URL an image element should render from, or null when the asset
 * is missing (deleted, imported without its assets, or storage cleared).
 */
export async function resolveElementImageSrc(element: ImageElement): Promise<string | null> {
  if (element.assetId) {
    const url = await resolveAssetUrl(element.assetId);
    if (url) return url;
  }
  if (isExternalImageUrl(element.src)) return element.src;
  return null;
}

/** Every asset id referenced by the document (used for backups and cleanup). */
export function collectAssetIds(project: ProjectDocument): string[] {
  const ids = new Set<string>();
  for (const slide of project.slides) {
    collectSlideAssetIds(slide, ids);
  }
  return Array.from(ids);
}

export function collectSlideAssetIds(slide: Slide, into: Set<string> = new Set<string>()): Set<string> {
  for (const element of slide.elements) {
    if (element.type === 'image' && element.assetId) into.add(element.assetId);
  }
  return into;
}

/** Reads the natural pixel size of an image blob without keeping a URL around. */
export function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      URL.revokeObjectURL(url);
      if (!width || !height) {
        reject(new Error('The image has no measurable size.'));
        return;
      }
      resolve({ width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be decoded.'));
    };
    image.src = url;
  });
}
