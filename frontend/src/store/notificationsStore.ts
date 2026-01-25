import { create } from 'zustand';
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationsRead,
} from '../api/notifications';
import type { NotificationItem } from '../types/notifications';

interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  loadNotifications: () => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  markAsRead: (ids: number[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  loadNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getNotifications();
      set({
        items: response.items || [],
        unreadCount: response.unread_count || 0,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.detail || error.message || 'Не удалось загрузить уведомления',
      });
    }
  },

  loadUnreadCount: async () => {
    try {
      const response = await getUnreadNotificationsCount();
      set({ unreadCount: response.count || 0 });
    } catch {
      // Игнорируем ошибки счетчика, чтобы не ломать UI
    }
  },

  markAsRead: async (ids: number[]) => {
    if (!ids.length) return;
    try {
      await markNotificationsRead({ notification_ids: ids });
      await get().loadNotifications();
    } catch (error: any) {
      set({ error: error.response?.data?.detail || error.message || 'Не удалось обновить уведомления' });
    }
  },

  markAllRead: async () => {
    try {
      await markNotificationsRead({ mark_all: true });
      await get().loadNotifications();
    } catch (error: any) {
      set({ error: error.response?.data?.detail || error.message || 'Не удалось обновить уведомления' });
    }
  },

  reset: () => set({ items: [], unreadCount: 0, isLoading: false, error: null }),
}));
