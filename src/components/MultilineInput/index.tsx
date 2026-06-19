import React, { useEffect, useCallback, useRef } from 'react';
import { useInput, useStdin, Box, Text } from 'ink';
import { useTerminalWidth } from '../../hooks/useTerminalWidth.js';
import { useTerminalHeight } from '../../hooks/useTerminalHeight.js';
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
   * Receives the display number (1-based) and should return the display string.
   * Default: (n) => `[Paste text #${n}]`
   */
  formatPastePlaceholder?: (displayNumber: number) => string;
  images?: ImageRef[];
  onImagesChange?: (images: ImageRef[]) => void;
  onPasteError?: (reason: PasteErrorReason) => void;
  enableImagePaste?: boolean;
  maxImageSizeBytes?: number;
  maxImageCount?: number;
  acceptedMimeTypes?: string[];
  maxHeight?: number;
  ignoreInput?: (input: string, key: any) => boolean;
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
   * Receives the display number (1-based) and should return the display string.
   * Default: (n) => `[Paste text #${n}]`
   */
  formatPastePlaceholder?: (displayNumber: number) => string;
  images?: ImageRef[];
  onImagesChange?: (images: ImageRef[]) => void;
  maxHeight?: number;
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
  maxHeight,
}) => {
  const textInput = useTextInput({
    initialValue: value ?? '',
    undoDebounceMs,
    pasteThreshold,
    formatPastePlaceholder,
  });

  const isSyncingFromProps = useRef(false);

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
    }
    textInput.syncExternalState({ value, cursorOffset: cursorOverride });
  }, [value, cursorOverride]);

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

  const terminalHeight = useTerminalHeight();
  const defaultMaxHeight = Math.max(1, Math.floor(terminalHeight * 0.8));
  const effectiveMaxHeight = maxHeight ?? defaultMaxHeight;

  return (
    <TextRenderer
      buffer={textInput.buffer}
      cursor={textInput.cursor}
      width={width}
      showCursor={showCursor}
      blockState={textInput.blockState}
      maxHeight={effectiveMaxHeight}
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
  maxHeight,
  ignoreInput,
}) => {
  const terminalWidth = useTerminalWidth(width);

  const { stdin } = useStdin();
  const lastRawInput = useRef<string>('');
  const pasteActive = useRef<boolean>(false);
  const pasteBuffer = useRef<string>('');
  const suppressNextInput = useRef<boolean>(false);

  const textInput = useTextInput({
    initialValue: value ?? '',
    width: terminalWidth,
    undoDebounceMs,
    pasteThreshold,
    formatPastePlaceholder,
  });
  const textInputRef = useRef(textInput);
  useEffect(() => {
    textInputRef.current = textInput;
  }, [textInput]);

  useEffect(() => {
    if (!stdin || !isActive) return;

    const PASTE_START = '\x1b[200~';
    const PASTE_END = '\x1b[201~';

    // Enable bracketed paste mode so terminal-mediated pastes (e.g. Cmd+V on
    // macOS) are wrapped in \x1b[200~ ... \x1b[201~ markers we can detect.
    process.stdout.write('\x1b[?2004h');

    const handleData = (data: Buffer) => {
      const str = data.toString();
      lastRawInput.current = str;

      const hasStart = str.includes(PASTE_START);
      const hasEnd = str.includes(PASTE_END);

      if (!pasteActive.current && !hasStart) return;

      let remaining = str;
      if (!pasteActive.current && hasStart) {
        pasteActive.current = true;
        pasteBuffer.current = '';
        remaining = remaining.slice(
          remaining.indexOf(PASTE_START) + PASTE_START.length,
        );
      }

      // Suppress the useInput dispatch for any chunk that participates in a paste.
      suppressNextInput.current = true;

      if (pasteActive.current) {
        const endIdx = remaining.indexOf(PASTE_END);
        if (endIdx === -1) {
          pasteBuffer.current += remaining;
        } else {
          pasteBuffer.current += remaining.slice(0, endIdx);
          const pasted = pasteBuffer.current;
          pasteActive.current = false;
          pasteBuffer.current = '';
          // Defer to next tick so the insert isn't tangled with React's
          // current render/dispatch cycle for this stdin chunk.
          queueMicrotask(() => {
            textInputRef.current?.insert(pasted);
          });
        }
      }
    };

    stdin.on('data', handleData);
    return () => {
      process.stdout.write('\x1b[?2004l');
      stdin.off('data', handleData);
      pasteActive.current = false;
      pasteBuffer.current = '';
      suppressNextInput.current = false;
    };
  }, [stdin, isActive]);

  const { isPasting, paste: clipboardPaste } = useClipboardPaste({
    enableImagePaste,
    maxImageSizeBytes,
    maxImageCount,
    acceptedMimeTypes,
    existingImages: textInput.images,
    onPasteError,
  });

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
    }
    textInput.syncExternalState({ value, cursorOffset: cursorOverride });
  }, [value, cursorOverride]);

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

  useInput(
    (input: string, key: any) => {
      if (ignoreInput?.(input, key)) {
        return;
      }

      if (suppressNextInput.current) {
        // This stdin chunk is part of a bracketed paste — already handled by the
        // raw 'data' listener. Don't dispatch as keystrokes.
        suppressNextInput.current = false;
        return;
      }
      log(
        `[USEINPUT] input='${input.replace(/[\x00-\x1F\x7F-]/g, (c) => `\\x${c.charCodeAt(0).toString(16)}`)}' key=${JSON.stringify(key)} rawLen=${lastRawInput.current?.length || 0}`,
      );

      // Detect if this is an Alt keypress for symbol keys (like Alt+\ or Alt+/)
      // Standard Alt keypresses send ESC (\x1b) followed by the character.
      // We check if it is a 2-character sequence starting with ESC, excluding CSI/SS3 prefixes ('[' or 'O')
      const raw = lastRawInput.current;
      const isMeta =
        key.meta ||
        (raw &&
          raw.length === 2 &&
          raw.startsWith('\x1b') &&
          raw[1] !== '[' &&
          raw[1] !== 'O');
      const updatedKey = isMeta ? { ...key, meta: true } : key;

      handleKey(
        updatedKey,
        input,
        textInput.buffer,
        actions,
        textInput.cursor,
        lastRawInput.current,
        terminalWidth,
      );
    },
    { isActive },
  );

  const isEmpty = textInput.value === '';
  const showPlaceholder = isEmpty && placeholder && !showCursor;

  if (showPlaceholder && !isPasting) {
    return (
      <Box>
        <Text dimColor>{placeholder}</Text>
      </Box>
    );
  }

  const terminalHeight = useTerminalHeight();
  const defaultMaxHeight = Math.max(1, Math.floor(terminalHeight * 0.8));
  const effectiveMaxHeight = maxHeight ?? defaultMaxHeight;

  return (
    <Box flexDirection="column">
      <TextRenderer
        buffer={textInput.buffer}
        cursor={textInput.cursor}
        width={terminalWidth}
        showCursor={showCursor}
        blockState={textInput.blockState}
        maxHeight={effectiveMaxHeight}
      />
      {isPasting && (
        <Box>
          <Text dimColor>Reading clipboard...</Text>
        </Box>
      )}
    </Box>
  );
};
