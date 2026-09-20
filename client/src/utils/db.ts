import { openDB, type DBSchema } from 'idb';
import type { ProjectDocument } from '../types/schema';

interface CarouselDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectDocument;
  };
}

const DB_NAME = 'carousel-editor';
const STORE_NAME = 'projects';

export async function initDB() {
  return openDB<CarouselDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function saveProject(project: ProjectDocument) {
  try {
    const db = await initDB();
    await db.put(STORE_NAME, project);
  } catch (e: any) {
    if (e.name === 'QuotaExceededError') {
      console.error('Storage quota exceeded. Cannot save project.', e);
      // In a real app we'd dispatch an error event to the UI here
    } else {
      throw e;
    }
  }
}

export async function loadProject(id: string): Promise<ProjectDocument | undefined> {
  const db = await initDB();
  return db.get(STORE_NAME, id);
}

export async function loadAllProjects(): Promise<ProjectDocument[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}
