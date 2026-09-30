import { create } from 'zustand';
import { useCredentialStore } from './credentialStore';
import { apiUrl } from '../utils/api';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  credits: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const TOKEN_STORAGE_KEY = 'auth_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_STORAGE_KEY),
  setUser: (user) => {
    // If user changes (e.g., account change), clear credentials
    const currentUser = get().user;
    if (currentUser && user && currentUser.id !== user.id) {
      useCredentialStore.getState().clearCredentials();
    }
    set({ user });
  },
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
    useCredentialStore.getState().clearCredentials();
    set({ user: null, token: null });
  },
  refreshUser: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user });
      }
    } catch {
      // ignore
    }
  },
}));

/** Reads the session outside of React (used by the cloud sync manager). */
export function readSession(): { token: string | null; userId: number | null } {
  const { token, user } = useAuthStore.getState();
  return { token, userId: user?.id ?? null };
}
