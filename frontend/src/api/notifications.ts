import apiClient from './client';
import type {
  NotificationsResponse,
  UnreadCountResponse,
  MarkNotificationsReadRequest,
  MarkNotificationsReadResponse,
} from '../types/notifications';

export const getNotifications = async (): Promise<NotificationsResponse> => {
  const response = await apiClient.get<NotificationsResponse>('/api/v1/notifications');
  return response.data;
};

export const getUnreadNotificationsCount = async (): Promise<UnreadCountResponse> => {
  const response = await apiClient.get<UnreadCountResponse>('/api/v1/notifications/unread-count');
  return response.data;
};

export const markNotificationsRead = async (
  payload: MarkNotificationsReadRequest
): Promise<MarkNotificationsReadResponse> => {
  const response = await apiClient.post<MarkNotificationsReadResponse>('/api/v1/notifications/read', payload);
  return response.data;
};
