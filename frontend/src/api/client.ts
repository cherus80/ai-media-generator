/**
 * Axios API client with interceptors
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base API URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add JWT token to requests
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from Zustand persist storage
    // Zustand persist stores auth state in localStorage with key 'auth-storage'
    const authStorage = localStorage.getItem('auth-storage');

    let token: string | null = null;

    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        token = parsed?.state?.token || null;
      } catch (error) {
        console.error('Failed to parse auth storage:', error);
      }
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized - clear auth and redirect
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear auth data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_profile');

      // Reload to trigger re-authentication
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }

    // Handle 403 Forbidden - user is banned
    if (error.response?.status === 403) {
      console.error('User is banned or forbidden');
      // Could show a modal or redirect to error page
    }

    // Handle network errors
    if (error.message === 'Network Error') {
      console.error('Network error - check your connection');
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
    }

    return Promise.reject(error);
  }
);

export default apiClient;
