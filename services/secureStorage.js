import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// SecureStore is unavailable on web; fall back to localStorage there.
const isWeb = Platform.OS === 'web';

export const secureStorage = {
  get(key) {
    return isWeb
      ? Promise.resolve(window.localStorage.getItem(key))
      : SecureStore.getItemAsync(key);
  },
  set(key, value) {
    return isWeb
      ? Promise.resolve(window.localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value);
  },
  remove(key) {
    return isWeb
      ? Promise.resolve(window.localStorage.removeItem(key))
      : SecureStore.deleteItemAsync(key);
  },
};
