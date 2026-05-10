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
import type { Buffer, Cursor, Direction } from './types.js';
import type { ImageRef } from './ImageTypes.js';
import type { BlockState } from './BlockTypes.js';
import {
  createBlockState,
  createPasteBlockEntry,
  createImageBlockEntry,
  removeBlock,
  getValue,
  getValueCursorOffset,
  getCursorFromValueOffset,
} from './BlockRegistry.js';
import { parseBlockMarkers } from './BlockMarker.js';
import { findAtomicBlockBefore, findAtomicBlockAfter } from './AtomicBlocks.js';
import { log } from '../../utils/logger.js';

export interface UseTextInputProps {
  initialValue?: string;
  width?: number;
  historyLimit?: number;
  undoDebounceMs?: number;
  pasteThreshold?: number;
  formatPastePlaceholder?: (displayNumber: number) => string;
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
  blockState: BlockState;
  insertImage: (imageRef: ImageRef) => void;
  images: ImageRef[];
  getImages: () => ImageRef[];
  setImages: (images: ImageRef[]) => void;
}

interface HistoryState {
  buffer: Buffer;
  cursor: Cursor;
  blockState: BlockState;
}

const defaultFormatPlaceholder = (displayNumber: number) => `[Paste text #${displayNumber}]`;

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
  const [blockState, setBlockState] = useState<BlockState>(() => createBlockState());

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
        blockState,
      };
      setRedoStack([]);
    }
    schedulePendingInsertCommit();
  }, [schedulePendingInsertCommit, blockState]);

  const flushPendingInsertBatch = useCallback(() => {
    commitPendingInsertBatch();
  }, [commitPendingInsertBatch]);

  const pushToHistory = useCallback((currentBuffer: Buffer, currentCursor: Cursor) => {
    appendUndoState({
      buffer: currentBuffer,
      cursor: currentCursor,
      blockState,
    });
    setRedoStack([]);
  }, [appendUndoState, blockState]);

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
      log(`[INSERT] char="${char.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" len=${char.length} cursor={line:${cursor.line},col:${cursor.column}} linesBefore=${buffer.lines.length}`);

      const normalized = char.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\x00/g, '');

      if (normalized.length === 0) return;

      if (pasteThreshold !== undefined && pasteThreshold > 0 && normalized.length > pasteThreshold) {
        flushPendingInsertBatch();
        pushToHistory(buffer, cursor);

        const displayText = formatPastePlaceholder(blockState.nextPasteNumber);
        const { marker, state: newBlockState } = createPasteBlockEntry(
          blockState,
          normalized,
          displayText
        );
        setBlockState(newBlockState);

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
    [beginOrRefreshInsertBatch, buffer, cursor, flushPendingInsertBatch, pushToHistory, undoDebounceMs, pasteThreshold, blockState, formatPastePlaceholder]
  );

  const cleanupBlockRegistry = useCallback(
    (block: ReturnType<typeof findAtomicBlockBefore>) => {
      if (!block) return;
      setBlockState((prev) => removeBlock(prev, block.id));
    },
    []
  );

  const deleteChar = useCallback(() => {
    applyEdit(() => {
      const line = buffer.lines[cursor.line];
      cleanupBlockRegistry(findAtomicBlockBefore(line, cursor.column, blockState.entries));
      return bufferDeleteChar(buffer, cursor, blockState.entries);
    });
  }, [applyEdit, buffer, cursor, blockState, cleanupBlockRegistry]);

  const deleteCharForward = useCallback(() => {
    applyEdit(() => {
      const line = buffer.lines[cursor.line];
      cleanupBlockRegistry(findAtomicBlockAfter(line, cursor.column, blockState.entries));
      return bufferDeleteCharForward(buffer, cursor, blockState.entries);
    });
  }, [applyEdit, buffer, cursor, blockState, cleanupBlockRegistry]);

  const newLine = useCallback(() => {
    applyEdit(() => bufferInsertNewLine(buffer, cursor));
  }, [applyEdit, buffer, cursor]);

  const deleteAndNewLine = useCallback(() => {
    applyEdit(() => {
      const afterDelete = bufferDeleteChar(buffer, cursor, blockState.entries);
      return bufferInsertNewLine(afterDelete.buffer, afterDelete.cursor);
    });
  }, [applyEdit, buffer, cursor, blockState]);

  const moveCursor = useCallback(
    (direction: Direction) => {
      flushPendingInsertBatch();
      const newCursor = bufferMoveCursor(buffer, cursor, direction, width, blockState.entries);
      setCursor(newCursor);
    },
    [buffer, cursor, flushPendingInsertBatch, width, blockState]
  );

  const undo = useCallback(() => {
    const pendingStartState = pendingInsertBatchRef.current.startState;
    if (pendingStartState) {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;

      setRedoStack((prev) => [...prev, { buffer, cursor, blockState }]);
      setBuffer(pendingStartState.buffer);
      setCursor(pendingStartState.cursor);
      setBlockState(pendingStartState.blockState);
      return;
    }

    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [...prev, { buffer, cursor, blockState }]);
    setBuffer(previousState.buffer);
    setCursor(previousState.cursor);
    setBlockState(previousState.blockState);
    setUndoStack(newUndoStack);
  }, [buffer, clearPendingInsertTimer, cursor, undoStack, blockState]);

  const redo = useCallback(() => {
    if (pendingInsertBatchRef.current.startState) {
      return;
    }

    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack((prev) => [...prev, { buffer, cursor, blockState }]);
    setBuffer(nextState.buffer);
    setCursor(nextState.cursor);
    setBlockState(nextState.blockState);
    setRedoStack(newRedoStack);
  }, [buffer, cursor, redoStack, blockState]);

  const setText = useCallback(
    (text: string) => {
      applyEdit(() => {
        setBlockState(createBlockState());
        const newBuffer = createBuffer(text);
        const lines = text.split('\n');
        const newCursor = { line: lines.length - 1, column: lines[lines.length - 1].length };

        return { buffer: newBuffer, cursor: newCursor };
      });
    },
    [applyEdit]
  );

  const insertImage = useCallback(
    (imageRef: ImageRef) => {
      applyEdit(() => {
        const { marker, state: newBlockState } = createImageBlockEntry(blockState, imageRef, imageRef.id);
        setBlockState(newBlockState);
        return bufferInsertText(buffer, cursor, marker);
      });
    },
    [applyEdit, buffer, cursor, blockState]
  );

  const value = useMemo(
    () => getValue(buffer.lines, blockState.entries),
    [buffer.lines, blockState.entries]
  );

  const cursorOffset = useMemo(
    () => getValueCursorOffset(buffer.lines, cursor, blockState.entries),
    [buffer.lines, cursor, blockState.entries]
  );

  const imagesList = useMemo(() => {
    const result: ImageRef[] = [];
    for (const entry of blockState.entries.values()) {
      if (entry.kind === 'image') {
        result.push({
          id: entry.id,
          data: entry.data,
          mimeType: entry.mimeType,
          byteSize: entry.byteSize,
          displayNumber: entry.displayNumber,
        });
      }
    }
    return result;
  }, [blockState.entries]);

  const getImagesCallback = useCallback((): ImageRef[] => {
    return imagesList;
  }, [imagesList]);

  const setImagesCallback = useCallback((newImages: ImageRef[]) => {
    setBlockState((prev) => {
      const newEntries = new Map(prev.entries);
      for (const [id, entry] of prev.entries) {
        if (entry.kind === 'image') {
          newEntries.delete(id);
        }
      }
      let nextImageNumber = prev.nextImageNumber;
      for (const img of newImages) {
        nextImageNumber = Math.max(nextImageNumber, img.displayNumber + 1);
        newEntries.set(img.id, {
          kind: 'image',
          id: img.id,
          displayNumber: img.displayNumber,
          data: img.data,
          mimeType: img.mimeType,
          byteSize: img.byteSize,
        });
      }
      return { ...prev, entries: newEntries, nextImageNumber };
    });
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
        setCursor(getCursorFromValueOffset(buffer.lines, offset, blockState.entries));
      },
      [buffer.lines, flushPendingInsertBatch, blockState.entries]
    ),
    blockState,
    insertImage,
    images: imagesList,
    getImages: getImagesCallback,
    setImages: setImagesCallback,
  };
}
