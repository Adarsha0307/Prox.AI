import { loadAsset, saveAsset, loadProject as loadStoredProject } from './db';
import { CURRENT_SCHEMA_VERSION, validateProjectDocument } from './validation';
import { collectAssetIds } from './assets';
import type { ProjectDocument } from '../types/schema';

export interface RestoreResult {
  ok: boolean;
  project?: ProjectDocument;
  warnings: string[];
  errors: string[];
}

interface BackupManifest {
  format?: string;
  formatVersion?: number;
  schemaVersion?: string;
  assets?: { assetId: string; path: string; type?: string; name?: string }[];
}

function newProjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `project-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function missingAssetIds(project: ProjectDocument): Promise<string[]> {
  const referenced = collectAssetIds(project);
  const missing: string[] = [];
  for (const assetId of referenced) {
    const asset = await loadAsset(assetId);
    if (!asset) missing.push(assetId);
  }
  return missing;
}

/**
 * Restores a .prox backup (document + embedded images) or a legacy .json export.
 * The project id is remapped when it would overwrite an existing local project,
 * so importing can never destroy the project that is already open.
 */
export async function restoreProjectBundle(file: File): Promise<RestoreResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

  let rawProject: unknown;
  let manifest: BackupManifest | null = null;

  if (isJson) {
    try {
      rawProject = JSON.parse(await file.text()) as unknown;
    } catch {
      return { ok: false, warnings, errors: ['The JSON file could not be parsed.'] };
    }
    warnings.push('JSON files do not contain images; uploads referenced by this file may be missing.');
  } else {
    let archive;
    try {
      const JSZip = (await import('jszip')).default;
      archive = await JSZip.loadAsync(await file.arrayBuffer());
    } catch {
      return { ok: false, warnings, errors: ['The backup archive could not be opened.'] };
    }

    const projectEntry = archive.file('project.json');
    if (!projectEntry) {
      return { ok: false, warnings, errors: ['The backup does not contain project.json.'] };
    }
    try {
      rawProject = JSON.parse(await projectEntry.async('string')) as unknown;
    } catch {
      return { ok: false, warnings, errors: ['project.json inside the backup is not valid JSON.'] };
    }

    const manifestEntry = archive.file('manifest.json');
    if (manifestEntry) {
      try {
        manifest = JSON.parse(await manifestEntry.async('string')) as BackupManifest;
      } catch {
        warnings.push('The backup manifest could not be read; continuing with the document only.');
      }
    }

    if (manifest?.format && manifest.format !== 'prox-backup') {
      warnings.push(`Unexpected backup format "${manifest.format}".`);
    }

    const assetEntries = manifest?.assets ?? [];
    for (const entry of assetEntries) {
      const zipEntry = archive.file(entry.path);
      if (!zipEntry) {
        warnings.push(`Missing image in the backup: ${entry.name ?? entry.assetId}`);
        continue;
      }
      const buffer = await zipEntry.async('uint8array');
      const blob = new Blob([buffer], { type: entry.type ?? 'image/png' });
      await saveAsset({
        id: entry.assetId,
        blob,
        name: entry.name ?? entry.assetId,
        type: entry.type ?? 'image/png',
        size: blob.size,
        createdAt: Date.now(),
      });
    }
  }

  const validation = validateProjectDocument(rawProject);
  if (!validation.ok) {
    return { ok: false, warnings, errors: validation.errors };
  }
  warnings.push(...validation.warnings);

  const project = validation.project;
  if (project.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    warnings.push(`Backup schema ${project.schemaVersion} was read as ${CURRENT_SCHEMA_VERSION}.`);
  }

  const existing = await loadStoredProject(project.id);
  if (existing) {
    const replacementId = newProjectId();
    warnings.push('A different local project already uses this id; the import was given a new id.');
    project.id = replacementId;
  }

  const missing = await missingAssetIds(project);
  if (missing.length > 0) {
    warnings.push(`${missing.length} image(s) referenced by this project are not available.`);
  }

  return { ok: true, project, warnings, errors };
}
