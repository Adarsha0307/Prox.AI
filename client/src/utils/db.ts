import { openDB, type DBSchema } from 'idb';
import type { ProjectDocument } from '../types/schema';

/** An uploaded image kept alongside the projects that reference it. */
export interface StoredAsset {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  createdAt: number;
}

interface CarouselDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectDocument;
  };
  assets: {
    key: string;
    value: StoredAsset;
  };
}

const DB_NAME = 'carousel-editor';
const DB_VERSION = 2;
export const PROJECTS_STORE = 'projects';
export const ASSETS_STORE = 'assets';

export async function initDB() {
  return openDB<CarouselDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE, { keyPath: 'id' });
      }
    },
  });
}

/** Thrown when the browser refuses to store more data (disk full / private mode). */
export class StorageFullError extends Error {
  constructor(message = 'Browser storage is full. Free up space or remove older images.') {
    super(message);
    this.name = 'StorageFullError';
  }
}

/** Thrown when IndexedDB itself is unavailable or blocked. */
export class StorageUnavailableError extends Error {
  constructor(message = 'Local storage is unavailable in this browser context.') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

function isQuotaError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? '';
  const code = (error as { code?: number } | null)?.code;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function saveProject(project: ProjectDocument): Promise<void> {
  try {
    const db = await initDB();
    await db.put(PROJECTS_STORE, project);
  } catch (error) {
    // Never swallow failures: the UI must not show "Saved" when the write failed.
    if (isQuotaError(error)) throw new StorageFullError();
    throw new StorageUnavailableError(
      error instanceof Error ? `Could not write to local storage: ${error.message}` : undefined,
    );
  }
}

export async function loadProject(id: string): Promise<ProjectDocument | undefined> {
  const db = await initDB();
  return db.get(PROJECTS_STORE, id);
}

export async function loadAllProjects(): Promise<ProjectDocument[]> {
  const db = await initDB();
  return db.getAll(PROJECTS_STORE);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await initDB();
  await db.delete(PROJECTS_STORE, id);
}

export async function saveAsset(asset: StoredAsset): Promise<void> {
  try {
    const db = await initDB();
    await db.put(ASSETS_STORE, asset);
  } catch (error) {
    if (isQuotaError(error)) throw new StorageFullError('Not enough browser storage for this image.');
    throw new StorageUnavailableError(
      error instanceof Error ? `Could not store the image: ${error.message}` : undefined,
    );
  }
}

export async function loadAsset(id: string): Promise<StoredAsset | undefined> {
  const db = await initDB();
  return db.get(ASSETS_STORE, id);
}

export async function loadAllAssets(): Promise<StoredAsset[]> {
  const db = await initDB();
  return db.getAll(ASSETS_STORE);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await initDB();
  await db.delete(ASSETS_STORE, id);
}
