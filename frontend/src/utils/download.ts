/**
 * Утилиты для скачивания изображений без открытия нового окна.
 */

const PUBLIC_BASE_URL = (
  import.meta.env.VITE_PUBLIC_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '');

const DEFAULT_APP_URL = 'https://ai-generator.mix4.ru';

export const resolveAbsoluteUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const normalized = url.startsWith('/') ? url : `/${url}`;
  return `${PUBLIC_BASE_URL}${normalized}`;
};

const extractImageExtension = (url: string): string | null => {
  if (!url) return null;
  const clean = url.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return ext;
  }
  return null;
};

export const buildImageFilename = (
  url: string,
  baseName: string,
  fallbackExt: string = 'png'
): string => {
  const ext = extractImageExtension(url) || fallbackExt;
  return `${baseName}.${ext}`;
};

export const downloadImage = async (url: string, filename: string): Promise<void> => {
  const targetUrl = resolveAbsoluteUrl(url);
  if (!targetUrl) {
    throw new Error('Пустой URL изображения');
  }

  // Быстрый путь для data URL
  if (targetUrl.startsWith('data:image')) {
    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const isSameOrigin = targetUrl.startsWith(window.location.origin);

  // Попытка прямого скачивания для своего домена
  if (isSameOrigin) {
    try {
      const link = document.createElement('a');
      link.href = targetUrl;
      link.download = filename;
      link.rel = 'noopener noreferrer';
      link.target = '_self';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    } catch {
      // попробуем fetch-блоб ниже
    }
  }

  try {
    const response = await fetch(targetUrl, {
      mode: 'cors',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки файла: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    return;
  } catch (error) {
    console.error('Download via fetch failed, fallback to opening in new tab:', error);
    // Фолбэк: открываем в новой вкладке, если CORS не даёт скачать blob
    const link = document.createElement('a');
    link.href = targetUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  }
};

export type ImageShareResult =
  | 'shared_file'
  | 'shared_link'
  | 'telegram_link'
  | 'copied_to_clipboard'
  | 'aborted';

interface ShareGeneratedImageParams {
  imageUrl: string;
  fileBaseName: string;
  title: string;
  message: string;
}

const getAppUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return DEFAULT_APP_URL;
};

const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'AbortError';
  }
  return false;
};

const buildShareMessage = (message: string): string => {
  const appUrl = getAppUrl();
  return `${message.trim()}\n${appUrl}`;
};

const buildShareFile = async (imageUrl: string, fileBaseName: string): Promise<File> => {
  const targetUrl = resolveAbsoluteUrl(imageUrl);
  if (!targetUrl) {
    throw new Error('Пустой URL изображения для шаринга');
  }

  const response = await fetch(targetUrl, { mode: 'cors', cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Ошибка загрузки изображения: ${response.status}`);
  }

  const blob = await response.blob();
  const mimeExtension = blob.type?.split('/')[1]?.split('+')[0] || 'png';
  const filename = buildImageFilename(targetUrl, fileBaseName, mimeExtension);

  return new File([blob], filename, {
    type: blob.type || 'image/png',
  });
};

export const shareGeneratedImage = async ({
  imageUrl,
  fileBaseName,
  title,
  message,
}: ShareGeneratedImageParams): Promise<ImageShareResult> => {
  const targetImageUrl = resolveAbsoluteUrl(imageUrl);
  const shareMessage = buildShareMessage(message);

  if (!targetImageUrl) {
    throw new Error('Пустой URL изображения');
  }

  if (navigator.share) {
    if (typeof navigator.canShare === 'function') {
      try {
        const file = await buildShareFile(targetImageUrl, fileBaseName);
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            text: shareMessage,
            files: [file],
          });
          return 'shared_file';
        }
      } catch (error) {
        if (isAbortError(error)) {
          return 'aborted';
        }
        console.error('File sharing is not available, fallback to link sharing:', error);
      }
    }

    try {
      await navigator.share({
        title,
        text: shareMessage,
        url: targetImageUrl,
      });
      return 'shared_link';
    } catch (error) {
      if (isAbortError(error)) {
        return 'aborted';
      }
      console.error('Link sharing failed, fallback to Telegram or clipboard:', error);
    }
  }

  if (window.Telegram?.WebApp?.openTelegramLink) {
    const tgLink =
      `https://t.me/share/url?url=${encodeURIComponent(targetImageUrl)}` +
      `&text=${encodeURIComponent(shareMessage)}`;
    window.Telegram.WebApp.openTelegramLink(tgLink);
    return 'telegram_link';
  }

  await navigator.clipboard.writeText(`${shareMessage}\n${targetImageUrl}`);
  return 'copied_to_clipboard';
};
