export type CompressionResult = {
  file: File;
  wasCompressed: boolean;
  meetsLimit: boolean;
  originalSize: number;
  finalSize: number;
};

type CompressionOptions = {
  maxSizeBytes: number;
  maxDimension?: number;
  initialQuality?: number;
  minQuality?: number;
  qualityStep?: number;
  maxAttempts?: number;
  preferWebp?: boolean;
};

const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_INITIAL_QUALITY = 0.86;
const DEFAULT_MIN_QUALITY = 0.6;
const DEFAULT_QUALITY_STEP = 0.08;
const DEFAULT_MAX_ATTEMPTS = 8;

const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const pickOutputType = (fileType: string, preferWebp: boolean): string => {
  if (preferWebp && fileType === 'image/png') {
    return 'image/webp';
  }
  if (fileType === 'image/webp') {
    return 'image/webp';
  }
  return 'image/jpeg';
};

const replaceExtension = (name: string, extension: string): string => {
  const trimmed = name.replace(/\.[^/.]+$/, '');
  return `${trimmed}.${extension}`;
};

const extensionFromMime = (mime: string): string => {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
};

const loadImageSource = async (file: File): Promise<HTMLImageElement | ImageBitmap> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fallback to Image
    }
  }

  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
};

const drawToCanvas = (
  source: HTMLImageElement | ImageBitmap,
  width: number,
  height: number
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

export const compressImageFile = async (
  file: File,
  options: CompressionOptions
): Promise<CompressionResult> => {
  const originalSize = file.size;
  const maxSizeBytes = options.maxSizeBytes;

  if (originalSize <= maxSizeBytes) {
    return {
      file,
      wasCompressed: false,
      meetsLimit: true,
      originalSize,
      finalSize: originalSize,
    };
  }

  if (!COMPRESSIBLE_TYPES.has(file.type)) {
    return {
      file,
      wasCompressed: false,
      meetsLimit: false,
      originalSize,
      finalSize: originalSize,
    };
  }

  const source = await loadImageSource(file);
  const sourceWidth = 'width' in source ? source.width : (source as any).width;
  const sourceHeight = 'height' in source ? source.height : (source as any).height;

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const maxSide = Math.max(sourceWidth, sourceHeight);
  const scale = maxSide > maxDimension ? maxDimension / maxSide : 1;

  let targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  let targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  let quality = options.initialQuality ?? DEFAULT_INITIAL_QUALITY;
  const minQuality = options.minQuality ?? DEFAULT_MIN_QUALITY;
  const qualityStep = options.qualityStep ?? DEFAULT_QUALITY_STEP;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const preferWebp = options.preferWebp ?? true;

  let outputType = pickOutputType(file.type, preferWebp);
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const canvas = drawToCanvas(source, targetWidth, targetHeight);
    let blob = await canvasToBlob(canvas, outputType, quality);

    if (!blob && outputType !== 'image/jpeg') {
      outputType = 'image/jpeg';
      blob = await canvasToBlob(canvas, outputType, quality);
    }

    if (!blob) {
      break;
    }

    bestBlob = blob;

    if (blob.size <= maxSizeBytes) {
      const extension = extensionFromMime(blob.type || outputType);
      const newFile = new File([blob], replaceExtension(file.name, extension), {
        type: blob.type || outputType,
        lastModified: file.lastModified,
      });
      return {
        file: newFile,
        wasCompressed: true,
        meetsLimit: true,
        originalSize,
        finalSize: newFile.size,
      };
    }

    if (quality > minQuality) {
      quality = Math.max(minQuality, quality - qualityStep);
      continue;
    }

    targetWidth = Math.max(1, Math.round(targetWidth * 0.85));
    targetHeight = Math.max(1, Math.round(targetHeight * 0.85));
    quality = options.initialQuality ?? DEFAULT_INITIAL_QUALITY;
  }

  if (bestBlob) {
    const extension = extensionFromMime(bestBlob.type || outputType);
    const newFile = new File([bestBlob], replaceExtension(file.name, extension), {
      type: bestBlob.type || outputType,
      lastModified: file.lastModified,
    });
    return {
      file: newFile,
      wasCompressed: true,
      meetsLimit: newFile.size <= maxSizeBytes,
      originalSize,
      finalSize: newFile.size,
    };
  }

  return {
    file,
    wasCompressed: false,
    meetsLimit: false,
    originalSize,
    finalSize: originalSize,
  };
};
