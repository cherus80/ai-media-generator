import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { AuthGuard } from '../components/auth/AuthGuard';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/ui/Card';
import { useNotificationsStore } from '../store/notificationsStore';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const URL_RE = /(https?:\/\/[^\s)]+)/g;

const isSafeHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const renderPlainTextWithLinks = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let linkIndex = 0;

  for (const match of text.matchAll(URL_RE)) {
    if (match.index === undefined) {
      continue;
    }
    const url = match[0];
    const start = match.index;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    if (isSafeHttpUrl(url)) {
      nodes.push(
        <a
          key={`${keyPrefix}-url-${linkIndex}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary-700 underline break-all hover:text-primary-800"
        >
          {url}
        </a>
      );
    } else {
      nodes.push(url);
    }
    lastIndex = start + url.length;
    linkIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const renderNotificationMessage = (message: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let linkIndex = 0;

  for (const match of message.matchAll(MARKDOWN_LINK_RE)) {
    if (match.index === undefined) {
      continue;
    }
    const [source, label, url] = match;
    const start = match.index;
    if (start > lastIndex) {
      const plainChunk = message.slice(lastIndex, start);
      nodes.push(
        <Fragment key={`${keyPrefix}-text-${linkIndex}`}>
          {renderPlainTextWithLinks(plainChunk, `${keyPrefix}-plain-${linkIndex}`)}
        </Fragment>
      );
    }

    if (isSafeHttpUrl(url)) {
      nodes.push(
        <a
          key={`${keyPrefix}-md-link-${linkIndex}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary-700 underline hover:text-primary-800"
        >
          {label}
        </a>
      );
    } else {
      nodes.push(source);
    }

    lastIndex = start + source.length;
    linkIndex += 1;
  }

  if (lastIndex < message.length) {
    const tail = message.slice(lastIndex);
    nodes.push(
      <Fragment key={`${keyPrefix}-tail`}>
        {renderPlainTextWithLinks(tail, `${keyPrefix}-tail-plain`)}
      </Fragment>
    );
  }

  return nodes;
};

export const NotificationsPage = () => {
  const {
    items,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    markAsRead,
    markAllRead,
  } = useNotificationsStore();
  const autoMarkedRef = useRef(false);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (autoMarkedRef.current) {
      return;
    }
    if (unreadCount > 0 && items.length > 0) {
      autoMarkedRef.current = true;
      markAllRead().catch(() => undefined);
    }
  }, [unreadCount, items.length, markAllRead]);

  const unreadItems = items.filter((item) => !item.is_read);
  const readItems = items.filter((item) => item.is_read);

  const handleMarkRead = async (id: number) => {
    await markAsRead([id]);
    toast.success('Уведомление отмечено как прочитанное');
  };

  const handleMarkAll = async () => {
    await markAllRead();
    toast.success('Все уведомления отмечены как прочитанные');
  };

  const renderTimestamp = (value: string | null) => {
    if (!value) return '—';
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ru });
  };

  return (
    <AuthGuard>
      <Layout
        title="Оповещения"
        subtitle="Сообщения от команды приложения"
        backTo="/app"
        icon={
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z"
            />
          </svg>
        }
      >
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-gray-600 space-x-3">
              <div className="animate-spin h-6 w-6 border-b-2 border-primary-600 rounded-full" />
              <span>Загружаем уведомления...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <Card padding="lg" className="text-center text-gray-500">
              Пока нет сообщений от команды приложения.
            </Card>
          )}

          {!isLoading && !error && items.length > 0 && (
            <>
              <Card padding="lg" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Непрочитанные</h2>
                    <p className="text-sm text-gray-500">Всего: {unreadCount}</p>
                  </div>
                  {unreadItems.length > 0 && (
                    <button
                      onClick={handleMarkAll}
                      className="px-4 py-2 text-xs font-semibold rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100"
                    >
                      Пометить все прочитанными
                    </button>
                  )}
                </div>

                {unreadItems.length === 0 && (
                  <div className="text-sm text-gray-500">Нет непрочитанных сообщений.</div>
                )}

                {unreadItems.length > 0 && (
                  <div className="space-y-3">
                    {unreadItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {item.title || 'Сообщение'}
                            </div>
                            <div className="text-xs text-gray-500">{renderTimestamp(item.created_at)}</div>
                          </div>
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                            Новое
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                          {renderNotificationMessage(item.message, `unread-${item.id}`)}
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={() => handleMarkRead(item.id)}
                            className="text-xs font-semibold text-primary-700 hover:text-primary-800"
                          >
                            Пометить как прочитанное
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card padding="lg" className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Прочитанные</h2>
                  <p className="text-sm text-gray-500">Всего: {readItems.length}</p>
                </div>

                {readItems.length === 0 && (
                  <div className="text-sm text-gray-500">Прочитанных сообщений пока нет.</div>
                )}

                {readItems.length > 0 && (
                  <div className="space-y-3">
                    {readItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {item.title || 'Сообщение'}
                            </div>
                            <div className="text-xs text-gray-500">{renderTimestamp(item.created_at)}</div>
                          </div>
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            Прочитано
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                          {renderNotificationMessage(item.message, `read-${item.id}`)}
                        </div>
                        {item.read_at && (
                          <div className="text-xs text-gray-400">Прочитано {renderTimestamp(item.read_at)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </Layout>
    </AuthGuard>
  );
};
