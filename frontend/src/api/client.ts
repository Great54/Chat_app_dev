import axios from 'axios';
import { Platform } from 'react-native';
import { storage } from '@/src/utils/storage';

// When EXPO_PUBLIC_BACKEND_URL is unset, use a relative `/api` path so the
// Kubernetes ingress (which routes `/api/*` to the FastAPI backend) handles it.
// For web preview environments where the ingress may not be configured, 
// we detect if we're on web and construct the proper backend URL.
const RAW_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

function getApiBaseUrl(): string {
  // If EXPO_PUBLIC_BACKEND_URL is set, use it
  if (RAW_BASE && RAW_BASE !== 'undefined' && RAW_BASE.trim() !== '') {
    return RAW_BASE;
  }
  
  // For web platform in development/preview, construct the backend URL
  // by using the same host but on port 8001
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Check if we're on localhost or preview domain
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8001';
    }
    // For preview domains, the backend should be accessible via the same domain
    // but the Kubernetes ingress should route /api/* to the backend
    // If that's not working, we return empty and let it use relative paths
  }
  
  // Default: use relative path (relies on ingress routing)
  return '';
}

const API_BASE_URL = getApiBaseUrl();

export { API_BASE_URL };

/**
 * Resolve an asset URL coming from the backend. Backend may return either:
 *   - a fully-qualified URL (https://...) — used as-is
 *   - a server-relative URL like "/api/static/avatars/default-1-panda.png"
 *     — prefixed with API_BASE_URL so native Image components can load it.
 *
 * Returns null/undefined unchanged so callers can keep their fallback logic.
 */
export function resolveAssetUrl(url?: string | null): string | null | undefined {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) {
    // On web with no API_BASE_URL we just use the relative path (same origin).
    if (!API_BASE_URL) return url;
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('auth_token', '');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.removeItem('auth_token');
      // Redirect to login will be handled by the context
    }
    return Promise.reject(error);
  }
);

export default api;