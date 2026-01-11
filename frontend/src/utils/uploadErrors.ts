import type { FileError } from 'react-dropzone';

type UploadErrorDetail = {
  message?: string;
  detail?: string;
  reason?: string;
  hint?: string;
  action?: string;
  code?: string;
};

type UploadErrorOptions = {
  fallback?: string;
  maxSizeMb?: number;
  allowedTypesLabel?: string;
  kind?: 'image' | 'video';
  status?: number;
};

const DEFAULT_IMAGE_TYPES = 'JPEG, PNG, WebP, HEIC/HEIF, MPO';
const DEFAULT_VIDEO_TYPES = 'MP4, WebM, MOV';

const hasGuidance = (value: string): boolean =>
  /попробуй|выберит|уменьш|сожм|пересохран|загруз|повтор/i.test(value);

const pickAllowedTypesLabel = (options?: UploadErrorOptions): string => {
  if (options?.allowedTypesLabel) {
    return options.allowedTypesLabel;
  }
  return options?.kind === 'video' ? DEFAULT_VIDEO_TYPES : DEFAULT_IMAGE_TYPES;
};

const pickSizeLabel = (options?: UploadErrorOptions): string =>
  options?.maxSizeMb ? `${options.maxSizeMb}MB` : 'допустимого лимита';

const buildSizeMessage = (options?: UploadErrorOptions): string => {
  const sizeLabel = pickSizeLabel(options);
  const action = options?.kind === 'video'
    ? 'Сожмите видео или выберите файл меньшего размера.'
    : 'Сожмите изображение или выберите файл меньшего размера.';
  return `Файл слишком большой. Максимальный размер: ${sizeLabel}. ${action}`;
};

const buildTypeMessage = (options?: UploadErrorOptions): string => {
  const typesLabel = pickAllowedTypesLabel(options);
  return `Неподдерживаемый формат файла. Используйте ${typesLabel}.`;
};

const buildEmptyMessage = (options?: UploadErrorOptions): string =>
  options?.kind === 'video'
    ? 'Файл пустой. Выберите видеофайл и попробуйте снова.'
    : 'Файл пустой. Выберите изображение и попробуйте снова.';

const buildSignatureMessage = (options?: UploadErrorOptions): string =>
  options?.kind === 'video'
    ? 'Файл поврежден или не является видео. Загрузите корректный файл и попробуйте снова.'
    : 'Файл поврежден или не является изображением. Пересохраните его или выберите другой файл.';

const buildDimensionsMessage = (): string =>
  'Недопустимое разрешение изображения. Уменьшите ширину/высоту и попробуйте снова.';

const buildContentTypeMissingMessage = (options?: UploadErrorOptions): string => {
  const typesLabel = pickAllowedTypesLabel(options);
  return `Не удалось определить тип файла. Выберите файл в формате ${typesLabel} и попробуйте снова.`;
};

const buildValidationMessage = (): string =>
  'Не удалось проверить изображение. Пересохраните файл или выберите другое изображение.';

const buildNetworkMessage = (): string =>
  'Не удалось загрузить файл из-за проблем с сетью. Проверьте подключение и попробуйте снова.';

const buildServerSaveMessage = (): string =>
  'Не удалось сохранить файл на сервере. Попробуйте повторить загрузку позже.';

const mapDetailToMessage = (detail: string, options?: UploadErrorOptions): string => {
  const trimmed = detail.trim();
  if (!trimmed) {
    return options?.fallback || 'Не удалось загрузить файл.';
  }
  if (hasGuidance(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.toLowerCase();
  const status = options?.status;

  if (
    status === 413 ||
    normalized.includes('file too large') ||
    normalized.includes('too large') ||
    normalized.includes('larger than') ||
    normalized.includes('request entity too large') ||
    normalized.includes('payload too large')
  ) {
    return buildSizeMessage(options);
  }

  if (
    status === 415 ||
    normalized.includes('invalid file type') ||
    normalized.includes('file-invalid-type') ||
    normalized.includes('unsupported media') ||
    normalized.includes('unsupported')
  ) {
    return buildTypeMessage(options);
  }

  if (normalized.includes('content type') && normalized.includes('missing')) {
    return buildContentTypeMissingMessage(options);
  }

  if (normalized.includes('empty')) {
    return buildEmptyMessage(options);
  }

  if (
    normalized.includes('signature') ||
    normalized.includes('not an image') ||
    normalized.includes('invalid image') ||
    normalized.includes('not a valid image')
  ) {
    return buildSignatureMessage(options);
  }

  if (
    normalized.includes('dimension') ||
    normalized.includes('resolution') ||
    normalized.includes('pixel')
  ) {
    return buildDimensionsMessage();
  }

  if (
    normalized.includes('failed to validate image') ||
    normalized.includes('failed to read image') ||
    normalized.includes('cannot identify image file')
  ) {
    return buildValidationMessage();
  }

  if (
    normalized.includes('network error') ||
    normalized.includes('timeout') ||
    normalized.includes('econnaborted')
  ) {
    return buildNetworkMessage();
  }

  if (normalized.includes('failed to save') || normalized.includes('не удалось сохранить')) {
    return buildServerSaveMessage();
  }

  return trimmed;
};

export const getUploadErrorMessage = (
  error: unknown,
  options: UploadErrorOptions = {}
): string => {
  const fallback = options.fallback || 'Не удалось загрузить файл. Попробуйте еще раз.';
  const maybeError = error as {
    message?: string;
    response?: { data?: { detail?: unknown }; status?: number };
  };

  const status = options.status ?? maybeError?.response?.status;
  const detail = maybeError?.response?.data?.detail;

  if (detail && typeof detail === 'object') {
    const detailObject = detail as UploadErrorDetail;
    const message = detailObject.message || detailObject.detail || detailObject.reason;
    const hint = detailObject.hint || detailObject.action;
    if (message || hint) {
      return [message, hint].filter(Boolean).join(' ');
    }
  }

  if (typeof detail === 'string') {
    return mapDetailToMessage(detail, { ...options, status });
  }

  if (maybeError?.message) {
    return mapDetailToMessage(maybeError.message, { ...options, status });
  }

  if (status && status >= 500) {
    return buildServerSaveMessage();
  }

  return fallback;
};

const formatMaxSizeLabel = (maxSizeBytes?: number): string => {
  if (!maxSizeBytes) {
    return 'допустимого лимита';
  }
  const mbValue = Math.round((maxSizeBytes / (1024 * 1024)) * 10) / 10;
  return `${mbValue}MB`;
};

export const buildAcceptedTypesLabel = (accept?: Record<string, string[]>): string => {
  if (!accept) {
    return DEFAULT_IMAGE_TYPES;
  }
  const extensions = Object.values(accept)
    .flat()
    .map((ext) => ext.replace('.', '').toUpperCase());
  const unique = Array.from(new Set(extensions)).filter(Boolean);
  return unique.length ? unique.join(', ') : DEFAULT_IMAGE_TYPES;
};

export const getDropzoneErrorMessage = (
  error: FileError,
  options: {
    maxSizeBytes?: number;
    allowedTypesLabel?: string;
  } = {}
): string => {
  const allowedTypesLabel = options.allowedTypesLabel || DEFAULT_IMAGE_TYPES;
  const maxSizeLabel = formatMaxSizeLabel(options.maxSizeBytes);

  switch (error.code) {
    case 'file-too-large':
      return `Файл слишком большой. Максимальный размер: ${maxSizeLabel}. Сожмите изображение или выберите файл меньшего размера.`;
    case 'file-invalid-type':
      return `Неподдерживаемый формат файла. Используйте ${allowedTypesLabel}.`;
    case 'too-many-files':
      return 'Можно загрузить только один файл. Удалите лишние файлы и попробуйте снова.';
    default:
      return error.message || 'Не удалось загрузить файл. Попробуйте другой файл.';
  }
};
