import { create } from 'zustand';

interface CredentialState {
  openaiKey: string | null;
  anthropicKey: string | null;
  setOpenAiKey: (key: string | null) => void;
  setAnthropicKey: (key: string | null) => void;
  clearCredentials: () => void;
}

/**
 * STRICTLY NON-PERSISTED STORE.
 * API keys are kept in memory only and will be lost on page reload.
 * This ensures keys are never saved in localStorage, project documents, or logs.
 */
export const useCredentialStore = create<CredentialState>((set) => ({
  openaiKey: null,
  anthropicKey: null,
  
  setOpenAiKey: (key) => set({ openaiKey: key }),
  setAnthropicKey: (key) => set({ anthropicKey: key }),
  
  clearCredentials: () => set({
    openaiKey: null,
    anthropicKey: null
  })
}));
