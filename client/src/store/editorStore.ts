import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectDocument, Slide, SlideElement, ThemeColorKey, ThemeTokens } from '../types/schema';
import {
  CURRENT_SCHEMA_VERSION,
  MAX_SLIDES_CLIENT,
  validateProjectDocument,
  validateSlideElement,
  validateTemplateSlide,
} from '../utils/validation';
import { StorageFullError, saveProject as saveProjectToDb } from '../utils/db';
import { readImageDimensions } from '../utils/assets';

/** Maximum number of undo steps kept in memory. */
export const HISTORY_LIMIT = 60;
const SAVE_DEBOUNCE_MS = 400;
const COMMIT_DEBOUNCE_MS = 500;

export type LocalSaveState = 'idle' | 'saving' | 'saved' | 'error';
export type CloudState = 'offline' | 'syncing' | 'synced' | 'error' | 'conflict';

interface EditorState {
  project: ProjectDocument | null;
  activeSlideId: string | null;
  activeElementIds: string[];
  history: ProjectDocument[];
  historyIndex: number;

  localSaveState: LocalSaveState;
  localSaveError: string | null;
  localSavedAt: number | null;

  cloudState: CloudState;
  cloudError: string | null;
  cloudSyncedAt: number | null;

  statusMessage: string | null;
  setStatusMessage: (message: string | null) => void;

  initProject: () => void;
  loadProject: (project: unknown, source?: 'local' | 'cloud' | 'import') => { ok: boolean; errors?: string[] };

  addSlide: () => void;
  duplicateSlide: (slideId: string) => void;
  deleteSlide: (slideId: string) => void;
  reorderSlides: (startIndex: number, endIndex: number) => void;
  setActiveSlide: (slideId: string) => void;
  applyTemplateToSlide: (templateSlide: Slide) => void;
  updateSlideBackground: (slideId: string, background: string) => void;

  updateTheme: (updates: Partial<ThemeTokens>) => void;

  addElement: (element: SlideElement) => void;
  addImageFromFile: (file: File) => Promise<{ ok: boolean; error?: string }>;
  updateElement: (
    elementId: string,
    updates: Partial<SlideElement>,
    options?: { commit?: 'immediate' | 'debounced' | 'none' },
  ) => void;
  deleteElement: (elementId: string) => void;
  moveElementLayer: (elementId: string, direction: 'up' | 'down' | 'front' | 'back') => void;
  setActiveElements: (elementIds: string[]) => void;

  undo: () => void;
  redo: () => void;
  commitHistory: () => void;
  commitSoon: () => void;

  persistNow: () => Promise<void>;
  setCloudState: (state: CloudState, message?: string | null, syncedAt?: number | null) => void;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createEmptySlide = (): Slide => ({
  id: uuidv4(),
  elements: [],
  background: '#ffffff',
});

export const createEmptyProject = (): ProjectDocument => ({
  id: uuidv4(),
  title: 'Untitled Carousel',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  dimensions: { width: 1080, height: 1080 },
  revision: 1,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  theme: {
    colors: {
      primary: '#000000',
      secondary: '#666666',
      background: '#ffffff',
      text: '#000000',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  slides: [createEmptySlide()],
});

/** Keeps the active slide and selection pointing at ids that still exist. */
function reconcileSelection(project: ProjectDocument, activeSlideId: string | null, activeElementIds: string[]) {
  const slides = project.slides;
  const slideExists = activeSlideId !== null && slides.some((slide) => slide.id === activeSlideId);
  const nextSlideId = slideExists ? activeSlideId : (slides[0]?.id ?? null);
  const slide = slides.find((candidate) => candidate.id === nextSlideId);
  const elementIds = slide ? slide.elements.map((element) => element.id) : [];
  return {
    activeSlideId: nextSlideId,
    activeElementIds: activeElementIds.filter((id) => elementIds.includes(id)),
  };
}

function resolveThemeColor(theme: ThemeTokens, key: ThemeColorKey | undefined): string | null {
  if (!key) return null;
  const colors = theme.colors as Record<string, string>;
  return colors[key] ?? null;
}

/** Applies theme colours to every element that opted into inheritance. */
function applyThemeInheritance(project: ProjectDocument): ProjectDocument {
  const slides = project.slides.map((slide) => ({
    ...slide,
    elements: slide.elements.map((element) => {
      if (element.type === 'text' || element.type === 'rectangle' || element.type === 'circle' || element.type === 'line') {
        const inherited = resolveThemeColor(project.theme, element.themeColorKey);
        if (inherited && inherited !== element.fill) {
          return { ...element, fill: inherited } as SlideElement;
        }
      }
      return element;
    }),
  }));
  return { ...project, slides };
}

let commitTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastPersistedProject: ProjectDocument | null = null;

export const useEditorStore = create<EditorState>((set, get) => {
  const schedulePersist = () => {
    set({ localSaveState: 'saving', localSaveError: null });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void get().persistNow();
    }, SAVE_DEBOUNCE_MS);
  };

  const flushPendingCommit = () => {
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
      get().commitHistory();
    }
  };

  /** Applies a document mutation and validates the derived selection state. */
  const withProject = (mutate: (project: ProjectDocument) => ProjectDocument | null) => {
    set((state) => {
      if (!state.project) return state;
      const next = mutate(clone(state.project));
      if (!next) return state;
      const selection = reconcileSelection(next, state.activeSlideId, state.activeElementIds);
      return { project: next, ...selection };
    });
  };

  const commit = (mode: 'immediate' | 'debounced' = 'immediate') => {
    if (mode === 'immediate') {
      flushPendingCommit();
      get().commitHistory();
      return;
    }
    schedulePersist();
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      commitTimer = null;
      get().commitHistory();
    }, COMMIT_DEBOUNCE_MS);
  };

  return {
    project: null,
    activeSlideId: null,
    activeElementIds: [],
    history: [],
    historyIndex: -1,
    localSaveState: 'idle',
    localSaveError: null,
    localSavedAt: null,
    cloudState: 'offline',
    cloudError: null,
    cloudSyncedAt: null,
    statusMessage: null,

    setStatusMessage: (statusMessage) => set({ statusMessage }),

    setCloudState: (cloudState, cloudError = null, syncedAt) =>
      set((state) => ({
        cloudState,
        cloudError,
        cloudSyncedAt: syncedAt !== undefined ? syncedAt : state.cloudSyncedAt,
      })),

    initProject: () => {
      const project = createEmptyProject();
      set({
        project,
        activeSlideId: project.slides[0]?.id ?? null,
        activeElementIds: [],
        history: [clone(project)],
        historyIndex: 0,
        statusMessage: null,
      });
      schedulePersist();
    },

    loadProject: (input, source = 'local') => {
      const result = validateProjectDocument(clone(input));
      if (!result.ok) {
        const message = result.errors[0] ?? 'Unknown error';
        set({ statusMessage: `Could not open the project: ${message}` });
        return { ok: false, errors: result.errors };
      }

      const project = result.project;
      lastPersistedProject = null;
      set({
        project,
        activeSlideId: project.slides[0]?.id ?? null,
        activeElementIds: [],
        history: [clone(project)],
        historyIndex: 0,
        statusMessage: result.warnings.length > 0 ? result.warnings[0] : null,
        cloudState: source === 'cloud' ? 'synced' : get().cloudState,
      });
      schedulePersist();
      return { ok: true, errors: [] };
    },

    setActiveSlide: (slideId) => {
      set((state) => {
        if (!state.project || !state.project.slides.some((slide) => slide.id === slideId)) return state;
        return { activeSlideId: slideId, activeElementIds: [] };
      });
    },


    addSlide: () => {
      const state = get();
      if (!state.project) return;
      if (state.project.slides.length >= MAX_SLIDES_CLIENT) {
        set({ statusMessage: `A carousel can hold up to ${MAX_SLIDES_CLIENT} slides in the editor.` });
        return;
      }
      const newSlide = createEmptySlide();
      withProject((project) => ({ ...project, slides: [...project.slides, newSlide] }));
      set({ activeSlideId: newSlide.id, activeElementIds: [] });
      commit('immediate');
    },

    duplicateSlide: (slideId) => {
      const state = get();
      const slide = state.project?.slides.find((candidate) => candidate.id === slideId);
      if (!slide) return;
      if ((state.project?.slides.length ?? 0) >= MAX_SLIDES_CLIENT) {
        set({ statusMessage: `A carousel can hold up to ${MAX_SLIDES_CLIENT} slides in the editor.` });
        return;
      }

      const copy = clone(slide);
      copy.id = uuidv4();
      copy.elements = copy.elements.map((element) => ({ ...element, id: uuidv4() }));

      withProject((project) => {
        const index = project.slides.findIndex((candidate) => candidate.id === slideId);
        const slides = [...project.slides];
        slides.splice(index + 1, 0, copy);
        return { ...project, slides };
      });
      set({ activeSlideId: copy.id, activeElementIds: [] });
      commit('immediate');
    },

    deleteSlide: (slideId) => {
      const state = get();
      if (!state.project) return;
      if (state.project.slides.length <= 1) {
        set({ statusMessage: 'A carousel needs at least one slide.' });
        return;
      }
      const index = state.project.slides.findIndex((slide) => slide.id === slideId);
      if (index === -1) return;

      withProject((project) => ({ ...project, slides: project.slides.filter((slide) => slide.id !== slideId) }));

      if (state.activeSlideId === slideId) {
        const remaining = state.project.slides.filter((slide) => slide.id !== slideId);
        const nextActive = remaining[Math.max(0, index - 1)] ?? remaining[0];
        set({ activeSlideId: nextActive?.id ?? null, activeElementIds: [] });
      }
      commit('immediate');
    },

    reorderSlides: (startIndex, endIndex) => {
      const state = get();
      if (!state.project) return;
      const slides = state.project.slides;
      if (
        startIndex < 0 ||
        endIndex < 0 ||
        startIndex >= slides.length ||
        endIndex >= slides.length ||
        startIndex === endIndex
      ) {
        return;
      }

      withProject((project) => {
        const reordered = [...project.slides];
        const [moved] = reordered.splice(startIndex, 1);
        if (!moved) return null;
        reordered.splice(endIndex, 0, moved);
        return { ...project, slides: reordered };
      });
      commit('immediate');
    },

    applyTemplateToSlide: (templateSlide) => {
      const validation = validateTemplateSlide(clone(templateSlide));
      if (!validation.ok) {
        set({ statusMessage: `Template skipped: ${validation.errors[0]}` });
        return;
      }

      const state = get();
      const targetId = state.activeSlideId;
      if (!state.project || !targetId) return;
      const replacedElements = state.project.slides.find((slide) => slide.id === targetId)?.elements.length ?? 0;

      withProject((project) => ({
        ...project,
        slides: project.slides.map((slide) =>
          slide.id === targetId
            ? {
                ...slide,
                background: validation.slide.background,
                elements: validation.slide.elements.map((element) => ({ ...element, id: uuidv4() })),
              }
            : slide,
        ),
      }));
      set({
        activeElementIds: [],
        statusMessage:
          replacedElements > 0
            ? 'Template applied and replaced the previous slide content. Use Undo to restore it.'
            : null,
      });
      commit('immediate');
    },

    updateSlideBackground: (slideId, background) => {
      withProject((project) => ({
        ...project,
        slides: project.slides.map((slide) => (slide.id === slideId ? { ...slide, background } : slide)),
      }));
      commit('debounced');
    },

    updateTheme: (updates) => {
      withProject((project) => {
        const theme: ThemeTokens = {
          ...project.theme,
          ...updates,
          colors: { ...project.theme.colors, ...(updates.colors ?? {}) },
          fonts: { ...project.theme.fonts, ...(updates.fonts ?? {}) },
          brand: updates.brand !== undefined ? { ...project.theme.brand, ...updates.brand } : project.theme.brand,
        };
        return applyThemeInheritance({ ...project, theme });
      });
      commit('debounced');
    },


    addElement: (element) => {
      const state = get();
      if (!state.project || !state.activeSlideId) return;
      const validation = validateSlideElement(element);
      if (!validation.ok) {
        set({ statusMessage: `Element not added: ${validation.errors[0]}` });
        return;
      }

      const slideId = state.activeSlideId;
      withProject((project) => ({
        ...project,
        slides: project.slides.map((slide) =>
          slide.id === slideId ? { ...slide, elements: [...slide.elements, element] } : slide,
        ),
      }));
      set({ activeElementIds: [element.id] });
      commit('immediate');
    },

    addImageFromFile: async (file) => {
      const state = get();
      if (!state.project) return { ok: false, error: 'No project is open.' };
      if (!file.type.startsWith('image/')) return { ok: false, error: 'Only image files can be added.' };

      const MAX_ASSET_BYTES = 8 * 1024 * 1024;
      if (file.size > MAX_ASSET_BYTES) {
        return { ok: false, error: 'Images larger than 8 MB cannot be stored locally.' };
      }

      try {
        const dimensions = await readImageDimensions(file);
        const assetId = uuidv4();
        const { saveAsset } = await import('../utils/db');
        await saveAsset({
          id: assetId,
          blob: file,
          name: file.name || 'uploaded-image',
          type: file.type,
          size: file.size,
          createdAt: Date.now(),
        });

        const canvas = state.project.dimensions;
        const maxWidth = canvas.width * 0.8;
        const maxHeight = canvas.height * 0.8;
        const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height, 1);
        const width = Math.max(16, Math.round(dimensions.width * scale));
        const height = Math.max(16, Math.round(dimensions.height * scale));

        get().addElement({
          id: uuidv4(),
          type: 'image',
          role: 'image',
          assetId,
          fit: 'cover',
          left: Math.round((canvas.width - width) / 2),
          top: Math.round((canvas.height - height) / 2),
          width,
          height,
          rotation: 0,
          opacity: 1,
          locked: false,
        });
        return { ok: true };
      } catch (error) {
        const message =
          error instanceof StorageFullError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'The image could not be added.';
        set({ statusMessage: message });
        return { ok: false, error: message };
      }
    },

    updateElement: (elementId, updates, options) => {
      const mode = options?.commit ?? 'debounced';
      const state = get();
      if (!state.project || !state.activeSlideId) return;
      const slideId = state.activeSlideId;

      withProject((project) => ({
        ...project,
        slides: project.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          return {
            ...slide,
            elements: slide.elements.map((element) => {
              if (element.id !== elementId) return element;
              const next = { ...element, ...updates } as SlideElement;
              // Editing a colour directly makes it a local override, so later
              // theme changes do not silently overwrite the author's choice.
              if ('fill' in updates && !('themeColorKey' in updates) && 'themeColorKey' in next) {
                delete (next as { themeColorKey?: ThemeColorKey }).themeColorKey;
              }
              return next;
            }),
          };
        }),
      }));

      if (mode === 'none') {
        schedulePersist();
        return;
      }
      commit(mode);
    },

    deleteElement: (elementId) => {
      const state = get();
      if (!state.project || !state.activeSlideId) return;
      const slideId = state.activeSlideId;

      withProject((project) => ({
        ...project,
        slides: project.slides.map((slide) =>
          slide.id === slideId
            ? { ...slide, elements: slide.elements.filter((element) => element.id !== elementId) }
            : slide,
        ),
      }));
      set({ activeElementIds: state.activeElementIds.filter((id) => id !== elementId) });
      commit('immediate');
    },

    moveElementLayer: (elementId, direction) => {
      const state = get();
      if (!state.project || !state.activeSlideId) return;
      const slideId = state.activeSlideId;

      withProject((project) => ({
        ...project,
        slides: project.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          const index = slide.elements.findIndex((element) => element.id === elementId);
          if (index === -1) return slide;

          const elements = [...slide.elements];
          const [moved] = elements.splice(index, 1);
          if (!moved) return slide;

          const target =
            direction === 'front'
              ? elements.length
              : direction === 'back'
                ? 0
                : direction === 'up'
                  ? Math.min(elements.length, index + 1)
                  : Math.max(0, index - 1);

          elements.splice(target, 0, moved);
          return { ...slide, elements };
        }),
      }));
      commit('immediate');
    },

    setActiveElements: (elementIds) => set({ activeElementIds: elementIds }),


    /**
     * Records the current document as one undo step. The live project *is* the
     * snapshot, so the revision in history always matches what was rendered.
     */
    commitHistory: () => {
      set((state) => {
        if (!state.project) return state;
        const snapshot = clone(state.project);
        snapshot.revision = state.project.revision + 1;
        snapshot.updatedAt = Date.now();

        const history = state.history.slice(0, state.historyIndex + 1);
        history.push(snapshot);
        if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);

        return { project: snapshot, history, historyIndex: history.length - 1, localSaveState: 'saving' };
      });
      schedulePersist();
    },

    commitSoon: () => commit('debounced'),

    undo: () => {
      flushPendingCommit();
      set((state) => {
        if (!state.project || state.historyIndex <= 0) return state;
        const historyIndex = state.historyIndex - 1;
        const snapshot = state.history[historyIndex];
        if (!snapshot) return state;

        // Restored content keeps a monotonically increasing revision so an
        // undo can never be rejected as a stale save by the API.
        const restored = clone(snapshot);
        restored.revision = state.project.revision + 1;
        restored.updatedAt = Date.now();
        const selection = reconcileSelection(restored, state.activeSlideId, state.activeElementIds);
        return { project: restored, historyIndex, ...selection, localSaveState: 'saving' };
      });
      schedulePersist();
    },

    redo: () => {
      flushPendingCommit();
      set((state) => {
        if (!state.project || state.historyIndex >= state.history.length - 1) return state;
        const historyIndex = state.historyIndex + 1;
        const snapshot = state.history[historyIndex];
        if (!snapshot) return state;

        const restored = clone(snapshot);
        restored.revision = state.project.revision + 1;
        restored.updatedAt = Date.now();
        const selection = reconcileSelection(restored, state.activeSlideId, state.activeElementIds);
        return { project: restored, historyIndex, ...selection, localSaveState: 'saving' };
      });
      schedulePersist();
    },

    persistNow: async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      const project = get().project;
      if (!project) return;
      if (lastPersistedProject === project) {
        return;
      }

      try {
        await saveProjectToDb(project);
        lastPersistedProject = project;
        set({ localSaveState: 'saved', localSavedAt: Date.now(), localSaveError: null });
      } catch (error) {
        const message =
          error instanceof StorageFullError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'The project could not be saved locally.';
        // Never report success when the write failed, and keep the in-memory
        // document so the user can retry or export before losing work.
        set({ localSaveState: 'error', localSaveError: message, statusMessage: message });
      }
    },
  };
});

