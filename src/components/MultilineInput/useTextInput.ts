import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  createBuffer,
  insertText as bufferInsertText,
  deleteChar as bufferDeleteChar,
  deleteCharForward as bufferDeleteCharForward,
  insertNewLine as bufferInsertNewLine,
  moveCursor as bufferMoveCursor,
  getTextContent,
} from './TextBuffer.js';
import type { Buffer, Cursor, Direction, PlaceholderState } from './types.js';
import type { ImageRef } from './ImageTypes.js';
import {
  createPlaceholderState,
  addPlaceholder,
  removePlaceholder,
  getValue,
  getValueCursorOffset,
  getCursorFromValueOffset,
} from './Placeholder.js';
import { createSentinel, parseSentinels } from './ImageSentinel.js';
import { findAtomicBlockBefore, findAtomicBlockAfter } from './AtomicBlocks.js';
import { log } from '../../utils/logger.js';

export interface UseTextInputProps {
  initialValue?: string;
  width?: number;
  historyLimit?: number;
  undoDebounceMs?: number;
  /**
   * When set, pasted text exceeding this character count is replaced
   * with a placeholder for cleaner display.
   */
  pasteThreshold?: number;
  /**
   * Custom formatter for placeholder display text.
   * Default: (id) => `[Paste text #${id}]`
   */
  formatPastePlaceholder?: (id: number) => string;
}

export interface UseTextInputResult {
  value: string;
  cursor: Cursor;
  buffer: Buffer;
  insert: (char: string) => void;
  delete: () => void;
  deleteForward: () => void;
  newLine: () => void;
  deleteAndNewLine: () => void;
  moveCursor: (direction: Direction) => void;
  undo: () => void;
  redo: () => void;
  setText: (text: string) => void;
  cursorOffset: number;
  setCursorOffset: (offset: number) => void;
  placeholderState: PlaceholderState;
  insertImage: (imageRef: ImageRef) => void;
  images: ImageRef[];
  getImages: () => ImageRef[];
  setImages: (images: ImageRef[]) => void;
}

interface HistoryState {
  buffer: Buffer;
  cursor: Cursor;
  placeholderState: PlaceholderState;
  images: Record<string, ImageRef>;
}

const defaultFormatPlaceholder = (id: number) => `[Paste text #${id}]`;

export function useTextInput({
  initialValue = '',
  width,
  historyLimit = 100,
  undoDebounceMs = 200,
  pasteThreshold,
  formatPastePlaceholder = defaultFormatPlaceholder,
}: UseTextInputProps = {}): UseTextInputResult {
  const [buffer, setBuffer] = useState<Buffer>(() => createBuffer(initialValue));
  const [cursor, setCursor] = useState<Cursor>(() => {
    const lines = initialValue.split('\n');
    return {
      line: lines.length - 1,
      column: lines[lines.length - 1].length,
    };
  });
  const [placeholderState, setPlaceholderState] = useState<PlaceholderState>(() => createPlaceholderState());
  const [images, setImages] = useState<Record<string, ImageRef>>({});
  const nextDisplayNumberRef = useRef(1);

  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  const pendingInsertBatchRef = useRef<{
    startState?: HistoryState;
    timerId?: ReturnType<typeof setTimeout>;
  }>({});

  const clearPendingInsertTimer = useCallback(() => {
    if (pendingInsertBatchRef.current.timerId) {
      clearTimeout(pendingInsertBatchRef.current.timerId);
      pendingInsertBatchRef.current.timerId = undefined;
    }
  }, []);

  const appendUndoState = useCallback((state: HistoryState) => {
    setUndoStack((prev) => {
      const newStack = [...prev, state];
      if (newStack.length > historyLimit) {
        return newStack.slice(-historyLimit);
      }
      return newStack;
    });
  }, [historyLimit]);

  const commitPendingInsertBatch = useCallback(() => {
    const startState = pendingInsertBatchRef.current.startState;
    if (!startState) return;

    clearPendingInsertTimer();
    pendingInsertBatchRef.current.startState = undefined;
    appendUndoState(startState);
  }, [appendUndoState, clearPendingInsertTimer]);

  const schedulePendingInsertCommit = useCallback(() => {
    if (undoDebounceMs <= 0) return;

    clearPendingInsertTimer();
    pendingInsertBatchRef.current.timerId = setTimeout(() => {
      commitPendingInsertBatch();
    }, undoDebounceMs);
  }, [clearPendingInsertTimer, commitPendingInsertBatch, undoDebounceMs]);

  const beginOrRefreshInsertBatch = useCallback((currentBuffer: Buffer, currentCursor: Cursor) => {
    if (!pendingInsertBatchRef.current.startState) {
      pendingInsertBatchRef.current.startState = {
        buffer: currentBuffer,
        cursor: currentCursor,
        placeholderState,
        images,
      };
      setRedoStack([]);
    }
    schedulePendingInsertCommit();
  }, [schedulePendingInsertCommit, placeholderState, images]);

  const flushPendingInsertBatch = useCallback(() => {
    commitPendingInsertBatch();
  }, [commitPendingInsertBatch]);

  const pushToHistory = useCallback((currentBuffer: Buffer, currentCursor: Cursor) => {
    appendUndoState({
      buffer: currentBuffer,
      cursor: currentCursor,
      placeholderState,
      images,
    });
    setRedoStack([]);
  }, [appendUndoState, placeholderState, images]);

  useEffect(() => {
    return () => {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;
    };
  }, [clearPendingInsertTimer]);

  /** Run a buffer-mutating edit with history bookkeeping (flush batch + push undo). */
  const applyEdit = useCallback(
    (edit: () => { buffer: Buffer; cursor: Cursor } | void) => {
      flushPendingInsertBatch();
      pushToHistory(buffer, cursor);
      const result = edit();
      if (result) {
        setBuffer(result.buffer);
        setCursor(result.cursor);
      }
    },
    [buffer, cursor, flushPendingInsertBatch, pushToHistory]
  );

  const insert = useCallback(
    (char: string) => {
      log(`[INSERT] char="${char.replace(/[\x00-\x1F\x7F-￿]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" len=${char.length} cursor={line:${cursor.line},col:${cursor.column}} linesBefore=${buffer.lines.length}`);

      const normalized = char.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\x00/g, '');

      if (normalized.length === 0) return;

      // Check if this is a paste exceeding the threshold
      if (pasteThreshold !== undefined && pasteThreshold > 0 && normalized.length > pasteThreshold) {
        flushPendingInsertBatch();
        pushToHistory(buffer, cursor);

        const { id, marker, state: newPlaceholderState } = addPlaceholder(
          placeholderState,
          normalized,
          formatPastePlaceholder(placeholderState.nextId)
        );
        setPlaceholderState(newPlaceholderState);

        const result = bufferInsertText(buffer, cursor, marker);
        setBuffer(result.buffer);
        setCursor(result.cursor);
        return;
      }

      const canBatchInsert =
        undoDebounceMs > 0 &&
        normalized.length === 1 &&
        normalized !== '\n';

      if (canBatchInsert) {
        beginOrRefreshInsertBatch(buffer, cursor);
      } else {
        flushPendingInsertBatch();
        pushToHistory(buffer, cursor);
      }

      const result = bufferInsertText(buffer, cursor, normalized);
      setBuffer(result.buffer);
      setCursor(result.cursor);
    },
    [beginOrRefreshInsertBatch, buffer, cursor, flushPendingInsertBatch, pushToHistory, undoDebounceMs, pasteThreshold, placeholderState, formatPastePlaceholder]
  );

  const cleanupBlockRegistry = useCallback(
    (block: ReturnType<typeof findAtomicBlockBefore>) => {
      if (!block) return;
      if (block.kind === 'placeholder') {
        setPlaceholderState((prev) => removePlaceholder(prev, block.id));
      } else if (block.kind === 'sentinel' && images[block.id]) {
        const next = { ...images };
        delete next[block.id];
        setImages(next);
      }
    },
    [images]
  );

  const deleteChar = useCallback(() => {
    applyEdit(() => {
      const line = buffer.lines[cursor.line];
      cleanupBlockRegistry(findAtomicBlockBefore(line, cursor.column, placeholderState.placeholders));
      return bufferDeleteChar(buffer, cursor, placeholderState.placeholders);
    });
  }, [applyEdit, buffer, cursor, placeholderState, cleanupBlockRegistry]);

  const deleteCharForward = useCallback(() => {
    applyEdit(() => {
      const line = buffer.lines[cursor.line];
      cleanupBlockRegistry(findAtomicBlockAfter(line, cursor.column, placeholderState.placeholders));
      return bufferDeleteCharForward(buffer, cursor, placeholderState.placeholders);
    });
  }, [applyEdit, buffer, cursor, placeholderState, cleanupBlockRegistry]);

  const newLine = useCallback(() => {
    applyEdit(() => bufferInsertNewLine(buffer, cursor));
  }, [applyEdit, buffer, cursor]);

  const deleteAndNewLine = useCallback(() => {
    applyEdit(() => {
      const afterDelete = bufferDeleteChar(buffer, cursor, placeholderState.placeholders);
      return bufferInsertNewLine(afterDelete.buffer, afterDelete.cursor);
    });
  }, [applyEdit, buffer, cursor, placeholderState]);

  const moveCursor = useCallback(
    (direction: Direction) => {
      flushPendingInsertBatch();
      const newCursor = bufferMoveCursor(buffer, cursor, direction, width, placeholderState.placeholders);
      setCursor(newCursor);
    },
    [buffer, cursor, flushPendingInsertBatch, width, placeholderState]
  );

  const undo = useCallback(() => {
    const pendingStartState = pendingInsertBatchRef.current.startState;
    if (pendingStartState) {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;

      setRedoStack((prev) => [...prev, { buffer, cursor, placeholderState, images }]);
      setBuffer(pendingStartState.buffer);
      setCursor(pendingStartState.cursor);
      setPlaceholderState(pendingStartState.placeholderState);
      setImages(pendingStartState.images);
      return;
    }

    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [...prev, { buffer, cursor, placeholderState, images }]);
    setBuffer(previousState.buffer);
    setCursor(previousState.cursor);
    setPlaceholderState(previousState.placeholderState);
    setImages(previousState.images);
    setUndoStack(newUndoStack);
  }, [buffer, clearPendingInsertTimer, cursor, undoStack, placeholderState, images]);

  const redo = useCallback(() => {
    if (pendingInsertBatchRef.current.startState) {
      return;
    }

    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack((prev) => [...prev, { buffer, cursor, placeholderState, images }]);
    setBuffer(nextState.buffer);
    setCursor(nextState.cursor);
    setPlaceholderState(nextState.placeholderState);
    setImages(nextState.images);
    setRedoStack(newRedoStack);
  }, [buffer, cursor, redoStack, placeholderState, images]);

  const setText = useCallback(
    (text: string) => {
      applyEdit(() => {
        setPlaceholderState(createPlaceholderState());
        const newBuffer = createBuffer(text);
        const lines = text.split('\n');
        const newCursor = { line: lines.length - 1, column: lines[lines.length - 1].length };

        // Clean up orphaned images
        const usedIds = new Set(parseSentinels(getTextContent(newBuffer)).map((s) => s.id));
        setImages((prev) => {
          const next: Record<string, ImageRef> = {};
          for (const [id, ref] of Object.entries(prev)) {
            if (usedIds.has(id)) next[id] = ref;
          }
          return next;
        });

        return { buffer: newBuffer, cursor: newCursor };
      });
    },
    [applyEdit]
  );

  const insertImage = useCallback(
    (imageRef: ImageRef) => {
      applyEdit(() => {
        setImages((prev) => ({ ...prev, [imageRef.id]: imageRef }));
        if (imageRef.displayNumber >= nextDisplayNumberRef.current) {
          nextDisplayNumberRef.current = imageRef.displayNumber + 1;
        }
        return bufferInsertText(buffer, cursor, createSentinel(imageRef.id, imageRef.displayNumber));
      });
    },
    [applyEdit, buffer, cursor]
  );

  const value = useMemo(
    () => getValue(buffer.lines, placeholderState.placeholders),
    [buffer.lines, placeholderState.placeholders]
  );

  const cursorOffset = useMemo(
    () => getValueCursorOffset(buffer.lines, cursor, placeholderState.placeholders),
    [buffer.lines, cursor, placeholderState.placeholders]
  );

  const imagesList = useMemo(() => Object.values(images), [images]);

  const getImagesCallback = useCallback((): ImageRef[] => {
    return imagesList;
  }, [imagesList]);

  const setImagesCallback = useCallback((newImages: ImageRef[]) => {
    const map: Record<string, ImageRef> = {};
    for (const img of newImages) {
      map[img.id] = img;
    }
    setImages(map);
  }, []);

  return {
    value,
    cursor,
    buffer,
    insert,
    delete: deleteChar,
    deleteForward: deleteCharForward,
    newLine,
    deleteAndNewLine,
    moveCursor,
    undo,
    redo,
    setText,
    cursorOffset,
    setCursorOffset: useCallback(
      (offset: number) => {
        flushPendingInsertBatch();
        setCursor(getCursorFromValueOffset(buffer.lines, offset, placeholderState.placeholders));
      },
      [buffer.lines, flushPendingInsertBatch, placeholderState.placeholders]
    ),
    placeholderState,
    insertImage,
    images: imagesList,
    getImages: getImagesCallback,
    setImages: setImagesCallback,
  };
}
