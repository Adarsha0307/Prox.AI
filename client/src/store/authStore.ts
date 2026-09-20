import { create } from 'zustand';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const TOKEN_STORAGE_KEY = 'auth_token';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_STORAGE_KEY),
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    set({ token });
  },
  logout: () => {
    // Clearing both the stored token and the in-memory session is what stops
    // pending cloud writes from being uploaded under another account.
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    set({ user: null, token: null });
  },
}));

/** Reads the session outside of React (used by the cloud sync manager). */
export function readSession(): { token: string | null; userId: number | null } {
  const { token, user } = useAuthStore.getState();
  return { token, userId: user?.id ?? null };
}
