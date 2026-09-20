import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useAuthStore } from '../store/authStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { cloudSync } from '../utils/cloudSync';
import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { SlideStrip } from './SlideStrip';
import { CanvasArea } from './CanvasArea';
import { MobilePropertySheet } from './MobilePropertySheet';

const SYNC_CHANNEL = 'carousel_editor_sync';

export const CarouselEditor: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const statusMessage = useEditorStore((state) => state.statusMessage);
  const localSaveError = useEditorStore((state) => state.localSaveError);
  const cloudError = useEditorStore((state) => state.cloudError);

  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const hadSessionRef = useRef(false);

  useKeyboardShortcuts();

  // --- Boot: restore the most recent valid project, never crash on bad data --
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const store = useEditorStore.getState();
      try {
        const { loadAllProjects } = await import('../utils/db');
        const stored = await loadAllProjects();
        if (cancelled) return;

        const ordered = [...stored].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        for (const candidate of ordered) {
          const result = store.loadProject(candidate, 'local');
          if (result.ok) {
            setIsLoading(false);
            return;
          }
          setBanner(`A stored project could not be opened (${result.errors?.[0] ?? 'invalid data'}).`);
        }
        store.initProject();
      } catch (error) {
        // IndexedDB unavailable (private mode, blocked storage): keep working in memory.
        console.error('[boot] local storage is unavailable', error);
        setBanner('Local storage is unavailable, so this session will not be saved automatically.');
        store.initProject();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Persist every document change locally + notify other tabs ------------
  useEffect(() => {
    let lastBroadcastRevision = -1;
    let lastProject: unknown = null;
    let channel: BroadcastChannel | null = null;

    const unsubscribe = useEditorStore.subscribe((state) => {
      const current = state.project;
      if (!current || current === lastProject) return;
      lastProject = current;

      // Local persistence is debounced inside the store (see schedulePersist).
      if (current.revision !== lastBroadcastRevision) {
        lastBroadcastRevision = current.revision;
        channel?.postMessage({ type: 'PROJECT_UPDATED', projectId: current.id, revision: current.revision });
      }

      cloudSync.onProjectChanged(current);
    });

    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; projectId?: string; revision?: number } | undefined;
        if (data?.type !== 'PROJECT_UPDATED') return;
        const state = useEditorStore.getState();
        if (!state.project || state.project.id !== data.projectId) return;
        if (typeof data.revision === 'number' && state.project.revision < data.revision) {
          setBanner('This project was changed in another tab. Reload before saving to avoid overwriting those changes.');
        }
      };
    }

    return () => {
      unsubscribe();
      channel?.close();
    };
  }, []);

  // --- Cloud session wiring --------------------------------------------------
  useEffect(() => {
    cloudSync.setListener({
      onState: (cloudState, message) => {
        useEditorStore
          .getState()
          .setCloudState(cloudState, message ?? null, cloudState === 'synced' ? Date.now() : undefined);
      },
    });

    return () => {
      cloudSync.setListener(null);
      cloudSync.dispose();
    };
  }, []);

  useEffect(() => {
    cloudSync.setSession(token, user?.id ?? null);

    if (token && user) {
      const current = useEditorStore.getState().project;
      if (current && !cloudSync.isSynced(current)) {
        // Explicit local -> cloud migration for the project that is open.
        void cloudSync.saveNow(current);
        setBanner(`Signed in as ${user.email}. This project is being uploaded to your account.`);
      }
      hadSessionRef.current = true;
    } else if (hadSessionRef.current) {
      hadSessionRef.current = false;
      setBanner(null);
    }
  }, [token, user]);

  if (isLoading || !project) {
    return <div className="flex h-screen bg-neutral-900 items-center justify-center text-white">Loading Editor...</div>;
  }

  const message = localSaveError ?? cloudError ?? statusMessage ?? banner;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans overflow-hidden">
      <TopBar />

      {message && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-2 text-sm bg-amber-900/40 border-b border-amber-800 text-amber-100"
        >
          <span>{message}</span>
          <button
            type="button"
            className="shrink-0 underline hover:text-white"
            onClick={() => {
              setBanner(null);
              const store = useEditorStore.getState();
              store.setStatusMessage(null);
              store.setCloudState(store.cloudState, null);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <LeftPanel />
        <CanvasArea />
        <RightPanel />
        <MobilePropertySheet />
      </div>

      <SlideStrip />
    </div>
  );
};

