import { create } from 'zustand';
import { secureStorage } from '@/services/secureStorage';

const TOKEN_KEY = 'tressurer.jwt';
const USER_KEY = 'tressurer.user';
const WORKSPACE_KEY = 'tressurer.workspace';

// Dev-only shortcut: backend `npm run db:seed` prints EXPO_PUBLIC_DEV_TOKEN
// (a JWT for the seeded local user) so a local backend can be used without
// OAuth — Google's/Microsoft's callbacks only exist for production.
const DEV_TOKEN = process.env.EXPO_PUBLIC_DEV_TOKEN || null;
const decodeJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  token: null,
  user: null,
  workspace: null,
  isHydrated: false,

  // Restore the persisted session on app start. Called once from the root layout.
  hydrate: async () => {
    // A dev token overrides any stored session — it's for the local backend's
    // seeded user, so previous sign-ins belong to a different database.
    if (DEV_TOKEN) {
      const p = decodeJwt(DEV_TOKEN);
      set({
        token: DEV_TOKEN,
        user: p ? { id: p.sub, email: p.email, name: p.name } : null,
        workspace: null,
        isHydrated: true,
      });
      return;
    }
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
