import type { ImageRef } from './ImageTypes.js';
import { generateImageId } from './ImageSentinel.js';

export interface ValidateImageOptions {
  maxImageSizeBytes?: number;
  maxImageCount?: number;
  acceptedMimeTypes?: string[];
}

const MAGIC_BYTES: Array<{ mimeType: string; magic: number[] }> = [
  { mimeType: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { mimeType: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
  { mimeType: 'image/gif', magic: [0x47, 0x49, 0x46, 0x38] },
];

function detectMimeType(bytes: Buffer): string | null {
  for (const { mimeType, magic } of MAGIC_BYTES) {
    if (magic.every((b, i) => bytes[i] === b)) {
      // WebP requires additional check for WEBP header at offset 8
      if (mimeType === 'image/webp') {
        if (bytes.length >= 12 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 &&
            bytes[10] === 0x42 && bytes[11] === 0x50) {
          return mimeType;
        }
        continue;
      }
      return mimeType;
    }
  }
  return null;
}

export function validateImage(
  bytes: Buffer,
  existingImages: ImageRef[],
  options: ValidateImageOptions
): ImageRef {
  const maxSize = options.maxImageSizeBytes ?? 10 * 1024 * 1024;
  const maxCount = options.maxImageCount ?? 10;

  if (bytes.length > maxSize) {
    throw new Error('image-too-large');
  }

  if (existingImages.length >= maxCount) {
    throw new Error('too-many-images');
  }

  const mimeType = detectMimeType(bytes);
  if (!mimeType) {
    throw new Error('clipboard-unsupported-type');
  }

  if (options.acceptedMimeTypes && !options.acceptedMimeTypes.includes(mimeType)) {
    throw new Error('clipboard-unsupported-type');
  }

  const maxDisplayNumber = existingImages.reduce(
    (max, img) => Math.max(max, img.displayNumber),
    0
  );
  const displayNumber = maxDisplayNumber + 1;

  return {
    id: generateImageId(),
    data: bytes.toString('base64'),
    mimeType,
    byteSize: bytes.length,
    displayNumber,
  };
}
