import { create } from 'zustand';
import { secureStorage } from '@/services/secureStorage';

// App-level preferences. currency drives fmtMoney everywhere.
export const CURRENCIES = {
  INR: { symbol: '₹', locale: 'en-IN' },
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'de-DE' },
  GBP: { symbol: '£', locale: 'en-GB' },
  AED: { symbol: 'AED ', locale: 'en-AE' },
};

// Resolves display metadata for a code — built-ins first, then user customs.
export const currencyMeta = (code, custom = {}) => {
  if (CURRENCIES[code]) return CURRENCIES[code];
  const c = custom[code];
  if (c) return { symbol: `${c.symbol} `, locale: 'en-US', name: c.name };
  return CURRENCIES.INR;
};

const CURRENCY_KEY = 'tressurer.currency';
const CUSTOM_KEY = 'tressurer.customCurrencies';
const THEME_KEY = 'tressurer.theme';

export const useSettingsStore = create((set, get) => ({
  currency: 'INR',
  custom: {}, // { CODE: { name, symbol } } user-defined currencies
  themeMode: 'light', // 'light' | 'dark' | 'system' — default light

  hydrate: async () => {
    const [saved, customJson, themeMode] = await Promise.all([
      secureStorage.get(CURRENCY_KEY).catch(() => null),
      secureStorage.get(CUSTOM_KEY).catch(() => null),
      secureStorage.get(THEME_KEY).catch(() => null),
    ]);
    let custom = {};
    try { custom = customJson ? JSON.parse(customJson) : {}; } catch { custom = {}; }
    set({
      custom,
      currency: saved && (CURRENCIES[saved] || custom[saved]) ? saved : 'INR',
      themeMode: ['light', 'dark', 'system'].includes(themeMode) ? themeMode : 'light',
    });
  },

  setThemeMode: async (themeMode) => {
    if (!['light', 'dark', 'system'].includes(themeMode)) return;
    set({ themeMode });
    await secureStorage.set(THEME_KEY, themeMode).catch(() => {});
  },

  setCurrency: async (currency) => {
    set({ currency });
    await secureStorage.set(CURRENCY_KEY, currency).catch(() => {});
  },

  // name → display label, symbol → prefix glyph. Code derived from the name.
  addCurrency: async (name, symbol) => {
    const code = String(name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (!code || !String(symbol).trim()) return null;
    if (CURRENCIES[code]) return null; // shadows a built-in
    const custom = { ...get().custom, [code]: { name: name.trim(), symbol: symbol.trim() } };
    set({ custom });
    await secureStorage.set(CUSTOM_KEY, JSON.stringify(custom)).catch(() => {});
    return code;
  },
}));
