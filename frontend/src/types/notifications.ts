export interface NotificationItem {
  id: number;
  title: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unread_count: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkNotificationsReadRequest {
  notification_ids?: number[];
  mark_all?: boolean;
}

export interface MarkNotificationsReadResponse {
  updated_count: number;
}
