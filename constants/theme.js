// App-level theme: brand palette + shared tokens for screens that live outside
// the tab template's Themed components (login, overlays, error fallback).
const lightColors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  background: '#FFFFFF',
  backgroundDark: '#0F172A',
  surface: '#F8FAFC',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  google: '#4285F4',
  microsoft: '#00A4EF',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

const darkColors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  background: '#0F172A',
  backgroundDark: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#334155',
  danger: '#F87171',
  google: '#4285F4',
  microsoft: '#00A4EF',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

const shared = {
  spacing: (n) => n * 4,
  radius: { sm: 6, md: 10, lg: 16, full: 999 },
};

export const lightTheme = { colors: lightColors, ...shared };
export const darkTheme = { colors: darkColors, ...shared };

// Back-compat default (light). New code should use useTheme() instead.
export const theme = lightTheme;
export default theme;
