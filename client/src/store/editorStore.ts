import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectDocument, Slide, SlideElement } from '../types/schema';

interface EditorState {
  project: ProjectDocument | null;
  activeSlideId: string | null;
  activeElementIds: string[];
  history: ProjectDocument[];
  historyIndex: number;
  
  // Actions
  initProject: () => void;
  loadProject: (project: ProjectDocument) => void;
  addSlide: () => void;
  duplicateSlide: (slideId: string) => void;
  deleteSlide: (slideId: string) => void;
  reorderSlides: (startIndex: number, endIndex: number) => void;
  setActiveSlide: (slideId: string) => void;
  applyTemplateToSlide: (templateSlide: Slide) => void;
  
  // Theme/Brand Actions
  updateTheme: (updates: Partial<ProjectDocument['theme']>) => void;
  
  // Element Actions
  addElement: (element: SlideElement) => void;
  updateElement: (elementId: string, updates: Partial<SlideElement>) => void;
  deleteElement: (elementId: string) => void;
  setActiveElements: (elementIds: string[]) => void;

  // History Actions
  undo: () => void;
  redo: () => void;
  commitHistory: () => void;
  
  // Sync Status
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  setSyncStatus: (isSyncing: boolean, lastSyncedAt?: Date | null) => void;
}

const createEmptySlide = (): Slide => ({
  id: uuidv4(),
  elements: [],
  background: '#ffffff'
});

const createEmptyProject = (): ProjectDocument => {
  const initialSlide = createEmptySlide();
  return {
    id: uuidv4(),
    title: 'Untitled Carousel',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dimensions: { width: 1080, height: 1080 },
    revision: 1,
    schemaVersion: '1.0',
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
      }
    },
    slides: [initialSlide]
  };
};

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  activeSlideId: null,
  activeElementIds: [],
  history: [],
  historyIndex: -1,
  isSyncing: false,
  lastSyncedAt: null,

  setSyncStatus: (isSyncing, lastSyncedAt) => set((state) => ({ 
    isSyncing, 
    lastSyncedAt: lastSyncedAt !== undefined ? lastSyncedAt : state.lastSyncedAt 
  })),

  initProject: () => {
    const project = createEmptyProject();
    set({
      project,
      activeSlideId: project.slides[0].id,
      history: [project],
      historyIndex: 0,
    });
  },

  loadProject: (project) => {
    set({
      project,
      activeSlideId: project.slides[0]?.id || null,
      history: [project],
      historyIndex: 0,
    });
  },

  setActiveSlide: (slideId) => set({ activeSlideId: slideId, activeElementIds: [] }),
  setActiveElements: (elementIds) => set({ activeElementIds: elementIds }),

  commitHistory: () => {
    set((state) => {
      if (!state.project) return state;
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(state.project)));
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
        project: { ...state.project, updatedAt: Date.now(), revision: state.project.revision + 1 }
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        return {
          historyIndex: newIndex,
          project: JSON.parse(JSON.stringify(state.history[newIndex]))
        };
      }
      return state;
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        return {
          historyIndex: newIndex,
          project: JSON.parse(JSON.stringify(state.history[newIndex]))
        };
      }
      return state;
    });
  },

  addSlide: () => {
    set((state) => {
      if (!state.project) return state;
      const newSlide = createEmptySlide();
      return {
        project: {
          ...state.project,
          slides: [...state.project.slides, newSlide]
        },
        activeSlideId: newSlide.id
      };
    });
    get().commitHistory();
  },

  applyTemplateToSlide: (templateSlide) => {
    set((state) => {
      if (!state.project || !state.activeSlideId) return state;
      const slides = state.project.slides.map(slide => {
        if (slide.id === state.activeSlideId) {
          // Keep the current slide ID but adopt the template's background and clone its elements
          return {
            ...slide,
            background: templateSlide.background,
            elements: templateSlide.elements.map(el => ({ ...el, id: uuidv4() }))
          };
        }
        return slide;
      });
      return { project: { ...state.project, slides } };
    });
    get().commitHistory();
  },

  duplicateSlide: (slideId) => {
    set((state) => {
      if (!state.project) return state;
      const slideToCopy = state.project.slides.find(s => s.id === slideId);
      if (!slideToCopy) return state;
      
      const newSlide = JSON.parse(JSON.stringify(slideToCopy));
      newSlide.id = uuidv4();
      // Also need to gen new IDs for elements
      newSlide.elements = newSlide.elements.map((el: any) => ({ ...el, id: uuidv4() }));
      
      const index = state.project.slides.findIndex(s => s.id === slideId);
      const newSlides = [...state.project.slides];
      newSlides.splice(index + 1, 0, newSlide);

      return {
        project: { ...state.project, slides: newSlides },
        activeSlideId: newSlide.id
      };
    });
    get().commitHistory();
  },

  deleteSlide: (slideId) => {
    set((state) => {
      if (!state.project || state.project.slides.length <= 1) return state;
      const newSlides = state.project.slides.filter(s => s.id !== slideId);
      const newActiveId = state.activeSlideId === slideId ? newSlides[0].id : state.activeSlideId;
      return {
        project: { ...state.project, slides: newSlides },
        activeSlideId: newActiveId
      };
    });
    get().commitHistory();
  },

  reorderSlides: (startIndex, endIndex) => {
    set((state) => {
      if (!state.project) return state;
      const newSlides = Array.from(state.project.slides);
      const [removed] = newSlides.splice(startIndex, 1);
      newSlides.splice(endIndex, 0, removed);
      return {
        project: { ...state.project, slides: newSlides }
      };
    });
    get().commitHistory();
  },

  updateTheme: (updates) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          theme: {
            ...state.project.theme,
            ...updates
          }
        }
      };
    });
    get().commitHistory();
  },

  addElement: (element) => {
    set((state) => {
      if (!state.project || !state.activeSlideId) return state;
      const slides = state.project.slides.map(slide => {
        if (slide.id === state.activeSlideId) {
          return { ...slide, elements: [...slide.elements, element] };
        }
        return slide;
      });
      return { project: { ...state.project, slides } };
    });
    get().commitHistory();
  },

  updateElement: (elementId, updates) => {
    set((state) => {
      if (!state.project || !state.activeSlideId) return state;
      const slides = state.project.slides.map(slide => {
        if (slide.id === state.activeSlideId) {
          return {
            ...slide,
            elements: slide.elements.map(el => el.id === elementId ? ({ ...el, ...updates } as SlideElement) : el)
          };
        }
        return slide;
      });
      return { project: { ...state.project, slides } };
    });
  },

  deleteElement: (elementId) => {
    set((state) => {
      if (!state.project || !state.activeSlideId) return state;
      const slides = state.project.slides.map(slide => {
        if (slide.id === state.activeSlideId) {
          return {
            ...slide,
            elements: slide.elements.filter(el => el.id !== elementId)
          };
        }
        return slide;
      });
      return { 
        project: { ...state.project, slides },
        activeElementIds: state.activeElementIds.filter(id => id !== elementId)
      };
    });
    get().commitHistory();
  }
}));
