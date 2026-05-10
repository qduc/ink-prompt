import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  createBuffer,
  insertText as bufferInsertText,
  deleteChar as bufferDeleteChar,
  deleteCharForward as bufferDeleteCharForward,
  insertNewLine as bufferInsertNewLine,
  moveCursor as bufferMoveCursor,
  getTextContent,
  getOffset,
  getCursor,
} from './TextBuffer.js';
import type { Buffer, Cursor, Direction } from './types.js';
import type { ImageRef } from './ImageTypes.js';
import { createSentinel, parseSentinels, findSentinelAt } from './ImageSentinel.js';
import { log } from '../../utils/logger.js';

export interface UseTextInputProps {
  initialValue?: string;
  width?: number;
  historyLimit?: number;
  undoDebounceMs?: number;
}

export interface UseTextInputResult {
  value: string;
  cursor: Cursor;
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
  insertImage: (imageRef: ImageRef) => void;
  images: ImageRef[];
  getImages: () => ImageRef[];
  setImages: (images: ImageRef[]) => void;
}

interface HistoryState {
  buffer: Buffer;
  cursor: Cursor;
  images: Record<string, ImageRef>;
}

export function useTextInput({
  initialValue = '',
  width,
  historyLimit = 100,
  undoDebounceMs = 200,
}: UseTextInputProps = {}): UseTextInputResult {
  const [buffer, setBuffer] = useState<Buffer>(() => createBuffer(initialValue));
  const [cursor, setCursor] = useState<Cursor>(() => {
    const lines = initialValue.split('\n');
    return {
      line: lines.length - 1,
      column: lines[lines.length - 1].length,
    };
  });
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
      pendingInsertBatchRef.current.startState = { buffer: currentBuffer, cursor: currentCursor, images };
      setRedoStack([]);
    }
    schedulePendingInsertCommit();
  }, [schedulePendingInsertCommit, images]);

  const flushPendingInsertBatch = useCallback(() => {
    commitPendingInsertBatch();
  }, [commitPendingInsertBatch]);

  const pushToHistory = useCallback((currentBuffer: Buffer, currentCursor: Cursor) => {
    appendUndoState({ buffer: currentBuffer, cursor: currentCursor, images });
    setRedoStack([]);
  }, [appendUndoState, images]);

  useEffect(() => {
    return () => {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;
    };
  }, [clearPendingInsertTimer]);

  const insert = useCallback(
    (char: string) => {
      log(`[INSERT] char="${char.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" len=${char.length} cursor={line:${cursor.line},col:${cursor.column}} linesBefore=${buffer.lines.length}`);

      const normalized = char.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

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
    [beginOrRefreshInsertBatch, buffer, cursor, flushPendingInsertBatch, pushToHistory, undoDebounceMs]
  );

  const deleteChar = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);

    // Check if deleting a sentinel
    const currentLine = buffer.lines[cursor.line];
    if (cursor.column > 0 && currentLine[cursor.column - 1] === '\uE001') {
      const sentinel = findSentinelAt(currentLine, cursor.column - 1);
      if (sentinel && images[sentinel.id]) {
        const newImages = { ...images };
        delete newImages[sentinel.id];
        setImages(newImages);
      }
    }

    const result = bufferDeleteChar(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory, images]);

  const deleteCharForward = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);

    // Check if deleting a sentinel
    const currentLine = buffer.lines[cursor.line];
    if (cursor.column < currentLine.length && currentLine[cursor.column] === '\uE000') {
      const sentinel = findSentinelAt(currentLine, cursor.column);
      if (sentinel && images[sentinel.id]) {
        const newImages = { ...images };
        delete newImages[sentinel.id];
        setImages(newImages);
      }
    }

    const result = bufferDeleteCharForward(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory, images]);

  const newLine = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);
    const result = bufferInsertNewLine(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory]);

  const deleteAndNewLine = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);
    const afterDelete = bufferDeleteChar(buffer, cursor);
    const afterNewLine = bufferInsertNewLine(afterDelete.buffer, afterDelete.cursor);
    setBuffer(afterNewLine.buffer);
    setCursor(afterNewLine.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory]);

  const moveCursor = useCallback(
    (direction: Direction) => {
      flushPendingInsertBatch();
      const newCursor = bufferMoveCursor(buffer, cursor, direction, width);
      setCursor(newCursor);
    },
    [buffer, cursor, flushPendingInsertBatch, width]
  );

  const undo = useCallback(() => {
    const pendingStartState = pendingInsertBatchRef.current.startState;
    if (pendingStartState) {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;

      setRedoStack((prev) => [...prev, { buffer, cursor, images }]);
      setBuffer(pendingStartState.buffer);
      setCursor(pendingStartState.cursor);
      setImages(pendingStartState.images);
      return;
    }

    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [...prev, { buffer, cursor, images }]);
    setBuffer(previousState.buffer);
    setCursor(previousState.cursor);
    setImages(previousState.images);
    setUndoStack(newUndoStack);
  }, [buffer, clearPendingInsertTimer, cursor, images, undoStack]);

  const redo = useCallback(() => {
    if (pendingInsertBatchRef.current.startState) {
      return;
    }

    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack((prev) => [...prev, { buffer, cursor, images }]);
    setBuffer(nextState.buffer);
    setCursor(nextState.cursor);
    setImages(nextState.images);
    setRedoStack(newRedoStack);
  }, [buffer, cursor, images, redoStack]);

  const setText = useCallback(
    (text: string) => {
      flushPendingInsertBatch();
      pushToHistory(buffer, cursor);
      const newBuffer = createBuffer(text);
      setBuffer(newBuffer);

      const lines = text.split('\n');
      setCursor({
        line: lines.length - 1,
        column: lines[lines.length - 1].length,
      });

      // Clean up orphaned images
      const fullText = getTextContent(newBuffer);
      const sentinels = parseSentinels(fullText);
      const usedIds = new Set(sentinels.map(s => s.id));
      setImages((prev) => {
        const next: Record<string, ImageRef> = {};
        for (const [id, ref] of Object.entries(prev)) {
          if (usedIds.has(id)) {
            next[id] = ref;
          }
        }
        return next;
      });
    },
    [buffer, cursor, flushPendingInsertBatch, pushToHistory]
  );

  const insertImage = useCallback(
    (imageRef: ImageRef) => {
      flushPendingInsertBatch();
      pushToHistory(buffer, cursor);

      const sentinel = createSentinel(imageRef.id, imageRef.displayNumber);
      const result = bufferInsertText(buffer, cursor, sentinel);
      setBuffer(result.buffer);
      setCursor(result.cursor);
      setImages((prev) => ({ ...prev, [imageRef.id]: imageRef }));

      if (imageRef.displayNumber >= nextDisplayNumberRef.current) {
        nextDisplayNumberRef.current = imageRef.displayNumber + 1;
      }
    },
    [buffer, cursor, flushPendingInsertBatch, pushToHistory]
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
    value: getTextContent(buffer),
    cursor,
    insert,
    delete: deleteChar,
    deleteForward: deleteCharForward,
    newLine,
    deleteAndNewLine,
    moveCursor,
    undo,
    redo,
    setText,
    cursorOffset: getOffset(buffer, cursor),
    setCursorOffset: useCallback(
      (offset: number) => {
        flushPendingInsertBatch();
        setCursor(getCursor(buffer, offset));
      },
      [buffer, flushPendingInsertBatch]
    ),
    insertImage,
    images: imagesList,
    getImages: getImagesCallback,
    setImages: setImagesCallback,
  };
}
