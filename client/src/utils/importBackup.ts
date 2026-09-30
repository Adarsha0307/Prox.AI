/**
 * Restores a project from a `.prox` backup archive.
 *
 * The archive is a ZIP containing:
 *   - manifest.json  — format version, asset list, metadata
 *   - project.json   — the full ProjectDocument
 *   - assets/<id>    — binary asset blobs
 *
 * The importer:
 *   1. Validates the manifest and project JSON.
 *   2. Stores each asset into IndexedDB via saveAsset.
 *   3. Returns the restored ProjectDocument (caller decides how to load it).
 */
import JSZip from 'jszip';
import type { ProjectDocument } from '../types/schema';
import { saveAsset } from './db';
import { BACKUP_FORMAT_VERSION } from './export';

export interface ImportResult {
  project: ProjectDocument;
  assetsRestored: number;
  assetsSkipped: number;
}

interface ManifestAsset {
  assetId: string;
  path: string;
  type: string;
  name: string;
}

interface BackupManifest {
  format: string;
  formatVersion: number;
  schemaVersion: string;
  exportedAt: string;
  projectId: string;
  slideCount: number;
  assets: ManifestAsset[];
}

/**
 * Import a `.prox` backup file and restore the project + assets into IndexedDB.
 * Throws on invalid archives or corrupt data.
 */
export async function importBackup(file: File | Blob): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  // --- Validate manifest ---------------------------------------------------
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid backup: missing manifest.json');
  }
  const manifest: BackupManifest = JSON.parse(await manifestFile.async('string'));

  if (manifest.format !== 'prox-backup') {
    throw new Error(`Unknown backup format: "${manifest.format}". Expected "prox-backup".`);
  }
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Backup format version ${manifest.formatVersion} is newer than this app supports (${BACKUP_FORMAT_VERSION}). Please update the app.`
    );
  }

  // --- Parse project --------------------------------------------------------
  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('Invalid backup: missing project.json');
  }
  const project: ProjectDocument = JSON.parse(await projectFile.async('string'));

  if (!project.id || !Array.isArray(project.slides)) {
    throw new Error('Invalid backup: project.json is malformed (missing id or slides).');
  }

  // Assign a new ID to avoid collisions with an existing project of the same id.
  project.id = crypto.randomUUID();
  project.updatedAt = Date.now();

  // --- Restore assets -------------------------------------------------------
  let assetsRestored = 0;
  let assetsSkipped = 0;

  for (const entry of manifest.assets ?? []) {
    const assetFile = zip.file(entry.path);
    if (!assetFile) {
      assetsSkipped++;
      continue;
    }

    try {
      const arrayBuffer = await assetFile.async('arraybuffer');
      const blob = new Blob([arrayBuffer], { type: entry.type || 'application/octet-stream' });

      await saveAsset({
        id: entry.assetId,
        blob,
        name: entry.name || `restored-${entry.assetId.slice(0, 8)}`,
        type: entry.type || 'application/octet-stream',
        size: blob.size,
        createdAt: Date.now(),
      });

      assetsRestored++;
    } catch {
      assetsSkipped++;
    }
  }

  return { project, assetsRestored, assetsSkipped };
}

/**
 * Import a plain JSON project file (no assets).
 */
export async function importProjectJson(file: File | Blob): Promise<ProjectDocument> {
  const text = await file.text();
  const project: ProjectDocument = JSON.parse(text);

  if (!project.id || !Array.isArray(project.slides)) {
    throw new Error('Invalid project file: missing id or slides.');
  }

  // Assign a new ID to avoid collisions
  project.id = crypto.randomUUID();
  project.updatedAt = Date.now();

  return project;
}
