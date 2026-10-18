import axios from 'axios';
import Toast from 'react-native-toast-message';
import { API_URL } from '@/constants/config';
import { useAuthStore } from '@/store/useAuthStore';
import { useLoadingStore } from '@/store/useLoadingStore';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  useLoadingStore.getState().start();
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    useLoadingStore.getState().stop();
    return response;
  },
  (error) => {
    useLoadingStore.getState().stop();

    const data = error.response?.data;
    const message =
      data?.error ??
      (error.code === 'ECONNABORTED'
        ? 'Request timed out'
        : error.message ?? 'Something went wrong');

    // 'Workspace not found' = selected workspace is stale/deleted — the
    // useWorkspace refresh silently re-syncs, so don't scare the user.
    if (data?.error !== 'Workspace not found') {
      Toast.show({
        type: 'error',
        text1: 'Request failed',
        text2: message,
      });
    }

    // Expired/invalid token — drop the session so the auth guard reroutes to login.
    if (error.response?.status === 401) {
      useAuthStore.getState().signOut();
    }

    return Promise.reject(error);
  }
);

export default api;
