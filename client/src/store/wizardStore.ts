import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SlideOutline {
  layout: string;
  content: { heading: string; body: string };
  id: string; // Add ID for drag and drop reordering
}

export interface WizardDraft {
  topic: string;
  sourceText: string;
  platform: string;
  numCards: number;
  audience: string;
  objective: string;
  tone: string;
  themeFamily: string;
  outline: SlideOutline[] | null;
  step: 'config' | 'generating' | 'outline';
}

interface WizardStore extends WizardDraft {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  updateDraft: (updates: Partial<WizardDraft>) => void;
  resetWizard: () => void;
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set) => ({
      isOpen: false, // Don't open by default on refresh
      topic: '',
      sourceText: '',
      platform: 'LinkedIn',
      numCards: 5,
      audience: 'Professionals',
      objective: 'Educate',
      tone: 'Professional',
      themeFamily: 'corporate',
      outline: null,
      step: 'config',
      
      setOpen: (isOpen) => set({ isOpen }),
      updateDraft: (updates) => set((state) => ({ ...state, ...updates })),
      resetWizard: () => set({
        topic: '',
        sourceText: '',
        platform: 'LinkedIn',
        numCards: 5,
        audience: 'Professionals',
        objective: 'Educate',
        tone: 'Professional',
        themeFamily: 'corporate',
        outline: null,
        step: 'config'
      }),
    }),
    {
      name: 'prox-wizard-draft',
      partialize: (state) => ({
        topic: state.topic,
        sourceText: state.sourceText,
        platform: state.platform,
        numCards: state.numCards,
        audience: state.audience,
        objective: state.objective,
        tone: state.tone,
        themeFamily: state.themeFamily,
        outline: state.outline,
        step: state.step === 'generating' ? 'config' : state.step, // Revert to config if reloading during generation
      }),
    }
  )
);
