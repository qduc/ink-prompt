import { useState, useCallback, useRef } from 'react';
import { createClipboardReader } from './clipboard/index.js';
import type { ImageRef, PasteErrorReason } from './ImageTypes.js';
import { validateImage } from './ImageValidator.js';

export interface UseClipboardPasteProps {
  enableImagePaste?: boolean;
  maxImageSizeBytes?: number;
  maxImageCount?: number;
  acceptedMimeTypes?: string[];
  existingImages?: ImageRef[];
  onPasteError?: (reason: PasteErrorReason) => void;
}

export interface UseClipboardPasteResult {
  isPasting: boolean;
  paste: () => Promise<
    | { kind: 'text'; value: string }
    | { kind: 'image'; imageRef: ImageRef }
    | { kind: 'empty' }
  >;
}

export function useClipboardPaste({
  enableImagePaste = false,
  maxImageSizeBytes,
  maxImageCount,
  acceptedMimeTypes,
  existingImages = [],
  onPasteError,
}: UseClipboardPasteProps = {}): UseClipboardPasteResult {
  const [isPasting, setIsPasting] = useState(false);
  const pasteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paste = useCallback(async () => {
    if (!enableImagePaste) {
      return { kind: 'empty' } as const;
    }

    setIsPasting(true);

    try {
      const reader = createClipboardReader();
      const timeout = new Promise<never>((_, reject) => {
        pasteTimeoutRef.current = setTimeout(() => {
          reject(new Error('clipboard-timeout'));
        }, 1500);
      });

      const result = await Promise.race([reader.read(), timeout]);

      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
        pasteTimeoutRef.current = null;
      }

      if (result.kind === 'text') {
        return { kind: 'text', value: result.value } as const;
      }

      if (result.kind === 'image') {
        try {
          const imageRef = validateImage(result.bytes, existingImages, {
            maxImageSizeBytes,
            maxImageCount,
            acceptedMimeTypes,
          });
          return { kind: 'image', imageRef } as const;
        } catch (err) {
          const reason = (err as Error).message as PasteErrorReason;
          onPasteError?.(reason);
          return { kind: 'empty' } as const;
        }
      }

      return { kind: 'empty' } as const;
    } catch (err) {
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
        pasteTimeoutRef.current = null;
      }

      const reason: PasteErrorReason =
        (err as Error).message === 'clipboard-timeout'
          ? 'clipboard-timeout'
          : 'clipboard-read-error';
      onPasteError?.(reason);
      return { kind: 'empty' } as const;
    } finally {
      setIsPasting(false);
    }
  }, [enableImagePaste, maxImageSizeBytes, maxImageCount, acceptedMimeTypes, existingImages, onPasteError]);

  return { isPasting, paste };
}
