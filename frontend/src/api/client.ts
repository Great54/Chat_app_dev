import axios from 'axios';
import { storage } from '@/src/utils/storage';

// When EXPO_PUBLIC_BACKEND_URL is unset, use a relative `/api` path so the
// Kubernetes ingress (which routes `/api/*` to the FastAPI backend) handles it.
const RAW_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const API_BASE_URL = RAW_BASE && RAW_BASE !== 'undefined' ? RAW_BASE : '';

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