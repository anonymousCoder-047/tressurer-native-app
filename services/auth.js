import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import api from '@/services/api';
import { API_URL } from '@/constants/config';

// Backend-mediated OAuth: the backend owns the provider client secrets, runs
// the authorization-code exchange, and 302-redirects back to the app scheme:
//   mobile://auth/callback?token=<jwt>&user=<url-encoded-json>
// Expected backend endpoints: GET /api/auth/google and GET /api/auth/microsoft,
// each accepting ?redirect_uri=<app deep link>.
const CALLBACK_PATH = 'auth/callback';

/**
 * Runs the full OAuth round-trip for a provider and returns { token, user }.
 * Returns null when the user cancels; throws on a malformed/failed exchange.
 * @param {'google' | 'microsoft'} provider
 */
export async function signInWithOAuth(provider) {
  const redirectUri = Linking.createURL(CALLBACK_PATH);
  const authUrl = `${API_URL}/api/auth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success') {
    return null; // user cancelled or dismissed the session
  }

  const { queryParams } = Linking.parse(result.url);
  const token = queryParams?.token;
  if (!token) {
    throw new Error('Authentication completed but no token was returned.');
  }

  let user = null;
  if (queryParams.user) {
    try {
      user = JSON.parse(decodeURIComponent(queryParams.user));
    } catch {
      user = null;
    }
  }

  return { token, user };
}

// PATCH /api/auth/me — update the display name (email/avatar stay provider-owned).
export const updateProfile = (name) =>
  api.patch('/auth/me', { name }).then((r) => r.data.user);
