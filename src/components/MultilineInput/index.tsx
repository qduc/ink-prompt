import React, { useEffect, useCallback, useRef } from 'react';
import { useInput, useStdin, Box, Text } from 'ink';
import { useTerminalWidth } from '../../hooks/useTerminalWidth.js';
import { useTextInput } from './useTextInput.js';
import { handleKey, KeyHandlerActions } from './KeyHandler.js';
import { TextRenderer } from './TextRenderer.js';
import { createBuffer } from './TextBuffer.js';
import { useClipboardPaste } from './useClipboardPaste.js';
import type { ImageRef, PasteErrorReason } from './ImageTypes.js';
import { log } from '../../utils/logger.js';

export interface MultilineInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string, images?: ImageRef[]) => void;
  placeholder?: string;
  showCursor?: boolean;
  width?: number;
  isActive?: boolean;
  onCursorChange?: (offset: number) => void;
  cursorOverride?: number;
  onBoundaryArrow?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  undoDebounceMs?: number;
  /**
   * When set, pasted text exceeding this character count is replaced
   * with a placeholder (e.g., "[Paste text #1]") for cleaner display.
   * The original text is preserved and returned via onChange/onSubmit.
   */
  pasteThreshold?: number;
  /**
   * Custom formatter for the placeholder display text.
   * Receives the placeholder ID and should return the display string.
   * Default: (id) => `[Paste text #${id}]`
   */
  formatPastePlaceholder?: (id: number) => string;
  images?: ImageRef[];
  onImagesChange?: (images: ImageRef[]) => void;
  onPasteError?: (reason: PasteErrorReason) => void;
  enableImagePaste?: boolean;
  maxImageSizeBytes?: number;
  maxImageCount?: number;
  acceptedMimeTypes?: string[];
}

export interface MultilineInputCoreProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string, images?: ImageRef[]) => void;
  placeholder?: string;
  showCursor?: boolean;
  width?: number;
  onCursorChange?: (offset: number) => void;
  cursorOverride?: number;
  onBoundaryArrow?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  undoDebounceMs?: number;
  /**
   * When set, pasted text exceeding this character count is replaced
   * with a placeholder (e.g., "[Paste text #1]") for cleaner display.
   * The original text is preserved and returned via onChange/onSubmit.
   */
  pasteThreshold?: number;
  /**
   * Custom formatter for the placeholder display text.
   * Receives the placeholder ID and should return the display string.
   * Default: (id) => `[Paste text #${id}]`
   */
  formatPastePlaceholder?: (id: number) => string;
  images?: ImageRef[];
  onImagesChange?: (images: ImageRef[]) => void;
}

function imagesToRecord(images?: ImageRef[]): Record<string, ImageRef> {
  if (!images || images.length === 0) return {};
  const record: Record<string, ImageRef> = {};
  for (const img of images) {
    record[img.id] = img;
  }
  return record;
}

export const MultilineInputCore: React.FC<MultilineInputCoreProps> = ({
  value,
  onChange,
  placeholder,
  showCursor = true,
  width = 80,
  onCursorChange,
  cursorOverride,
  undoDebounceMs,
  pasteThreshold,
  formatPastePlaceholder,
  images,
  onImagesChange,
}) => {
  const textInput = useTextInput({ initialValue: value ?? '', undoDebounceMs, pasteThreshold, formatPastePlaceholder });

  const isSyncingFromProps = useRef(false);

  useEffect(() => {
    if (cursorOverride !== undefined) {
      textInput.setCursorOffset(cursorOverride);
    }
  }, [cursorOverride]);

  const onCursorChangeRef = useRef(onCursorChange);
  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    if (onCursorChangeRef.current) {
      onCursorChangeRef.current(textInput.cursorOffset);
    }
  }, [textInput.cursorOffset]);

  useEffect(() => {
    if (value !== undefined && value !== textInput.value) {
      isSyncingFromProps.current = true;
      textInput.setText(value);
    }
  }, [value]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (isSyncingFromProps.current) {
      isSyncingFromProps.current = false;
      return;
    }
    onChangeRef.current?.(textInput.value);
  }, [textInput.value]);

  // Sync controlled images
  useEffect(() => {
    if (images !== undefined) {
      textInput.setImages(images);
    }
  }, [images]);

  // Notify parent of image changes
  useEffect(() => {
    if (onImagesChange) {
      onImagesChange(textInput.images);
    }
  }, [onImagesChange, textInput.images]);

  const isEmpty = textInput.value === '';
  const showPlaceholder = isEmpty && placeholder && !showCursor;

  if (showPlaceholder) {
    return <div style={{ opacity: 0.5 }}>{placeholder}</div>;
  }

  return (
    <TextRenderer
      buffer={textInput.buffer}
      cursor={textInput.cursor}
      width={width}
      showCursor={showCursor}
      placeholderState={textInput.placeholderState}
      images={imagesToRecord(textInput.images)}
    />
  );
};

export const MultilineInput: React.FC<MultilineInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  showCursor = true,
  width,
  isActive = true,
  onCursorChange,
  cursorOverride,
  onBoundaryArrow,
  undoDebounceMs,
  pasteThreshold,
  formatPastePlaceholder,
  images,
  onImagesChange,
  onPasteError,
  enableImagePaste = false,
  maxImageSizeBytes,
  maxImageCount,
  acceptedMimeTypes,
}) => {

  const terminalWidth = useTerminalWidth(width);

  const { stdin } = useStdin();
  const lastRawInput = useRef<string>('');

  useEffect(() => {
    if (!stdin || !isActive) return;

    const handleData = (data: Buffer) => {
      lastRawInput.current = data.toString();
    };

    stdin.on('data', handleData);
    return () => {
      stdin.off('data', handleData);
    };
  }, [stdin, isActive]);

  const textInput = useTextInput({ initialValue: value ?? '', width: terminalWidth, undoDebounceMs, pasteThreshold, formatPastePlaceholder });

  const { isPasting, paste: clipboardPaste } = useClipboardPaste({
    enableImagePaste,
    maxImageSizeBytes,
    maxImageCount,
    acceptedMimeTypes,
    existingImages: textInput.images,
    onPasteError,
  });

  useEffect(() => {
    if (cursorOverride !== undefined) {
      textInput.setCursorOffset(cursorOverride);
    }
  }, [cursorOverride]);

  const onCursorChangeRef = useRef(onCursorChange);
  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    onCursorChangeRef.current?.(textInput.cursorOffset);
  }, [textInput.cursorOffset]);

  const isSyncingFromProps = useRef(false);

  useEffect(() => {
    if (value !== undefined && value !== textInput.value) {
      isSyncingFromProps.current = true;
      textInput.setText(value);
    }
  }, [value]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (isSyncingFromProps.current) {
      isSyncingFromProps.current = false;
      return;
    }
    onChangeRef.current?.(textInput.value);
  }, [textInput.value]);

  // Sync controlled images
  useEffect(() => {
    if (images !== undefined) {
      textInput.setImages(images);
    }
  }, [images]);

  // Notify parent of image changes
  const onImagesChangeRef = useRef(onImagesChange);
  useEffect(() => {
    onImagesChangeRef.current = onImagesChange;
  }, [onImagesChange]);

  useEffect(() => {
    if (onImagesChangeRef.current) {
      onImagesChangeRef.current(textInput.images);
    }
  }, [textInput.images]);

  const handleSubmit = useCallback(() => {
    onSubmit?.(textInput.value, textInput.images);
    textInput.setText('');
  }, [onSubmit, textInput.value, textInput.setText, textInput.images]);

  const handlePaste = useCallback(() => {
    clipboardPaste().then((result) => {
      if (result.kind === 'text') {
        textInput.insert(result.value);
      } else if (result.kind === 'image') {
        textInput.insertImage(result.imageRef);
      }
    });
  }, [clipboardPaste, textInput]);

  const actions: KeyHandlerActions = {
    insert: textInput.insert,
    delete: textInput.delete,
    deleteForward: textInput.deleteForward,
    newLine: textInput.newLine,
    deleteAndNewLine: textInput.deleteAndNewLine,
    moveCursor: textInput.moveCursor,
    undo: textInput.undo,
    redo: textInput.redo,
    setText: textInput.setText,
    submit: handleSubmit,
    onBoundaryArrow,
    paste: handlePaste,
  };

  useInput((input: string, key: any) => {
    log(`[USEINPUT] input="${input.replace(/[\x00-\x1F\x7F-￿]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" key=${JSON.stringify(key)} rawLen=${lastRawInput.current?.length || 0}`);
    handleKey(key, input, textInput.buffer, actions, textInput.cursor, lastRawInput.current, terminalWidth);
  }, { isActive });

  const isEmpty = textInput.value === '';
  const showPlaceholder = isEmpty && placeholder && !showCursor;

  if (showPlaceholder && !isPasting) {
    return (
      <Box>
        <Text dimColor>{placeholder}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <TextRenderer
        buffer={textInput.buffer}
        cursor={textInput.cursor}
        width={terminalWidth}
        showCursor={showCursor}
        placeholderState={textInput.placeholderState}
        images={imagesToRecord(textInput.images)}
      />
      {isPasting && (
        <Box>
          <Text dimColor>Reading clipboard...</Text>
        </Box>
      )}
    </Box>
  );
};
