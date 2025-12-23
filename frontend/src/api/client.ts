/**
 * Axios API client with interceptors
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Base API URL from environment variable
// Normalize API base: remove trailing slash and optional '/api' suffix to avoid double '/api/api'.
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '') ||
  'http://localhost:8000'
)
  .replace(/\/$/, '')
  .replace(/\/api$/, '');

const AUTH_STORAGE_KEY = 'auth-storage';
let isRedirectingToLogin = false;

const handleUnauthorized = () => {
  if (typeof window === 'undefined' || isRedirectingToLogin) return;
  isRedirectingToLogin = true;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.error('Не удалось очистить localStorage авторизации:', error);
  }
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

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

    // Handle 401 Unauthorized — если запрос был с токеном, считаем сессию истёкшей
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const authHeader =
        originalRequest.headers?.Authorization || originalRequest.headers?.authorization;
      if (authHeader) {
        handleUnauthorized();
      }
      // Возвращаем ошибку вызвавшему коду; UI сам покажет форму логина при необходимости
      return Promise.reject(error);
    }

    // Handle 403 Forbidden - user is banned
    if (error.response?.status === 403) {
      console.error('Доступ запрещён или пользователь заблокирован');
      // Здесь можно показать отдельную страницу или всплывающее окно
    }

    // Handle network errors
    if (error.message === 'Network Error') {
      console.error('Проблемы с сетью — проверьте подключение к интернету');
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      console.error('Время ожидания запроса истекло');
    }

    return Promise.reject(error);
  }
);

export default apiClient;
