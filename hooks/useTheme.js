import { useColorScheme as useRNColorScheme } from 'react-native';
import { darkTheme, lightTheme } from '@/constants/theme';
import { useSettingsStore } from '@/store/useSettingsStore';

// Returns { colors, spacing, radius, mode } — mode is the resolved 'light'|'dark'.
// themeMode in settings is 'light' | 'dark' | 'system' (default 'light').
export function useTheme() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const system = useRNColorScheme();
  const mode = themeMode === 'system' ? (system ?? 'light') : themeMode;
  const t = mode === 'dark' ? darkTheme : lightTheme;
  return { ...t, mode };
}
