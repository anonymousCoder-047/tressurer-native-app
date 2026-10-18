import { create } from 'zustand';
import { secureStorage } from '@/services/secureStorage';

const TOKEN_KEY = 'tressurer.jwt';
const USER_KEY = 'tressurer.user';
const WORKSPACE_KEY = 'tressurer.workspace';

export const useAuthStore = create((set) => ({
  token: null,
  user: null,
  workspace: null,
  isHydrated: false,

  // Restore the persisted session on app start. Called once from the root layout.
  hydrate: async () => {
    try {
      const [token, userJson, workspaceJson] = await Promise.all([
        secureStorage.get(TOKEN_KEY),
        secureStorage.get(USER_KEY),
        secureStorage.get(WORKSPACE_KEY),
      ]);
      set({
        token,
        user: userJson ? JSON.parse(userJson) : null,
        workspace: workspaceJson ? JSON.parse(workspaceJson) : null,
        isHydrated: true,
      });
    } catch {
      set({ isHydrated: true });
    }
  },

  // Persist and activate a session after a successful OAuth exchange.
  signIn: async ({ token, user }) => {
    await Promise.all([
      secureStorage.set(TOKEN_KEY, token),
      secureStorage.set(USER_KEY, JSON.stringify(user ?? null)),
    ]);
    set({ token, user: user ?? null });
  },

  // Merge profile edits (e.g. renamed via PATCH /auth/me) into the session.
  setUser: async (user) => {
    set({ user });
    await secureStorage.set(USER_KEY, JSON.stringify(user));
  },

  setWorkspace: async (workspace) => {
    set({ workspace });
    if (workspace) {
      await secureStorage.set(WORKSPACE_KEY, JSON.stringify(workspace));
    } else {
      await secureStorage.remove(WORKSPACE_KEY);
    }
  },

  signOut: async () => {
    set({ token: null, user: null, workspace: null });
    await Promise.all([
      secureStorage.remove(TOKEN_KEY),
      secureStorage.remove(USER_KEY),
      secureStorage.remove(WORKSPACE_KEY),
    ]);
  },
}));
