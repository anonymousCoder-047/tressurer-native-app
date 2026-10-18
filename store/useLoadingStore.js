import { create } from 'zustand';

// Global pending-request counter, driven by the axios interceptors in
// services/api.js. LoadingOverlay spins while count > 0, so overlapping
// requests don't flicker the spinner off early.
export const useLoadingStore = create((set) => ({
  count: 0,
  start: () => set((s) => ({ count: s.count + 1 })),
  stop: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
}));
