import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Slide } from '../types/schema';

export interface CustomLayout {
  id: string;
  name: string;
  slide: Slide;
}

interface LayoutState {
  customLayouts: CustomLayout[];
  saveLayout: (name: string, slide: Slide) => void;
  deleteLayout: (id: string) => void;
  duplicateLayout: (id: string) => void;
  renameLayout: (id: string, newName: string) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      customLayouts: [],
      
      saveLayout: (name, slide) => {
        set((state) => ({
          customLayouts: [
            ...state.customLayouts,
            { id: crypto.randomUUID(), name, slide: JSON.parse(JSON.stringify(slide)) }
          ]
        }));
      },
      
      deleteLayout: (id) => {
        set((state) => ({
          customLayouts: state.customLayouts.filter(layout => layout.id !== id)
        }));
      },

      duplicateLayout: (id) => {
        const state = get();
        const layout = state.customLayouts.find(l => l.id === id);
        if (!layout) return;
        
        set({
          customLayouts: [
            ...state.customLayouts,
            { id: crypto.randomUUID(), name: `${layout.name} (Copy)`, slide: JSON.parse(JSON.stringify(layout.slide)) }
          ]
        });
      },

      renameLayout: (id, newName) => {
        set((state) => ({
          customLayouts: state.customLayouts.map(layout => 
            layout.id === id ? { ...layout, name: newName } : layout
          )
        }));
      }
    }),
    {
      name: 'prox-custom-layouts'
    }
  )
);
