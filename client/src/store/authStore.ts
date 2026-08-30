import { create } from "zustand";
import { apiFetch, setAccessToken, type AuthResponse } from "../services/api";
import type { PublicUser } from "../types";

type AuthState = {
  user: PublicUser | null;
  accessToken: string | null;
  bootstrapped: boolean;
  setSession: (accessToken: string, user: PublicUser) => void;
  clearSession: () => void;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  bootstrapped: false,

  setSession: (accessToken, user) => {
    setAccessToken(accessToken);
    set({ accessToken, user });
  },

  clearSession: () => {
    setAccessToken(null);
    set({ accessToken: null, user: null });
  },

  bootstrap: async () => {
    try {
      const refreshed = await apiFetch<AuthResponse>("/api/auth/refresh", {
        method: "POST",
      });
      get().setSession(refreshed.accessToken, refreshed.user);
    } catch {
      get().clearSession();
    } finally {
      set({ bootstrapped: true });
    }
  },

  login: async (email, password) => {
    const data = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    get().setSession(data.accessToken, data.user);
  },

  register: async (name, email, password) => {
    const data = await apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    get().setSession(data.accessToken, data.user);
  },

  googleLogin: async (idToken) => {
    const data = await apiFetch<AuthResponse>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    get().setSession(data.accessToken, data.user);
  },

  logout: async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network logout failures
    }
    get().clearSession();
  },
}));
