/**
 * Утилиты для скачивания изображений без открытия нового окна.
 */

const PUBLIC_BASE_URL = (
  import.meta.env.VITE_PUBLIC_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '');

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
