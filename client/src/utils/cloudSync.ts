import { apiRequest } from './api';
import type { ProjectDocument } from '../types/schema';

export type CloudStateName = 'offline' | 'syncing' | 'synced' | 'error' | 'conflict';

export interface SyncListener {
  onState: (state: CloudStateName, message?: string | null, syncedAt?: number | null) => void;
}

interface PendingSave {
  projectId: string;
  revision: number;
  /** Account that queued the write; pending work never crosses accounts. */
  userId: number;
  document: string;
  attempts: number;
}

const SAVE_DEBOUNCE_MS = 1200;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Debounced, serialized cloud sync.
 *
 * - Only the newest document is kept while a write is in flight, so responses
 *   can never be applied out of order.
 * - A queued write is dropped when the session changes (logout or another
 *   account signing in) so one account's work cannot be uploaded to another.
 * - A 409 conflict marks the project as conflicting instead of overwriting.
 */
export class CloudSyncManager {
  private listener: SyncListener | null = null;
  private token: string | null = null;
  private userId: number | null = null;
  private pending: PendingSave | null = null;
  private inFlight = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private syncedRevisions = new Map<string, number>();

  setListener(listener: SyncListener | null): void {
    this.listener = listener;
  }

  private key(projectId: string, userId: number): string {
    return `${userId}:${projectId}`;
  }

  setSession(token: string | null, userId: number | null): void {
    const changed = this.token !== token || this.userId !== userId;
    this.token = token;
    this.userId = userId;

    if (changed) {
      // Anything queued belongs to the previous session.
      this.pending = null;
      if (this.timer) clearTimeout(this.timer);
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.timer = null;
      this.retryTimer = null;
      this.emit(token ? 'offline' : 'offline');
    }
  }

  markSynced(projectId: string, revision: number, userId?: number): void {
    const owner = userId ?? this.userId;
    if (owner === null) return;
    this.syncedRevisions.set(this.key(projectId, owner), revision);
  }

  isSynced(project: ProjectDocument): boolean {
    if (this.userId === null) return false;
    const last = this.syncedRevisions.get(this.key(project.id, this.userId));
    return last !== undefined && last >= project.revision;
  }

  private emit(state: CloudStateName, message?: string | null, syncedAt?: number | null): void {
    this.listener?.onState(state, message, syncedAt);
  }

  /** Called on every store change; only revisions newer than the last upload are queued. */
  onProjectChanged(project: ProjectDocument): void {
    if (!this.token || this.userId === null) return;
    if (this.isSynced(project)) return;

    this.pending = {
      projectId: project.id,
      revision: project.revision,
      userId: this.userId,
      document: JSON.stringify(project),
      attempts: this.pending?.attempts ?? 0,
    };

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Reads the pending save so the retry path can see work queued during the
   *  in-flight write. A method call is used because TS narrows `this.pending` to
   *  `null` after it is cleared above and then never widens it across the await. */
  private currentPending(): PendingSave | null {
    return this.pending;
  }

  async flush(): Promise<void> {
    if (this.inFlight) return; // a newer save will be picked up afterwards
    const pending = this.pending;
    if (!pending || !this.token) return;

    if (this.userId === null || pending.userId !== this.userId) {
      // Session changed while the write was queued.
      this.pending = null;
      return;
    }

    this.pending = null;
    this.inFlight = true;
    this.emit('syncing');

    const document = JSON.parse(pending.document) as ProjectDocument;
    const token = this.token;

    try {
      const put = await apiRequest(`/api/projects/${pending.projectId}`, {
        method: 'PUT',
        token,
        body: document,
      });

      let result = put;
      if (!put.ok && put.error.status === 404) {
        result = await apiRequest('/api/projects', { method: 'POST', token, body: document });
      }

      if (result.ok) {
        this.markSynced(pending.projectId, pending.revision, pending.userId);
        this.emit('synced', null, Date.now());
      } else if (result.error.status === 409) {
        this.emit('conflict', result.error.message);
      } else if (result.error.retryable && pending.attempts < MAX_ATTEMPTS) {
        const retry: PendingSave = { ...pending, attempts: pending.attempts + 1 };
        // A newer save may have been queued while this write was in flight; keep
        // the newest one.
        const queued = this.currentPending();
        if (queued === null || queued.revision <= retry.revision) this.pending = retry;
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          void this.flush();
        }, RETRY_DELAY_MS * retry.attempts);
        this.emit('error', `Cloud sync failed; retrying (${retry.attempts}/${MAX_ATTEMPTS}).`);
      } else {
        this.emit('error', result.error.message);
      }
    } finally {
      this.inFlight = false;
      if (this.pending && this.pending.userId === this.userId) {
        void this.flush();
      }
    }
  }

  /** Uploads immediately (used when the user asks or a session starts). */
  async saveNow(project: ProjectDocument): Promise<void> {
    if (!this.token) return;
    if (!this.isSynced(project)) this.onProjectChanged(project);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.timer = null;
    this.retryTimer = null;
    this.pending = null;
    this.listener = null;
  }
}

export const cloudSync = new CloudSyncManager();
