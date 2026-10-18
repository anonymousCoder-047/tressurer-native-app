import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import Toast from 'react-native-toast-message';
import 'react-native-reanimated';

import AppErrorBoundary from '@/components/ErrorBoundary';
import LoadingOverlay from '@/components/LoadingOverlay';
import { toastConfig } from '@/components/AppToast';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Redirects based on session state: unauthenticated users land on /login,
// authenticated users are bounced out of /login into the tabs.
function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated) return;
    const onLoginScreen = segments[0] === 'login';

    if (!token && !onLoginScreen) {
      router.replace('/login');
    } else if (token && onLoginScreen) {
      router.replace('/');
    }
  }, [token, isHydrated, segments, router]);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    hydrate();
    useSettingsStore.getState().hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (loaded && isHydrated) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isHydrated]);

  if (!loaded || !isHydrated) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <RootLayoutNav />
      <LoadingOverlay />
      <Toast config={toastConfig} swipeable />
    </AppErrorBoundary>
  );
}

function RootLayoutNav() {
  const t = useTheme();
  useProtectedRoute();

  return (
    <ThemeProvider value={t.mode === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="workspaces" options={{ title: 'Workspaces' }} />
        <Stack.Screen name="trash" options={{ title: 'Trash bin' }} />
        <Stack.Screen name="email" options={{ title: 'Email settings' }} />
        <Stack.Screen name="audit-log" options={{ title: 'Audit log' }} />
        <Stack.Screen name="log" options={{ title: 'Log Record', presentation: 'modal' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
