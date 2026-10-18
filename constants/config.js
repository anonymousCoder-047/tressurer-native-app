import Constants from 'expo-constants';

// In dev, hostUri is the Metro bundler address — reuse its host so a physical
// device reaches the backend running on the same machine. Override with
// EXPO_PUBLIC_API_URL for staging/prod.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (devHost ? `http://${devHost}:5000` : 'http://localhost:5000');

// avatar_url can be an absolute provider URL (Google) or a backend-relative
// path (/api/avatars/…, Microsoft photos) — make a usable URI either way.
export const avatarUri = (url) =>
  !url ? null : url.startsWith('http') ? url : `${API_URL}${url}`;
